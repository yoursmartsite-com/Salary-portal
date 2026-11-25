# OMNIX — Central Control System

OMNIX is a separate owner-only control center, hosted under `/omnix/` in this repository.

## Owner account
- The only permitted sign-in email is configured in `index.html`.
- There is no public sign-up flow.
- The owner account must already exist in Firebase Authentication for the configured Firebase project.

## Current phase
- Responsive Arabic RTL owner sign-in screen.
- Initial dashboard shell and navigation.
- No customer, subscription, or program data is read or modified yet.
- Existing perfume portal, perfume storefront, and Android app files are not changed by this initial setup.

## Security boundary — important
The email allowlist in browser code is only a first-stage interface gate. It is **not** sufficient protection for sensitive data because browser code can be inspected or modified. Before connecting any customer or subscription data, establish a trusted owner identity (Firebase UID / custom claim or a trusted backend) and enforce access in Firebase Security Rules. Never rely on a hidden button or client-side email check to secure database writes.

Firebase Authentication Admin actions (such as deleting or disabling users) must run in a trusted server environment; do not put Admin SDK credentials in this static site.

## Deployment
If GitHub Pages is already publishing the repository root, the initial page will be available at:
`https://yoursmartsite-com.github.io/Salary-portal/omnix/`
