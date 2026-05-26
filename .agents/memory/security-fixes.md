---
name: Security fixes
description: IDOR gallery delete fix; client reservation status constraint; owner email removed from public barber detail.
---

# Security Fixes Applied

## Gallery Delete IDOR
`DELETE /barbers/:barberId/gallery/:photoId` must scope the delete by BOTH `barberId` AND `photoId` to prevent cross-barber photo deletion.

```ts
await db.delete(galleryPhotosTable).where(
  and(eq(galleryPhotosTable.id, photoId), eq(galleryPhotosTable.barberId, barberId))
);
```

**Why:** Without the `barberId` scope, any barber who knows a photoId can delete another barber's photo.

## Reservation Status Privilege
Clients may only set status = `"cancelled"` on their own reservations. Barbers and admins can set any status.

```ts
const allowedStatuses = user.role === "client"
  ? (["cancelled"] as const)
  : (["pending", "confirmed", "cancelled", "completed"] as const);
```

**Why:** Without this, a client could mark their reservation as `"completed"` and trigger revenue calculations incorrectly.

## Owner Email Removed from Public Endpoint
`barberWithDetails()` no longer returns `ownerEmail`. Only `ownerName` is included in public barber profile responses.

**Why:** Exposing the barber's account email via a public unauthenticated endpoint is a PII leak.
