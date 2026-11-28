# RAHAF PERFUME HOUSE — GitHub migration

This is the independent Rahaf storefront source maintained in this repository.

## Deployment target

- Frontend: GitHub Pages, built from this directory.
- Authentication and store data: Firebase project `perfumes-12f57`, isolated under the `rahafStore/` namespace.
- Subscription and activation checks: the OMNIX Worker at `https://omnix-api.fibrahem865.workers.dev/api/rahaf/validate`.
- Store API: the OMNIX Worker, using Firebase Admin credentials held only as Cloudflare secrets.

## Important

GitHub Pages is static hosting; it cannot execute a Node backend or protect admin credentials. All privileged operations must be implemented in the OMNIX Worker. Never put Firebase service-account keys, Cloudflare tokens, or other private credentials in this directory.

The React storefront now uses Firebase Authentication and the OMNIX Worker. The legacy AppDeploy backend has been removed. The app is not production-ready until the live Pages deployment and customer/admin flows have passed end-to-end tests.

## Safety

- Existing `/perfumes/` store and Lamma/OMNIX pages are not modified by this migration branch.
- No existing production data is deleted or overwritten.
- Rahaf's future database records must be isolated under `rahafStore/` so they cannot collide with the other perfume storefront.
- Do not switch the live store URL until the independent build and API have been verified.
