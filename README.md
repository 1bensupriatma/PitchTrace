# PitchTrace

PitchTrace turns a short intent into a casual or professional email, automatically creates a Gmail draft, and lets the user review, edit, save, and explicitly confirm before sending.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and add your credentials.
3. In Google Cloud, enable the Gmail API and create an OAuth 2.0 **Web application** client.
4. Add `http://127.0.0.1:8005/api/auth/google/callback` as an authorized redirect URI. It must match `.env` exactly—do not substitute `localhost`.
5. Run `npm run dev`, then open `http://127.0.0.1:5173`.

Without credentials, the app runs in a clearly labeled demo mode. With an OpenAI key but no Gmail OAuth credentials, it generates real drafts without saving them. With both configured, it saves and sends explicitly confirmed drafts through Gmail's `gmail.compose` scope.

## Security and deployment notes

- The app asks only for Gmail compose access and does not request inbox-read access.
- A draft can only be sent from the browser session that created it, and sending requires a separate confirmation action.
- OAuth refresh tokens are held in the development session store. Replace the in-memory session store with a durable encrypted store before production deployment.
- Set a strong `SESSION_SECRET`, serve over HTTPS, and set `NODE_ENV=production` in production.
- Keep `.env` out of source control.
