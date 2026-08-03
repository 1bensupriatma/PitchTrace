# PitchTrace

PitchTrace turns a short intent into a polished email and keeps the full workflow in one place: generate, review, edit, save to Gmail, and explicitly confirm before sending.

The app includes three routes:

- `/` — product home and workflow launcher
- `/pitch` — Gmail draft generation and delivery workspace
- `/scrape` — Google Places discovery, controlled website contact extraction, and prospect review workspace

## Features

- Gmail draft creation, listing, reopening, updating, deleting, and sending
- CC, BCC, browser-saved signatures, and removable attachments up to 5 MB each / 10 MB total
- Built-in and browser-saved templates
- AI actions for shortening, warming, and correcting selected text or the full draft
- Google Places prospect discovery, followed by controlled same-domain contact extraction across official websites when available
- Editable contact review, CSV export, and a sourced handoff into Pitch
- Persistent encrypted OAuth sessions and delivery history
- Provider diagnostics with request IDs and retry guidance

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`, add your credentials, and set long random values for `SESSION_SECRET` and `DATA_ENCRYPTION_KEY`.
3. In Google Cloud, enable Gmail API for sending drafts and Places API (New) for `/scrape` place discovery.
4. Create an OAuth 2.0 **Web application** client for Gmail.
5. Add `http://127.0.0.1:8005/api/auth/google/callback` as an authorized redirect URI. It must match `.env` exactly—do not substitute `localhost`.
6. Add a server-side Google Maps Platform API key as `GOOGLE_PLACES_API_KEY`. Do not expose this key in React/frontend code.
7. Run `npm run dev`, then open `http://127.0.0.1:5173`.

Without credentials, the app runs in a clearly labeled demo mode. With an OpenAI key but no Gmail OAuth credentials, it generates real drafts without saving them. With both configured, it manages and sends explicitly confirmed drafts through Gmail's `gmail.compose` scope.

## Security and deployment notes

- The app asks only for Gmail compose access and does not request inbox-read access.
- The contact agent uses Google Places from the backend only, honors `robots.txt` during website scans, blocks local/private networks and cross-domain redirects, caps response sizes and timeouts, and never sends discovered contacts automatically.
- Draft mutations are limited to drafts created or loaded by the current encrypted session, and sending/deletion require separate confirmation actions.
- OAuth refresh tokens and delivery history are encrypted at rest with AES-256-GCM under `DATA_ENCRYPTION_KEY` (or `SESSION_SECRET` when omitted).
- Back up the encryption key securely. Changing it makes existing encrypted session/history files unreadable.
- Set a strong `SESSION_SECRET`, serve over HTTPS, and set `NODE_ENV=production` in production.
- Keep `.env` out of source control.
