import importlib.util
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("scrape_report", Path(__file__).with_name("send-collection-report.py"))
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)
NOW = datetime(2026, 11, 19, 12, 30, tzinfo=timezone.utc)
EDITION = {
    "checkedAt": "2026-11-19T12:00:00Z",
    "windowStart": "2026-11-18T12:00:00Z", "windowEnd": "2026-11-19T12:00:00Z",
    "articles": [{"body": "Full article"}, {"body": ""}],
    "sourceOutcomes": [{"status": "checked"}, {"status": "failed", "url": "https://example.com/feed", "reason": "HTTP 503"}],
}


class ScrapeReportTests(unittest.TestCase):
    def test_success_reports_counts_and_partial_route_failures(self):
        with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "workflow_dispatch"}):
            subject, body = report.report_content("success", EDITION, {"state": "complete", "checkedAt": EDITION["checkedAt"]}, "daily", "https://github.com/run/1", NOW)
        self.assertTrue(subject.startswith("✅ DNU scrape succeeded"))
        self.assertIn("Run type: manual", body)
        self.assertIn("Stories collected: 2", body)
        self.assertIn("Full article bodies: 1", body)
        self.assertIn("Publisher routes failed: 1", body)
        self.assertIn("HTTP 503", body)
        self.assertIn("review draft", body)

    def test_failed_run_reports_last_progress_even_without_artifact(self):
        progress = {"phase": "articles", "message": "Reading original articles", "completed": 8, "total": 20}
        subject, body = report.report_content("failure", None, progress, "weekend", "https://github.com/run/2", NOW)
        self.assertTrue(subject.startswith("❌ DNU scrape failed"))
        self.assertIn("Run type: manual weekend", body)
        self.assertIn("Last stage: articles", body)
        self.assertIn("Progress: 8/20", body)

    def test_main_sends_to_fixed_owner_without_real_smtp(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
            "GMAIL_APP_PASSWORD": "temporary-secret", "GITHUB_RUN_ID": "123", "DNU_SCRAPE_RESULT": "failure"
        }), patch("sys.argv", ["send-collection-report.py", directory]), patch.object(report.smtplib, "SMTP_SSL") as smtp:
            report.main()
        message = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
        self.assertEqual(message["To"], "buddhuza@gmail.com")
        self.assertIn("OSCE SitRoom", message["From"])
        self.assertTrue(message["Subject"].startswith("❌"))


if __name__ == "__main__":
    unittest.main()
