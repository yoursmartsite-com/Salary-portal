# عطور رهف — OMNIX integration

## Registered application

- OMNIX program ID: `rahaf-perfume-store`
- AppDeploy app ID: `rahaf-icy8sk`
- Live storefront: https://rahaf-icy8sk.v2.appdeploy.ai/
- Control center: https://omnix-central-control-mbg6e7.v2.appdeploy.ai/
- Owner account: `fibrahem865@gmail.com`

The OMNIX GitHub program catalog registers the live storefront as a separate program. Registration does not migrate, copy, or replace the store database, authentication, customer accounts, products, orders, or media.

## Intended subscription flow

1. Owner creates a customer and assigns the `rahaf-perfume-store` program in OMNIX.
2. OMNIX issues an activation code and stores its start/end dates and status.
3. The Rahaf storefront validates the code against the trusted OMNIX entitlement API before enabling protected store access.
4. Paused, expired, invalid, or mismatched application codes must deny protected access. The API response must be checked against the expected program ID `rahaf-perfume-store`.

## Implementation status (2026-11-28)

- [x] Add Rahaf Perfume Store to the GitHub OMNIX program catalog.
- [x] Add server-side activation-code issuance to the GitHub OMNIX Worker when a Rahaf subscription is saved. Codes use the `RAH-` prefix and are indexed under `omnix/activationCodes`.
- [x] Add public, read-only validation endpoint `POST /api/rahaf/validate`. It checks the code's exact program, subscription state, start/end dates, and global program status.
- [x] Show the generated code in OMNIX subscription records and provide a copy action.
- [x] Include activation-code index records in OMNIX owner backups.
- [ ] Update the AppDeploy storefront backend function `verifyRahafActivationCode` to call the new OMNIX validation endpoint instead of reading the legacy `control/rahaf` Firebase node.
- [ ] Deploy the storefront backend update and test active, paused, expired, invalid, and wrong-program codes end-to-end.

The GitHub Worker is deployed. The storefront backend has **not** yet been updated, so the new codes are not accepted by the live store until that final integration step is deployed and tested. Existing store data, accounts, products, orders, and media remain untouched.

**Deployment constraint:** AppDeploy's Free daily deployment-credit budget was below the required minimum during this session. The storefront source was inspected, but its deployment was not attempted or changed. Resume the backend update after the AppDeploy daily credit reset.
