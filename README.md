# Intent

Intent is a small, privacy-friendly app to help you stay aware of the time you choose to spend on an activity.

## Current foundation

- Set a custom duration or choose 10, 20, or 30 minutes.
- Alternatively choose a clock-time deadline.
- In-app reminders at five and two minutes remaining.
- Save completed sessions locally in the browser.
- Responsive interface for mobile and desktop.
- Capacitor configuration is included for a future Android package.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

## Notes

This is an early foundation. At this stage reminders are shown inside the app while it is open. Android notifications, reminders while another app is in the foreground, and a floating banner are not implemented yet. Session data is stored locally in the browser and is not synced to a server.