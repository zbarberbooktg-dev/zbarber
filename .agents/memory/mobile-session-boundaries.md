---
name: Mobile session boundaries
description: Why logout, account-switch caches and post-finalize profile synchronization must follow the actual Clerk session
---

Clerk is the authority for whether the mobile account is signed in; a missing business profile does not mean the session ended.

**Why:** clearing the local profile before SDK sign-out finishes can present a password form while Clerk still has an active session, producing “already signed in” after a failed logout.

**How to apply:** keep private profile state until revocation is confirmed, block duplicate logout attempts, and present an active-session recovery view when profile synchronization fails. Invalidate late asynchronous profile writes when logout starts, even if the retained profile remains visible after failure. Clear private query caches and salon selection on actual session/account boundaries, including account changes that leave `isSignedIn` true. Keep public home independent of SDK loading.

Push cleanup must be bounded and secondary to logout. If unregistering succeeds but logout fails, restore registration for the surviving account.

**Why:** notification cleanup must neither indefinitely block sign-out nor silently disable notifications for an account that remains signed in.

**How to apply:** cancel stale push registrations across identities, do not reuse an old account's token getter after awaiting, and restore push registration after failed revocation.

Signup finalization can request profile synchronization before the new SDK session is reflected by React.

**Why:** rejecting solely because the previous render has no authenticated identity can discard signup profile fields despite successful email verification.

**How to apply:** allow a short, bounded wait for the activated session to reach the provider before synchronizing. Preserve the single-navigation-owner rule in the separate finalize navigation note.
