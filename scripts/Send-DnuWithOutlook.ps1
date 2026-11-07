param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'windows-outlook.config.json'),
    [switch]$Send,
    [switch]$AtEight
)

$ErrorActionPreference = 'Stop'
if ($AtEight -and -not $Send) { throw '-AtEight requires -Send.' }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Copy windows-outlook.config.example.json to $ConfigPath and fill in the account, mailing lists, and public Supabase key." }

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$recipients = @($config.mailingLists | ForEach-Object { [string]$_ } | Where-Object { $_.Trim() } | Select-Object -Unique)
if ($recipients.Count -eq 0) { throw 'Add at least one mailing-list address to the config.' }
if ($Send -and -not ([string]$config.senderAccount).Trim()) { throw 'Set senderAccount to the intended Outlook mailbox before sending.' }

$viennaZone = [TimeZoneInfo]::FindSystemTimeZoneById('W. Europe Standard Time')
$viennaNow = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $viennaZone)
$targetUtc = [TimeZoneInfo]::ConvertTimeToUtc($viennaNow.Date.AddHours(8), $viennaZone)
if ($AtEight) {
    if ($viennaNow.DayOfWeek -notin @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) { throw 'Scheduled sending is limited to Saturday and Sunday.' }
    if ([DateTime]::UtcNow -gt $targetUtc.AddSeconds(30)) { throw 'The 08:00 Vienna sending window has passed.' }
}

$node = Get-Command node -ErrorAction Stop
$builder = Join-Path $PSScriptRoot 'windows-outlook-message.mjs'
$temporaryMessage = Join-Path ([IO.Path]::GetTempPath()) ("dnu-outlook-{0}.json" -f [guid]::NewGuid())
try {
    while ($true) {
        $builderOutput = & $node.Source $builder $ConfigPath $temporaryMessage 2>&1
        if ($LASTEXITCODE -eq 0) { break }
        if (-not $AtEight -or [DateTime]::UtcNow -ge $targetUtc.AddMinutes(-1)) {
            throw "Could not prepare the current published DNU: $builderOutput"
        }
        Write-Host 'Waiting for the prepared weekend edition...'
        Start-Sleep -Seconds 10
    }

    $message = Get-Content -LiteralPath $temporaryMessage -Raw -Encoding UTF8 | ConvertFrom-Json
    $statePath = Join-Path (Split-Path -Parent $ConfigPath) 'windows-outlook-send-state.json'
    if ($Send -and (Test-Path -LiteralPath $statePath)) {
        $previous = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($previous.editionDate -eq $message.editionDate) { throw "The $($message.editionDate) edition was already claimed or sent on this Windows computer. No second message was sent." }
    }

    # COM automation requires classic Outlook and the signed-in desktop profile.
    $outlook = New-Object -ComObject Outlook.Application
    $mail = $outlook.CreateItem(0)
    $mail.Subject = [string]$message.subject
    foreach ($address in $recipients) {
        $recipient = $mail.Recipients.Add($address.Trim())
        $recipient.Type = 1
    }
    if (-not $mail.Recipients.ResolveAll()) { throw 'Outlook could not resolve one or more mailing lists. No message was sent.' }

    $sender = ([string]$config.senderAccount).Trim()
    if ($sender) {
        $account = $null
        foreach ($candidate in $outlook.Session.Accounts) {
            if ($candidate.SmtpAddress -ieq $sender) { $account = $candidate; break }
        }
        if (-not $account) { throw "The Outlook profile has no sending account named $sender. No message was sent." }
        $mail.SendUsingAccount = $account
    }

    $logo = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\osce-logo.png'
    if (-not (Test-Path -LiteralPath $logo)) { throw 'The OSCE logo is missing from this DNU checkout.' }
    $attachment = $mail.Attachments.Add($logo)
    $attachment.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x3712001F', 'dnu-osce-logo')
    $attachment.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x7FFE000B', $true)
    $mail.HTMLBody = [string]$message.html

    if (-not $Send) {
        $mail.Display()
        Write-Host "Preview opened in Outlook: $($message.articleCount) stories, $($message.subject). No email was sent."
        return
    }

    if ($AtEight) {
        while ([DateTime]::UtcNow -lt $targetUtc) {
            $remaining = ($targetUtc - [DateTime]::UtcNow).TotalMilliseconds
            Start-Sleep -Milliseconds ([Math]::Max(10, [Math]::Min(500, [int]$remaining)))
        }
        if ([DateTime]::UtcNow -gt $targetUtc.AddSeconds(30)) { throw 'The 08:00 Vienna sending window was missed. No email was sent.' }
    }

    # Claim before Send: a rerun cannot create a second email if Outlook accepts
    # the first message but the process ends before it can record success.
    @{ editionDate = $message.editionDate; revision = $message.revision; status = 'claimed'; at = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    $mail.Send()
    @{ editionDate = $message.editionDate; revision = $message.revision; status = 'submitted'; at = [DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Host "Outlook submitted $($message.articleCount) DNU stories to $($recipients.Count) mailing lists at $([DateTime]::UtcNow.ToString('o'))."
}
finally {
    Remove-Item -LiteralPath $temporaryMessage -ErrorAction SilentlyContinue
}
