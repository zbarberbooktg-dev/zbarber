---
name: Orval numeric infinite-query typing
description: Numeric page parameters fail typechecking with this generator version's infinite-query output
---

Orval 8.9.1 infinite-query generation for a numeric `page` parameter emits a `QueryFunction` whose page parameter remains `unknown`, then passes it to a numeric request field. This fails TypeScript compilation.

**Why:** enabling infinite generation for the existing salon list exposed this mismatch; ordinary generated paginated queries remain correctly typed.

**How to apply:** do not hand-edit generated output or broaden the API contract to accept arbitrary pagination values. Compose the generated page queries in the shared client when a complete catalog is needed. Recheck the installed generator and its output before revisiting infinite generation after an upgrade.
