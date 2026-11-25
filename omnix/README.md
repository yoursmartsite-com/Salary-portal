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
- Subscription administration and privileged Firebase Auth administration are not implemented.

## Security boundary — important
The email allowlist in browser code is only a first-stage interface gate. It is **not** sufficient protection for sensitive data because browser code can be inspected or modified. Before connecting any customer or subscription data, establish a trusted owner identity (Firebase UID / custom claim or a trusted backend) and enforce access in Firebase Security Rules. Never rely on a hidden button or client-side email check to secure database writes.

Creating an ordinary customer account through the public Firebase email/password sign-up capability does not grant OMNIX Admin privileges. The browser-side owner check is an interface gate, not a trusted security boundary. Database reads/writes must still be enforced by Firebase Security Rules. Privileged Firebase Authentication Admin actions (such as deleting, disabling, or changing another user's password) require a trusted server environment; do not put Admin SDK credentials in this static site.

## Deployment
If GitHub Pages is already publishing the repository root, the initial page will be available at:
`https://yoursmartsite-com.github.io/Salary-portal/omnix/`
