import { Feather } from "@expo/vector-icons";
import { getGetMyBarbersQueryKey, useGetMyBarbers, type Barber } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { SignOutButton } from "@/components/SignOutButton";
import { EditProfileModal } from "@/components/EditProfileModal";
import { EditSalonLocationModal } from "@/components/EditSalonLocationModal";
import { Avatar, Button, Card } from "@/components/UI";
import { useApp, type ThemePref } from "@/contexts/AppContext";
import type { Lang } from "@/constants/i18n";
import { useColors } from "@/hooks/useColors";
import { setBrowsing } from "@/lib/browseIntent";
import { coordinates } from "@/lib/salonSearch";

export default function BarberProfile() {
  const c = useColors();
  const router = useRouter();
  const { themePref, setThemePref, lang, setLang, t, user, selectedSalonId } = useApp();
  const qc = useQueryClient();
  const { data: myBarbers, refetch, isLoading, isError } = useGetMyBarbers({ query: {
    queryKey: getGetMyBarbersQueryKey(), staleTime: 0, refetchOnMount: "always",
  } });
  const barber = myBarbers?.find((salon) => salon.id === selectedSalonId) ?? myBarbers?.[0] ?? null;
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editingSalonId, setEditingSalonId] = useState<number | null>(null);
  const editingSalon = myBarbers?.find((salon) => salon.id === editingSalonId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));

  const themeOptions: Array<{ key: ThemePref; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { key: "system", label: t.themeAuto, icon: "smartphone" },
    { key: "light", label: t.themeLight, icon: "sun" },
    { key: "dark", label: t.themeDark, icon: "moon" },
  ];

  const langOptions: Array<{ key: Lang; label: string }> = [
    { key: "fr", label: "Français" },
    { key: "en", label: "English" },
  ];

  const SectionLabel = ({ label }: { label: string }) => (
    <Text
      style={{
        color: c.mutedForeground,
        fontFamily: "Inter_600SemiBold",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {label}
    </Text>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
    >
      <DocumentUploadCard />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={user?.name ?? barber?.salonName ?? t.mySalon} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {user?.name ?? t.mySalon}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {user?.email ?? t.barberAccount}
            </Text>
          </View>
          <Pressable
            onPress={() => setEditProfileOpen(true)}
            hitSlop={10}
            style={({ pressed }) => ({
              padding: 8,
              borderRadius: c.radius - 4,
              backgroundColor: pressed ? c.accent : "transparent",
            })}
          >
            <Feather name="edit-2" size={18} color={c.primary} />
          </Pressable>
        </View>
      </Card>

      <View>
        <SectionLabel label={lang === "fr" ? "Mes salons" : "My salons"} />
        {isError && <Pressable onPress={() => refetch()}><Text style={{ color: c.destructive }}>Impossible de charger le salon. Réessayer</Text></Pressable>}
        {myBarbers?.map((salon) => (
        <View key={salon.id} style={{ gap: 10, marginBottom: 12 }}>
        {!coordinates(salon.latitude, salon.longitude) && (
          <Card>
            <View testID={`salon-position-reminder-${salon.id}`} style={{ gap: 8 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                {lang === "fr" ? `${salon.salonName} n’apparaît pas sur la carte` : `${salon.salonName} is not on the map`}
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 13, lineHeight: 18 }}>
                {lang === "fr"
                  ? "Confirmez la position réelle du salon pour aider les clients à le trouver. Vous pouvez continuer à utiliser votre espace sans le faire maintenant."
                  : "Confirm the real salon location to help clients find it. You can keep using your account without doing this now."}
              </Text>
              <Pressable testID={`salon-position-edit-${salon.id}`} accessibilityRole="button"
                onPress={() => setEditingSalonId(salon.id)} style={{ paddingVertical: 10 }}>
                <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
                  {lang === "fr" ? "Positionner ce salon" : "Set this salon’s location"}
                </Text>
              </Pressable>
            </View>
          </Card>
        )}
        <Pressable testID={`edit-salon-${salon.id}`} disabled={isLoading} onPress={() => setEditingSalonId(salon.id)}>
          {({ pressed }) => (
            <Card style={{ opacity: pressed ? 0.85 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
                }}>
                  <Feather name="map-pin" size={18} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    {salon.salonName}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {[salon.neighborhood, salon.city].filter(Boolean).join(", ") || "Ville non renseignée"}
                  </Text>
                  {salon.address && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {salon.address}
                    </Text>
                  )}
                  <Text style={{ color: c.primary, fontSize: 12, marginTop: 4 }}>
                    {coordinates(salon.latitude, salon.longitude) ? "Position GPS enregistrée · Modifier" : "Définir la position GPS et le logo"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={c.mutedForeground} />
              </View>
            </Card>
          )}
        </Pressable>
        </View>
        ))}
      </View>

      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        initialName={user?.name ?? ""}
        initialPhone={user?.phone ?? ""}
      />

      {editingSalon && <EditSalonLocationModal
        key={editingSalon.id}
        salonId={editingSalon.id}
        salonName={editingSalon.salonName}
        visible
        onClose={() => setEditingSalonId(null)}
        initial={{
          country: editingSalon.country ?? null,
          city: editingSalon.city,
          neighborhood: editingSalon.neighborhood,
          address: editingSalon.address,
          phone: editingSalon.phone,
          whatsapp: editingSalon.whatsapp,
          latitude: editingSalon.latitude,
          longitude: editingSalon.longitude,
          logoUrl: editingSalon.logoUrl,
        }}
        onSaved={(saved) => {
          qc.setQueryData<Barber[]>(getGetMyBarbersQueryKey(), (salons) =>
            salons?.map((salon) => salon.id === saved.id ? { ...salon, ...saved } : salon));
        }}
      />}

      <View>
        <SectionLabel label={t.appearance} />
        <Card style={{ flexDirection: "row", gap: 8, padding: 8 }}>
          {themeOptions.map((opt) => {
            const active = themePref === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setThemePref(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: c.radius - 4,
                  backgroundColor: active ? c.accent : "transparent",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Feather name={opt.icon} size={18} color={active ? c.primary : c.mutedForeground} />
                <Text
                  style={{
                    color: active ? c.primary : c.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionLabel label={t.language} />
        <Card style={{ flexDirection: "row", gap: 8, padding: 8 }}>
          {langOptions.map((opt) => {
            const active = lang === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setLang(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: c.radius - 4,
                  backgroundColor: active ? c.accent : "transparent",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: active ? c.primary : c.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionLabel label={t.account} />
        <View style={{ gap: 10 }}>
          <Button
            label={lang === "fr" ? "Accueil" : "Home"}
            variant="secondary"
            icon="home"
            onPress={() => {
              setBrowsing(true);
              router.push("/browse");
            }}
          />
          <Button
            label={(t as any).legalTerms ?? "Conditions d'utilisation"}
            variant="ghost"
            icon="file-text"
            onPress={() => router.push("/legal/terms")}
          />
          <Button
            label={(t as any).legalPrivacy ?? "Politique de confidentialité"}
            variant="ghost"
            icon="shield"
            onPress={() => router.push("/legal/privacy")}
          />
          <SignOutButton />
          <Button
            label={(t as any).deleteAccount ?? "Supprimer mon compte"}
            variant="ghost"
            icon="trash-2"
            onPress={() => setDeleteOpen(true)}
          />
        </View>
      </View>
      <DeleteAccountModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </ScrollView>
  );
}
