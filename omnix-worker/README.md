# OMNIX API — Cloudflare Worker

This is the trusted server-side layer for OMNIX. It uses Firebase Identity Toolkit Admin REST endpoints and Realtime Database REST with a Google service-account OAuth token. No service-account private key belongs in the browser or GitHub.

## Required Cloudflare Worker secrets

Set these as Worker secrets (never commit them):
- `FIREBASE_SERVICE_ACCOUNT`: the complete JSON key for a service account in Firebase project `perfumes-12f57`. The service account must have permissions to manage Firebase Authentication users and read/write the Realtime Database (Firebase Admin / appropriate IAM roles).

The non-secret variables are in `wrangler.toml`. `ALLOWED_ORIGIN` is restricted to the GitHub Pages origin.

## Deploy

1. In Cloudflare Dashboard, open **Workers & Pages → Create → Worker**.
2. Create `omnix-api`, then open **Edit code** and deploy the contents of `src/index.js` (or connect this repository and set the Worker root directory to `omnix-worker`).
3. In Worker **Settings → Variables and Secrets**, add the secret `FIREBASE_SERVICE_ACCOUNT` with the complete JSON key. Do not put the JSON in GitHub, chat, or the Worker source.
4. Confirm the non-secret variables match `wrangler.toml`; deploy.
5. Open `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`. It should return `{"ok":true,"service":"OMNIX API","version":"1.0.0"}`.

## API

Every `/api/*` route requires `Authorization: Bearer <Firebase ID token>` from the signed-in owner account.
- `GET /api/bootstrap` — read customers, assignments, subscriptions, notifications, releases and settings.
- `POST /api/customers` — create an Auth user and its profile/program assignment. Body: `{name,email,password,phone,program:{id,name,url}}`.
- `PATCH /api/customers/:uid` — update email/display name/password, set `disabled`, or patch `profile`.
- `DELETE /api/customers/:uid` — delete Auth user and related OMNIX records.
- `PUT /api/subscriptions/:uid` — create/update a subscription. Body may include `days`, `status`, `startAt`, `programId`, `notes`.
- `POST /api/notifications` — save an announcement/notification.
- `POST /api/releases` — save a program release with HTTPS download URL.
- `PUT /api/settings` — save OMNIX settings.
- `GET /health` — public health check.

## Data paths
- Customer profile: `/users/{uid}`
- Program assignment: `/omnix/customerPrograms/{uid}`
- Subscription: `/omnix/subscriptions/{uid}`
- Notifications: `/omnix/notifications`
- Releases: `/omnix/releases`
- Settings: `/omnix/settings`

## Important
This Worker is not deployed merely because the source is in GitHub. The service-account secret must be added in Cloudflare and the Worker deployed. The OMNIX dashboard must then be configured with the resulting Worker URL and its UI actions wired to these endpoints. Do not loosen Firebase rules to compensate for missing backend permissions.
