---
name: Articles (L'édito) feature
description: Admin-managed articles surfaced publicly on mobile; HTML sanitization + sortOrder model.
---

## Content sanitization
Article `contentHtml` is rendered on mobile with `react-native-render-html` and there is no DOM sandbox.
Server-side `sanitize-html` (in the create + update routes) is the only line of defense; mobile trusts what the API returns.

**Why:** users submit rich HTML via a TipTap editor on admin; without server sanitization a malicious admin (or any future write path) could inject `javascript:` links, custom schemes, or hostile tags. The allow-list is intentionally narrow (no `img`, no `style`, no `class` except span, schemes limited to http/https/mailto/tel).

**How to apply:** any new write path for `articles.contentHtml` MUST go through the same `sanitize()` helper. If the article model later accepts images inline, extend the allow-list explicitly; never widen to `allowedTags: false`.

## sortOrder model
New articles get `sortOrder = max(sortOrder) + 1` server-side, NOT `articles.length` client-side.

**Why:** deletes do not reindex, so client-side `length` produces colliding sort orders, which makes the swap-based reorder UI behave non-deterministically.

**How to apply:** when adding similar "manually ordered" lists (gallery, services, etc.), follow the same pattern — server computes append position, client only swaps existing values.

## Public visibility window
Public list/detail filter is `status='published' AND startsAt <= now AND (endsAt IS NULL OR endsAt > now)`.
Admin list shows everything regardless of window; the admin UI computes the "En ligne / Programmé / Brouillon" badge client-side from those same three fields.
