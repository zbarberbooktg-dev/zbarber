import React from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

/** Navigation belongs to the session guards, not each logout button. */
export function SignOutButton() {
  const c = useColors();
  const { signOut, signingOut, signOutError, t, lang } = useApp();
  return (
    <View>
      <Button
        label={signingOut ? (lang === "fr" ? "Déconnexion en cours…" : "Signing out…") : t.signOut}
        variant="ghost"
        icon="log-out"
        loading={signingOut}
        disabled={signingOut}
        onPress={() => { void signOut().catch(() => {}); }}
      />
      {signOutError && <Text accessibilityRole="alert" style={{ color: c.destructive, marginTop: 8 }}>{signOutError}</Text>}
    </View>
  );
}
