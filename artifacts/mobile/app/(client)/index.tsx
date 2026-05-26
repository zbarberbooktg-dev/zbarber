import { Redirect } from "expo-router";
import React from "react";

// The public discover screen is now the root home at app/index.tsx.
// The (client) tab group handles auth-gated features: bookings + profile.
export default function ClientIndex() {
  return <Redirect href="/(client)/bookings" />;
}
