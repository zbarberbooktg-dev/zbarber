---
name: Rebrand & contact/admin-notify config
description: How the app brand name, public contact email, and admin notification email are wired — and what must NOT be renamed on a rebrand.
---

# Brand name

The product is branded **Zbarber** (was "Global Barber Corp"). User-facing brand strings live in: mobile `app.json` name + auth/home/onboarding/pending screens + `constants/i18n.ts`; admin `index.html` + `src/lib/i18n.tsx` brand; vitrine `index.html` + Navbar/Footer (logo badge "ZB" + "ZBARBER") + `src/lib/i18n.tsx`; `lib/legal-content`; OpenAPI `info.description` (NOT `info.title`, which is "Api" and controls codegen filenames).

# Rebrand rule: do NOT rename internal keys

**Rule:** On any rebrand, leave internal storage/cookie/CSS identifiers untouched — only change user-visible strings.
**Why:** Renaming them logs out users/admins and resets saved state. Specifically: AsyncStorage keys `gbc.theme` / `gbc.lang` / `gbc.onboarding.v1` (mobile), admin session cookie `gbc_admin`, localStorage `gbc-admin-lang` / `gbc-lang` / `gbc-theme`, and CSS classes `gbc-pin` / `gbc-user` (map). These still carry the old "gbc" prefix by design.
**How to apply:** When asked to rename again, grep case-insensitively for the brand AND check whether each hit is a persisted key/cookie/CSS class before editing.

# Contact + admin notifications

- Public contact email is **zbarberbook@gmail.com** (vitrine contact block as `mailto:`, legal-content privacy FR/EN).
- Admin notification email: `notifyAdmin(subject, text)` in `artifacts/api-server/src/lib/email.ts` sends to `ADMIN_NOTIFICATION_EMAIL` (env override, defaults to zbarberbook@gmail.com). It is **fire-and-forget** (no await, catches internally) so a mail failure never breaks the originating request; if SMTP is unconfigured `sendEmail` just logs.
- Wired at: new barber registration (`POST /barbers/me`), financing requests (`POST /barbers/me/financing` and `POST /financing-requests`), and public account-deletion request (`POST /account-deletion-requests`). Add a `notifyAdmin(...)` call at any new admin-relevant event.
