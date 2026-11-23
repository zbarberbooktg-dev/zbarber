import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { SignOutButton } from "@/components/SignOutButton";
import { salonReservationHref } from "@/lib/reservationRoute";

export function SessionTransition({ signingOut = false }: { signingOut?: boolean }) {
  const c = useColors();
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: c.background }}>
    <ActivityIndicator color={c.primary} />
    <Text style={{ color: c.foreground, marginTop: 16 }}>{signingOut ? "Déconnexion en cours…" : "Vérification de votre session…"}</Text>
  </View>;
}

/** Keep forms/modals mounted on logout failure, but block all private interaction. */
export function SessionTransitionBoundary({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} pointerEvents={busy ? "none" : "auto"} accessibilityElementsHidden={busy} importantForAccessibility={busy ? "no-hide-descendants" : "auto"}>
      {children}
    </View>
    {busy && <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 100 }}>
      <SessionTransition signingOut />
    </View>}
  </View>;
}

/** Never offer a password submission while Clerk already has an active session. */
export function ActiveSessionGate({ bookingSalon }: { bookingSalon?: string } = {}) {
  const c = useColors();
  const { user, syncing, authSyncError, syncAuth, signingOut, suspendedNotice } = useApp();
  if (signingOut) return <SessionTransition signingOut />;
  if (user && !suspendedNotice) return <Redirect href={salonReservationHref(bookingSalon) ?? (user.role === "barber" || user.role === "admin" ? "/(barber)" : "/(client)")} />;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 16, backgroundColor: c.background }}>
      {syncing && <ActivityIndicator color={c.primary} />}
      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" }}>
        {suspendedNotice ? "Ce compte est suspendu" : "Une session est déjà ouverte"}
      </Text>
      <Text style={{ color: c.mutedForeground, textAlign: "center" }}>
        {suspendedNotice ? "Fermez cette session pour changer de compte. Contactez l’administration pour ce compte suspendu." : authSyncError ? "Votre profil n’a pas pu être chargé. Vérifiez votre connexion puis réessayez, ou déconnectez-vous pour changer de compte." : syncing ? "Chargement de votre profil…" : "Reprenez votre session pour continuer, ou déconnectez-vous pour changer de compte."}
      </Text>
      {!syncing && !suspendedNotice && <Pressable testID="resume-active-session" onPress={() => { void syncAuth().catch(() => {}); }} style={{ padding: 14, backgroundColor: c.primary, borderRadius: c.radius }}>
        <Text style={{ color: c.primaryForeground }}>Reprendre ma session</Text>
      </Pressable>}
      <SignOutButton />
    </View>
  );
}
