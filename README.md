# Passport Pickup Tracker

Tracks whether the GTS Premium scheduling site can reach the passport pickup appointment flow.

The first version is intentionally conservative: it opens the official site, waits for the app to render, saves a screenshot, and reports whether expected or unavailable text appears. After the exact booking flow is known, add form selectors and a stronger "ready for pickup" rule.

## Setup

```powershell
cd C:\Users\alpac\.openclaw\workspace\passport-pickup-tracker
npm install
npx playwright install chromium
Copy-Item config.example.json config.local.json
npm run check
```

Artifacts are written to `artifacts/latest-state.json` and `artifacts/latest.png`.

## Checking With UID/HAL

The site asks for an 8 or 9 digit UID/HAL before it can query appointment slots. Prefer using an environment variable:

```powershell
$env:PASSPORT_PICKUP_UID = "123456789"
npm run check
```

The script will tick the terms box, submit the query, and classify the result as `appointment-available`, `unavailable`, or `checked-no-known-result`.

## GitHub Actions

This repo can run from a private GitHub repository with GitHub Actions. Keep the repo private because the workflow purpose is personal.

Create these repository secrets:

- `PASSPORT_PICKUP_UID` - your 8 or 9 digit UID/HAL.
- `GMAIL_USERNAME` - the Gmail address used to send notifications.
- `GMAIL_APP_PASSWORD` - a Gmail App Password, not your normal Google password.
- `EMAIL_TO` - recipient email address.

The workflow uses Gmail SMTP directly:

- SMTP server: `smtp.gmail.com`
- SMTP port: `465`
- SSL/TLS: enabled

To create `GMAIL_APP_PASSWORD`, enable 2-Step Verification on the Google account, then create an App Password in Google Account security settings. Use the 16-character app password as the secret value.

The workflow is stored at `.github/workflows/passport-pickup-check.yml`.

It supports:

- Manual runs from the GitHub Actions tab.
- Scheduled runs once per hour.
- Email notification on the first successful run.
- Email notification when the check result changes.
- Email notification near the end of each day in `Asia/Shanghai`, even if nothing changed.
- Email notification when the status is `appointment-available` or `error`.

The workflow does not upload screenshots or artifacts, because screenshots can include the UID. It stores the last non-secret check result on a `monitor-state` branch so future runs can compare status changes.

## Next Data Needed

To make this fully automatic, collect the minimum non-secret flow details:

- The exact message shown when no pickup appointment is available.
- The exact message or button shown when pickup booking becomes available.

Avoid storing passport numbers, birthdays, or credentials in this repo unless there is no other way to check the flow.
