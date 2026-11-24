import { Redirect } from "expo-router";
import React from "react";

// Tab placeholder: the Explore tab press is intercepted in (client)/_layout and
// pushes the public /salons catalog. This only renders on a direct deep link.
export default function ClientExplore() {
  return <Redirect href="/salons" />;
}
