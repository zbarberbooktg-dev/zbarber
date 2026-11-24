import { Feather } from "@expo/vector-icons";
import { getGetSupportLinksQueryKey, useGetSupportLinks } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";

type Row = {
  key: string;
  label: string;
  hint?: string;
  icon: keyof typeof Feather.glyphMap;
  external?: boolean;
  onPress: () => void;
};

/** Assistance card shared by client and barber profiles. */
export function SupportCard() {
  const c = useColors();
  const router = useRouter();
  const { lang, t } = useApp();
  const fr = lang === "fr";
  const links = useGetSupportLinks({ query: { queryKey: getGetSupportLinksQueryKey(), staleTime: 30_000, refetchOnMount: "always" } });

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(fr ? "Lien indisponible" : "Link unavailable", fr ? "Impossible d'ouvrir ce lien." : "This link could not be opened.");
    }
  };

  const d = links.data;
  const rows: Row[] = [
    {
      key: "ticket",
      label: fr ? "Assistant de création de ticket" : "Support ticket assistant",
      hint: fr ? "Écrivez à l'équipe, suivez les réponses" : "Write to the team, follow replies",
      icon: "message-square",
      onPress: () => router.push("/support"),
    },
  ];
  if (d?.whatsapp) rows.push({ key: "whatsapp", label: fr ? "Support WhatsApp" : "WhatsApp support", icon: "phone", external: true, onPress: () => open(`https://wa.me/${d.whatsapp!.replace(/\D/g, "")}`) });
  if (d?.tiktok) rows.push({ key: "tiktok", label: "TikTok", icon: "music", external: true, onPress: () => open(d.tiktok!) });
  if (d?.instagram) rows.push({ key: "instagram", label: "Instagram", icon: "instagram", external: true, onPress: () => open(d.instagram!) });
  if (d?.facebook) rows.push({ key: "facebook", label: "Facebook", icon: "facebook", external: true, onPress: () => open(d.facebook!) });
  rows.push(
    { key: "privacy", label: (t as any).legalPrivacy ?? (fr ? "Politique de confidentialité" : "Privacy policy"), icon: "shield", onPress: () => router.push("/legal/privacy") },
    { key: "terms", label: (t as any).legalTerms ?? (fr ? "Conditions d'utilisation" : "Terms of use"), icon: "file-text", onPress: () => router.push("/legal/terms") },
  );

  return (
    <View testID="support-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 3 }}>
        <Feather name="help-circle" size={16} color={c.primary} />
        <Text accessibilityRole="header" style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
          {fr ? "Assistance" : "Support"}
        </Text>
      </View>
      <View style={{ backgroundColor: c.card, borderRadius: c.radius + 4, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
        {rows.map((row, i) => (
          <React.Fragment key={row.key}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.border, marginLeft: 64 }} />}
            {row.key === "privacy" && links.isLoading && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={c.mutedForeground} />
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{fr ? "Chargement des contacts..." : "Loading contacts..."}</Text>
              </View>
            )}
            {row.key === "privacy" && links.isError && (
              <Pressable testID="support-links-retry" accessibilityRole="button" onPress={() => links.refetch()}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: 48, backgroundColor: pressed ? c.muted : "transparent" })}>
                <Feather name="alert-circle" size={16} color={c.destructive} />
                <Text style={{ flex: 1, color: c.mutedForeground, fontSize: 13 }}>{fr ? "Contacts indisponibles." : "Contacts unavailable."}</Text>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{fr ? "Réessayer" : "Retry"}</Text>
              </Pressable>
            )}
            {row.key === "privacy" && (links.isLoading || links.isError) && <View style={{ height: 1, backgroundColor: c.border, marginLeft: 64 }} />}
            <Pressable testID={`support-row-${row.key}`} accessibilityRole={row.external ? "link" : "button"} onPress={row.onPress}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56, backgroundColor: pressed ? c.muted : row.key === "ticket" ? c.accent : "transparent" })}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
                <Feather name={row.icon} size={17} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{row.label}</Text>
                {row.hint && <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 2 }}>{row.hint}</Text>}
              </View>
              <Feather name={row.external ? "external-link" : "chevron-right"} size={17} color={c.mutedForeground} />
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
