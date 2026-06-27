---
name: Orphan upload cleanup sweep
description: How abandoned presigned-PUT uploads (financing IDs, avatars, etc.) get garbage-collected.
---

# Orphan upload cleanup sweep

Presigned PUT (`getObjectEntityUploadURL`) creates the object under the private
`uploads/` prefix BEFORE any DB row references it. If a form is abandoned (e.g. a
barber uploads ID + guarantor ID in the financing form then closes it without
submitting), the file stays in storage forever. A daily `setInterval` sweep
(`lib/orphanUploadCleanup.ts`, started from `index.ts`) deletes orphans.

## Rules

- **Sweep targets only the `uploads/` prefix.** Every app upload lands there, so
  that's the only place orphans accumulate. `listUploadedObjects()` lists it;
  `deleteObjectByPath()` removes one object (both in `objectStorage.ts`).
- **The "referenced" set must list EVERY column that can hold an `/objects/...`
  path**, or the sweep deletes a live asset. As of writing: financing
  (documents[], idDocument, guarantorIdDocument), barbers (logoUrl, documentUrl),
  users (avatarUrl), gallery photoUrl, home-gallery imageUrl, services photoUrl,
  articles coverImageUrl, serviceRealisations (beforeUrl, afterUrl), panoramas
  imageUrl. Keep `collectReferencedPaths()` in sync with `routes/storage.ts` ACL
  classification whenever a new upload category is added.
  - **Why:** services.photoUrl is referenced but was historically MISSING from
    the storage ACL — don't assume the ACL list is complete; enumerate from the
    schema.
- **Grace period (24h) protects in-flight uploads.** An object newer than the
  grace period is skipped even if unreferenced, because a form may still be open
  and about to persist it. The presigned URL only lives 15 min, so 24h is safe.
- Path mapping is the inverse of `normalizeObjectEntityPath` /
  `getObjectEntityFile`: stored path is `/objects/uploads/<uuid>`, bucket object
  name is `<private-prefix>/uploads/<uuid>`. `createdAt` comes from GCS
  `metadata.timeCreated` (always present in list responses).
