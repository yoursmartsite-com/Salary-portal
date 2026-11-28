# OMNIX — Central Control System

OMNIX is a separate owner-only control center, hosted under `/omnix/` in this repository.

## Owner account
- The only permitted sign-in email is configured in `index.html`.
- There is no public sign-up flow.
- The owner account must already exist in Firebase Authentication for the configured Firebase project.

## Current phase
- Responsive Arabic RTL owner sign-in screen and dashboard.
- Program catalog is loaded from `programs.json`.
- Customer list reads `/users` and program assignments read `/omnix/customerPrograms`.
- The owner page can create a normal email/password Firebase Auth account using a separate, in-memory Firebase Auth instance, write the customer's own profile to `/users/{uid}`, and save the program assignment with the owner's existing session.
- The separate customer Auth instance is signed out after creation so the owner's OMNIX session is not replaced.
- Program manager assignment is available through the Cloudflare Worker API after its secrets are configured and the Worker is deployed.
- The manager role is scoped to the perfume store using a Firebase custom claim; it does not grant OMNIX access.

## Security boundary — important
The email allowlist in browser code is only a first-stage interface gate. It is **not** sufficient protection for sensitive data because browser code can be inspected or modified. Before connecting any customer or subscription data, establish a trusted owner identity (Firebase UID / custom claim or a trusted backend) and enforce access in Firebase Security Rules. Never rely on a hidden button or client-side email check to secure database writes.

Creating an ordinary customer account through the public Firebase email/password sign-up capability does not grant OMNIX Admin privileges. The browser-side owner check is an interface gate, not a trusted security boundary. Database reads/writes must still be enforced by Firebase Security Rules. Privileged Firebase Authentication Admin actions (such as deleting, disabling, or changing another user's password) require a trusted server environment; do not put Admin SDK credentials in this static site.

## Deployment
If GitHub Pages is already publishing the repository root, the initial page will be available at:
`https://yoursmartsite-com.github.io/Salary-portal/omnix/`

## Registered AppDeploy application
- **عطور رهف** is registered in `programs.json` as `rahaf-perfume-store`.
- Live storefront: https://rahaf-icy8sk.v2.appdeploy.ai/
- AppDeploy application ID: `rahaf-icy8sk`.
- Integration checklist and remaining entitlement-enforcement work: `integrations/rahaf-perfume-store.md`.
- Catalog registration is complete; subscription enforcement is not yet active until the storefront and OMNIX entitlement API are connected and tested.

## Project control coverage (2026-11-28)

The dashboard catalog now displays a separate OMNIX integration status for every registered project. This is intentionally distinct from whether the project's files or URL exist.

| Project | Current control status |
|---|---|
| لَمّة | Catalogued; subscription enforcement still needs integration |
| عطور زين ورهف web store | Connected to `/api/access?programId=zein-rahaf-store` |
| بوابة برامج زين ورهف | Gateway exists; end-to-end subscription flow still needs verification |
| عطور زين ورهف Android | Intended to share the store entitlement; APK release URL and device flow still need verification |
| عطور رهف (AppDeploy) | Catalogued; AppDeploy entitlement validation is not complete |

Existing project URLs, Firebase projects, customer accounts, orders, product data, media, and Lamma's Cloudflare room service are not migrated or deleted by this control-center update.

**Important:** the current Worker access gate is explicitly wired to the `zein-rahaf-store` Firebase app. A catalog entry alone does not make another project's users subject to OMNIX subscriptions. Each separate runtime needs its own trusted integration and end-to-end tests before its status can be marked connected.
