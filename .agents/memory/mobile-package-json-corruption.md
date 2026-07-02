---
name: Mobile package.json BOM + text-replacement corruption
description: Why artifacts/mobile/package.json broke the whole pnpm workspace and how to detect/fix it
---

A bad off-Replit (Windows) text edit injected TWO problems into
`artifacts/mobile/package.json` (and the same into `pnpm-lock.yaml`):

1. A literal failed-`sed` artifact `$1 <commit-sha>` that replaced the
   `expo-build-properties` dependency entry (4 sites total: 1 in package.json,
   3 in pnpm-lock.yaml — importer spec, package resolution block, snapshot block).
2. A UTF-8 **BOM** (`EF BB BF`) prepended to the file.

**Symptoms / how to tell them apart:**
- `ERR_PNPM_JSON_PARSE ... Expected double-quoted property name` from *every*
  workflow = the `$1 <sha>` garbage (invalid JSON). Breaks the whole workspace
  because pnpm reads every package.json.
- After fixing the JSON, Expo alone fails with
  `JsonFileError: Error parsing JSON ... Unexpected token ''` = the BOM.

**Why:** pnpm tolerates a BOM in package.json, but Expo's `@expo/json-file`
parser does NOT — it throws on the leading BOM. So a BOM can pass pnpm and still
crash `expo start`.

**How to apply / fix:**
- Find all corruption sites: `rg -F '$1 <sha>' --hidden -g '!.git'`.
- Restore the clobbered dep line in package.json (version comes from
  `node_modules/.pnpm/` dir name — ground truth for what's installed).
- The lockfile's `resolution: {integrity: sha512-...}` hash can't be hand-written;
  regenerate with `pnpm install --lockfile-only` (node_modules already correct, so
  drift is minimal — only the restored entry changes).
- Strip the BOM: `perl -i -pe 's/^\xEF\xBB\xBF// if $. == 1' <file>`.
- Node's `JSON.parse` also chokes on a BOM — strip `^\uFEFF` before validating, or
  you'll misread a BOM as a syntax error.
