---
name: MetaApi client API URL
description: The correct MetaApi client REST API URL uses agiliumtrade.ai not agiliumtrade.agiliumtrade.ai, and must include the account region as subdomain.
---

# MetaApi Client API URL Fix

## The Rule
The MetaApi client REST API URL is `https://mt-client-api-v1.{region}.agiliumtrade.ai`.
- **Correct domain**: `agiliumtrade.ai`
- **Wrong domain**: `agiliumtrade.agiliumtrade.ai` (all paths return SSL errors or nginx 404)

## Why
The correct domain is returned dynamically by:
`GET https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/servers/mt-client-api`
→ returns `{ "domain": "agiliumtrade.ai", ... }`

The account region (e.g. `"london"`) is returned by:
`GET https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/{id}`
→ returns `{ "region": "london", ... }`

So the full deals URL is:
`https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/{id}/history-deals/time/{start}/{end}`

## How to Apply
- `metaapi.ts` has `getClientApiDomain()` that calls the provisioning API and caches the domain for 10 minutes.
- `getDeals()` calls `getClientApiDomain()` and `getMetaApiAccount()` in parallel to build the correct URL.
- No SSL bypass needed — the regional endpoint has a valid certificate.

## Additional Notes
- `metaapi.cloud-sdk` npm package is blocked by Replit firewall (crypto-js dependency).
- `metaapi.cloud-metastats-sdk` can be installed (no crypto-js) but MetaStats feature needs to be enabled per-account via MetaApi web UI.
- The provisioning API at `mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai` works fine (valid cert, correct domain).
