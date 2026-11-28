# RAHAF PERFUME HOUSE — GitHub migration

This is the independent Rahaf storefront source maintained in this repository.

## Deployment target

- Frontend: GitHub Pages, built from this directory.
- Authentication and store data: Firebase project `perfumes-12f57`, isolated under the `rahafStore/` namespace.
- Subscription and activation checks: the OMNIX Worker at `https://omnix-api.fibrahem865.workers.dev/api/rahaf/validate`.
- Store API: the OMNIX Worker, using Firebase Admin credentials held only as Cloudflare secrets.

## Important

GitHub Pages is static hosting; it cannot execute a Node backend or protect admin credentials. All privileged operations must be implemented in the OMNIX Worker. Never put Firebase service-account keys, Cloudflare tokens, or other private credentials in this directory.

The React interface and original backend route source are preserved here as migration material. The app is not considered production-ready until the AppDeploy client/SDK imports have been removed, all API routes have been ported to the OMNIX Worker, and the GitHub Pages build and customer/admin flows have passed tests.

## Safety

- Existing `/perfumes/` store and Lamma/OMNIX pages are not modified by this migration branch.
- No existing production data is deleted or overwritten.
- Rahaf's future database records must be isolated under `rahafStore/` so they cannot collide with the other perfume storefront.
- Do not switch the live store URL until the independent build and API have been verified.
