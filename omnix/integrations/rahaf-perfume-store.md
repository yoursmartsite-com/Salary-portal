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

## Important implementation status

- [x] Add Rahaf Perfume Store to `omnix/programs.json`.
- [x] Record the deployed AppDeploy application ID and live URL.
- [ ] Seed/register the same program in the AppDeploy-hosted OMNIX database.
- [ ] Correct OMNIX entitlement lookup to find a subscription by its `activationCode` (the current implementation incorrectly tries to use the code as the database record ID).
- [ ] Integrate the storefront with entitlement validation and enforce the result server-side for protected customer/order operations.
- [ ] Test active, paused, expired, invalid, and wrong-app codes end-to-end.

**Do not claim subscription enforcement is active until all unchecked integration and test steps are complete.** The existing Rahaf store must remain online and retain its current data during integration.
