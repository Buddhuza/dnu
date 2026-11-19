"""Check that public recipients cannot see the saved address book."""

import importlib.util
import smtplib
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("send-dnu-gmail.py")
SPEC = importlib.util.spec_from_file_location("dnu_gmail", SCRIPT)
GMAIL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GMAIL)


class CaptureSMTP:
    send_message = smtplib.SMTP.send_message

    def ehlo_or_helo_if_needed(self):
        pass

    def sendmail(self, sender, recipients, payload, mail_options=(), rcpt_options=()):
        self.sender = sender
        self.recipients = recipients
        self.payload = payload
        return {}


class GmailEnvelopeTest(unittest.TestCase):
    def test_fixed_to_and_hidden_bcc_recipients(self):
        recipients = ("buddhuza@gmail.com", "ayabushady@gmail.com")
        message = GMAIL.build_message(
            {"subject": "[TEST] Daily update", "text": "Headline", "html": "<p>Headline</p>"},
            SCRIPT.parents[1] / "public" / "osce-logo.png", recipients)
        smtp = CaptureSMTP()
        smtp.send_message(message, from_addr=GMAIL.SENDER, to_addrs=(GMAIL.TO_ADDRESS, *recipients))
        self.assertEqual(message["To"], "sitcen-at@osce.org")
        self.assertEqual(message["Bcc"], ", ".join(recipients))
        self.assertEqual(smtp.recipients, ("sitcen-at@osce.org", *recipients))
        self.assertIn(b"To: sitcen-at@osce.org", smtp.payload)
        self.assertNotIn(b"Bcc:", smtp.payload)
        self.assertNotIn(b"buddhuza@gmail.com", smtp.payload)
        self.assertNotIn(b"ayabushady@gmail.com", smtp.payload)


if __name__ == "__main__":
    unittest.main()
