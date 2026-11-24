import { Feather } from "@expo/vector-icons";
import { Redirect, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { SignOutButton } from "@/components/SignOutButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";

export default function BarberPending() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, barberProfile, syncAuth } = useApp();
  useFocusEffect(useCallback(() => {
    void syncAuth().catch(() => {});
    // syncAuth closes over Clerk's unstable getToken; key by account, not function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]));

  const isSuspended = user?.status === "suspended" || barberProfile?.status === "suspended";
  const isRejected = barberProfile?.status === "rejected";
  if (barberProfile?.status === "approved" && !isSuspended) return <Redirect href="/(barber)" />;

  const headerColor = isSuspended ? c.destructive : c.primary;
  const headerIcon = isSuspended || isRejected ? "alert-circle" : "clock";
  const headerTitle = isSuspended
    ? "Compte suspendu"
    : isRejected
      ? "Salon non approuvé"
      : "En attente de validation";
  const headerDesc = isSuspended
    ? "Votre compte barbier a été suspendu. Contactez l'administration pour plus d'informations."
    : isRejected
      ? barberProfile?.rejectionReason || "Votre demande n'a pas été approuvée. Contactez l'administration pour plus d'informations."
      : "Votre salon est en cours d'examen par l'équipe Zbarber. Un administrateur doit l'approuver. Les documents professionnels sont facultatifs et ne conditionnent pas cette décision.";

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingTop: insets.top + 24,
        backgroundColor: c.background,
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: headerColor + "20",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Feather name={headerIcon} size={32} color={headerColor} />
        </View>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: c.foreground, marginBottom: 8, textAlign: "center" }}>
          {headerTitle}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            color: c.mutedForeground,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          {headerDesc}
        </Text>
      </View>

      <DocumentUploadCard />

      <View
        style={{
          backgroundColor: c.card,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <Text style={{ fontFamily: "Inter_600SemiBold", color: c.foreground, marginBottom: 8 }}>
          Votre profil
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, marginBottom: 4 }}>
          {user?.name}
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground }}>
          {user?.email}
        </Text>
      </View>

      <SignOutButton />
    </ScrollView>
  );
}
