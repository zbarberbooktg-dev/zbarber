// Dedicated, unambiguous route for the public home.
//
// app/index.tsx ("/") is shared by (barber)/index and (client)/index because
// route groups are non-URL segments, so router.replace("/") from inside a group
// resolves to that group's own index instead of the root gate. This "/browse"
// route has a unique path, so any group can reach the public home reliably
// (same pattern as sign-out's router.replace("/role-select")).
export { default } from "./index";
