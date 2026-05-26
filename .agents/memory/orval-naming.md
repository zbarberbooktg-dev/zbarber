---
name: Orval naming collision
description: Orval auto-generates response types named <OperationId>Response. Component schemas with the same name cause TS2308.
---

# Orval Naming Collision

## Rule
Never name a component schema `<OperationId>Response` — Orval generates an inline type with that exact name for the endpoint's response. If a component schema and the inline type share the name, `export *` in the barrel index causes TS2308 ("already exported a member").

**Why:** Orval emits inline response types AND separately emits component schema types. The barrel file re-exports both, causing ambiguity.

**How to apply:**
- If codegen fails with TS2308, check whether a component schema name matches `<operationId>Response`.
- Fix: rename the component schema to something unique (e.g. `SyncAuthResponse` → `AuthSyncResult` for operationId `syncAuth`).
- Update all `$ref` occurrences in the spec to point to the renamed schema before re-running codegen.
