---
name: Clerk production proxy setup (custom domain)
description: How to register/verify a Clerk production Frontend-API proxy on a self-hosted domain, and why the dashboard form fails.
---

# Registering a Clerk production Frontend-API proxy

A fresh Clerk **production** instance defaults to **CNAME mode**: `GET /v1/domains` (Backend API, `Authorization: Bearer sk_live_…`) shows `frontend_api_url=https://clerk.<domain>`, `cname_targets` all `required:true`, and **no `proxy_url` field**. Until a `proxy_url` is registered, every FAPI request through your proxy returns `400 host_invalid` ("unable to attribute this request to an instance… check your Publishable Key"). **That error is EXPECTED before registration — it is NOT a proxy/code bug.** `/v1/proxy-health` returns `400 bad_request` in the same pre-registration state.

## The dashboard "Use proxy" form is unreliable
Its pre-save validation can fail ("Clerk Frontend API cannot be accessed through the proxy URL") even when nginx → Express proxy → Clerk FAPI all work correctly. Don't trust it.

## Fix: set `proxy_url` directly via the Backend API (same effect, no buggy pre-flight)
```
PATCH https://api.clerk.com/v1/domains/<dmn_id>
Authorization: Bearer sk_live_…
{"proxy_url":"https://<proxy-host>/<path>"}
```
On success the response shows `proxy_url` + `frontend_api_url` both = the proxy URL, and the `clerk.`/`accounts.` cname_targets flip to `required:false`. Then `GET https://<proxy-host>/<path>/v1/environment` and `/.well-known/jwks.json` return **200**.

**Why:** the proxy plumbing was never the problem; the instance simply had no `proxy_url` and the dashboard wouldn't persist one. The PATCH persists it directly.

## How to apply / diagnose order
1. Confirm proxy reaches Clerk: a proxied request shows `frontend-api.clerk.dev` cookies + `x-clerk-trace-id` (chain works even on 400).
2. Confirm key valid + instance active: `GET https://api.clerk.com/v1/instance` with the `sk_live_` → 200.
3. Confirm the deployed build injects the headers: grep the deployed bundle for `Clerk-Proxy-Url`/`Clerk-Secret-Key`.
4. If all 3 pass but FAPI still 400s → it's just the missing `proxy_url`. PATCH it.

The proxy host must equal the domain `name` (e.g. `zbarber.net`). DKIM + `clkmail` cname_targets stay `required:true` regardless of proxy mode — they are for verification **emails** from the domain, still needed since the app uses email_code sign-in.

## Native API must be enabled separately (the `@clerk/expo` white-screen trap)
A Clerk **production** instance ships with the **Native API DISABLED** (dev instances have it on). `@clerk/expo` calls FAPI with `_is_native=1`, so Clerk returns `400 {"errors":[{"message":"Native API disabled"}]}`, clerk-js never finishes `load()`, `useAuth().isLoaded` stays `false` forever, and every screen gated on `isLoaded` renders blank → **white screen after splash**.

**Why it's a trap:** a plain server-side `curl` of the proxy FAPI returns 200 (it omits `_is_native=1`), so the proxy looks 100% healthy. The failure only reproduces from a native client. To reproduce from anywhere, append `&_is_native=1` to the FAPI env URL.

**Fix (independent of proxy_url):** Dashboard → Production instance → Configure → Native Applications → toggle Native API ON. Or Backend API: `PATCH https://api.clerk.com/v1/instance` `Authorization: Bearer sk_live_…` body `{"enable_native_api": true}` → 200.

**How to diagnose isLoaded-stuck-false on device:** log gate flags (`isLoaded/isSignedIn/storageReady/initialSyncDone`); if `isLoaded:false` + `isSignedIn:undefined` persist, fetch the proxy FAPI env URL with `_is_native=1` from inside the app and read the status/body — `400 Native API disabled` is the tell.
