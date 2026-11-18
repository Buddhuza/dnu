"""Send the already rendered published DNU through the named Gmail account."""

import json
import os
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path

SENDER = "sitroom.github@gmail.com"
RECIPIENTS = ("buddhuza@gmail.com", "ayabushady@gmail.com")


def build_message(data, logo):
    message = EmailMessage()
    message["From"] = SENDER
    message["To"] = ", ".join(RECIPIENTS)
    message["Subject"] = data["subject"]
    message.set_content(data["text"])
    message.add_alternative(data["html"], subtype="html")
    message.get_payload()[1].add_related(
        logo.read_bytes(), maintype="image", subtype="png", cid="<dnu-osce-logo>"
    )
    return message


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: send-dnu-gmail.py MESSAGE_JSON")
    password = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not password:
        raise SystemExit("Set GMAIL_APP_PASSWORD in GitHub Actions secrets.")
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not data.get("articleCount"):
        raise SystemExit("The message has no articles; no email was sent.")
    logo = Path(__file__).resolve().parents[1] / "public" / "osce-logo.png"
    message = build_message(data, logo)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(SENDER, password)
        smtp.send_message(message, from_addr=SENDER, to_addrs=RECIPIENTS)
    print(f"Gmail accepted the published DNU for {len(RECIPIENTS)} recipients.")


if __name__ == "__main__":
    main()
