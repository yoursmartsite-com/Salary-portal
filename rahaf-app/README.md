# RAHAF Store — GitHub migration snapshot

This directory contains the source exported from AppDeploy app `rahaf-icy8sk`.

## Important runtime note

GitHub Pages only serves static files. It does not execute the AppDeploy backend or its `@appdeploy/sdk` database, authentication, storage, and notification APIs. The React source still imports `@appdeploy/client`, so this snapshot is **not yet a standalone GitHub Pages deployment**.

The activation verifier in `backend/index.ts` has been changed to call the OMNIX validation endpoint:

`POST https://omnix-api.fibrahem865.workers.dev/api/rahaf/validate`

However, the rest of the backend still uses AppDeploy SDK services. To run independently from GitHub, the next step is to port those routes to a Cloudflare Worker and connect the existing Firebase project / Cloudinary without deleting or migrating customer, product, or order data blindly.

## Source of truth and safety

- Original AppDeploy deployment remains untouched at https://rahaf-icy8sk.v2.appdeploy.ai/
- Existing GitHub Pages store under `/perfumes/` remains untouched.
- This migration is isolated on branch `rahaf-github-migration`.
- No production URL was switched and no customer data was copied or deleted.
- Do not publish this directory as the live app until the backend replacement and build are tested.
