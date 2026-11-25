# OMNIX API — Cloudflare Worker

This is the trusted server-side layer for OMNIX. It uses Firebase Identity Toolkit Admin REST endpoints and Realtime Database REST with a Google service-account OAuth token. No service-account private key belongs in the browser or GitHub.

## One-time account setup

### 1) Firebase service account
1. Open Firebase Console → project **perfumes-12f57** → Project settings → Service accounts.
2. Generate a new private key and download the JSON file.
3. In Google Cloud Console → IAM, grant that service account only the roles needed for this Worker: **Firebase Authentication Admin** and **Firebase Realtime Database Admin** (or the equivalent narrow permissions available in the project).
4. Keep the JSON file private. Never upload it to the repository or send it in chat.

### 2) GitHub Actions secrets
In the repository Settings → Secrets and variables → Actions, add:
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Workers Scripts Edit permission for this account.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.
- `FIREBASE_SERVICE_ACCOUNT`: paste the entire contents of the downloaded service-account JSON file as the secret value.

The workflow creates the Worker, uploads the service-account JSON as a Worker secret, and deploys it. The private key is never written to repository files.

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
- `GET /api/program-admins?programId=zein-rahaf-store` — list assigned store managers.
- `POST /api/program-admins` — assign an existing Firebase Authentication user by email. Body: `{email,programId:"zein-rahaf-store"}`. Sets the `zeinRahafStoreAdmin` custom claim.
- `DELETE /api/program-admins/{uid}` — revoke the store-manager claim and remove the assignment.
- `POST /api/customers` — create an Auth user through Firebase sign-up, then securely save its profile/program assignment. Body: `{name,email,password,phone,program:{id,name,url}}`.
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
- Program managers: `/omnix/programAdmins/zein-rahaf-store/{uid}`

## Important
This Worker is not deployed merely because the source is in GitHub. The service-account secret must be added in Cloudflare and the Worker deployed. The OMNIX dashboard includes a Program Managers section. After deployment, copy the Worker `workers.dev` URL into that section on the owner device. Publish `perfumes/database.rules.json` to the `perfumes-12f57` Realtime Database before granting a manager. The rules allow only the `zeinRahafStoreAdmin` custom claim to manage the perfume store's products, orders and customer profiles; `/omnix/**` remains owner-only. A manager must sign out and sign in again after assignment or revocation so Firebase refreshes the ID token. Revocation may take effect for an already-issued ID token only after that token expires. Do not loosen Firebase rules to compensate for missing backend permissions.
