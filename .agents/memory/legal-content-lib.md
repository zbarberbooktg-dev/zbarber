---
name: Shared legal content lib
description: Where CGU and privacy policy live, and how mobile + vitrine consume them.
---

CGU and privacy policy text is a shared workspace lib (`@workspace/legal-content` at `lib/legal-content`), not duplicated per artifact.

**Why:** Vitrine and mobile both display the same legal docs. Earlier the content was inlined in `vitrine/src/lib/i18n.tsx` (as `t.terms.s1`, `t.terms.s1p`, `t.terms.s1l`...) and any change required edits in two places, with no compiler help to catch drift.

**How to apply:**
- To edit legal text or add a section: edit `lib/legal-content/src/index.ts`. Both consumers pick it up automatically.
- Shape: `Record<"fr" | "en", { terms: LegalDoc; privacy: LegalDoc }>` where `LegalDoc = { title, lastUpdated, sections: { heading, body?, list? }[] }`.
- Mobile renders via `components/LegalScreen.tsx` (routes at `app/legal/terms.tsx` and `app/legal/privacy.tsx`). Vitrine renders via `pages/terms.tsx` / `pages/privacy.tsx` looping on `doc.sections`.
- To add a new language: extend the `LegalLang` union and add a key to `LEGAL`. The vitrine `Lang` and mobile `Lang` types must include the same key or you'll get a TS error at the `LEGAL[lang]` lookup.
- Do NOT re-introduce `t.terms.s1p` style keys in any i18n file — they were removed in May 2026 cleanup.
