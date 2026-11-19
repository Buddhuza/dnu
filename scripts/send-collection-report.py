"""Email the owner a result for every production DNU collection run."""

import json
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from zoneinfo import ZoneInfo


SENDER = "sitroom.github@gmail.com"
RECIPIENT = "buddhuza@gmail.com"
VIENNA = ZoneInfo("Europe/Vienna")


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def report_content(result, edition, progress, kind, run_url, finished_at):
    successful = (
        result == "success" and isinstance(edition, dict) and bool(edition.get("articles"))
        and isinstance(progress, dict) and progress.get("state") == "complete"
        and progress.get("checkedAt") == edition.get("checkedAt")
    )
    icon = "✅" if successful else "❌"
    status = "succeeded" if successful else "failed"
    local_time = finished_at.astimezone(VIENNA).strftime("%d %B %Y, %H:%M Vienna")
    subject = f"{icon} DNU scrape {status} — {local_time}"
    lines = [
        f"DNU scrape {status}",
        f"Finished: {local_time}",
        f"Run type: {'manual weekend' if kind == 'weekend' else 'manual' if os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch' else 'automatic'}",
        f"Workflow: {run_url}",
    ]
    if isinstance(edition, dict):
        articles = edition.get("articles") or []
        outcomes = edition.get("sourceOutcomes") or []
        failed = [item for item in outcomes if item.get("status") == "failed"]
        bodies = sum(bool(str(item.get("body") or "").strip()) for item in articles)
        lines.extend([
            f"Coverage: {edition.get('windowStart', 'unknown')} to {edition.get('windowEnd', 'unknown')}",
            f"Stories collected: {len(articles)}",
            f"Full article bodies: {bodies}",
            f"Publisher routes checked: {len(outcomes)}",
            f"Publisher routes failed: {len(failed)}",
        ])
        if failed:
            lines.extend(["", "First route failures:"])
            lines.extend(f"- {item.get('url') or item.get('id') or 'Unknown route'}: {item.get('reason') or 'No reason recorded'}" for item in failed[:10])
            if len(failed) > 10:
                lines.append(f"...and {len(failed) - 10} more. See the workflow artifact for the full audit.")
    if not successful:
        lines.extend(["", "The completed draft was not confirmed. Check the workflow link for the failing step."])
        if isinstance(progress, dict):
            lines.append(f"Last stage: {progress.get('phase') or 'unknown'} — {progress.get('message') or 'No message'}")
            if progress.get("total"):
                lines.append(f"Progress: {progress.get('completed', 0)}/{progress['total']}")
    else:
        lines.extend(["", "The completed scrape is a review draft; it does not automatically replace the published DNU."])
    return subject, "\n".join(lines) + "\n"


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: send-collection-report.py ARTIFACT_DIRECTORY")
    password = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not password:
        raise SystemExit("Set GMAIL_APP_PASSWORD in GitHub Actions secrets.")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    if not run_id.isdecimal():
        raise SystemExit("A GitHub Actions run ID is required.")
    directory = Path(sys.argv[1])
    edition = read_json(directory / "prepared-update.json")
    progress = read_json(directory / "native-collection-progress.json")
    subject, text = report_content(
        os.environ.get("DNU_SCRAPE_RESULT", "failure"), edition, progress,
        os.environ.get("DNU_SCRAPE_KIND", "daily"),
        f"https://github.com/Buddhuza/dnu/actions/runs/{run_id}", datetime.now(timezone.utc)
    )
    message = EmailMessage()
    message["From"] = formataddr(("OSCE SitRoom", SENDER))
    message["To"] = RECIPIENT
    message["Subject"] = subject
    message.set_content(text)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(SENDER, password)
        smtp.send_message(message, from_addr=SENDER, to_addrs=[RECIPIENT])
    print(f"Gmail accepted the {os.environ.get('DNU_SCRAPE_RESULT', 'failure')} scrape report for {RECIPIENT}.")


if __name__ == "__main__":
    main()
