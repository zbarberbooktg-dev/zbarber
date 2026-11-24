import { Feather } from "@expo/vector-icons";
import { getGetMyBarbersQueryKey, useGetMyBarbers, type Barber } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { SupportCard } from "@/components/SupportCard";
import { SignOutButton } from "@/components/SignOutButton";
import { EditProfileModal } from "@/components/EditProfileModal";
import { EditSalonLocationModal } from "@/components/EditSalonLocationModal";
import { ProfileIdentity, ProfilePreferences, ProfileSectionTitle } from "@/components/ProfileSections";
import { Button, Card } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { setBrowsing } from "@/lib/browseIntent";
import { coordinates } from "@/lib/salonSearch";

export default function BarberProfile() {
  const c = useColors();
  const router = useRouter();
  const { lang, t, user, selectedSalonId } = useApp();
  const fr = lang === "fr";
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 48 }}
    >
      <ProfileIdentity name={user?.name ?? barber?.salonName ?? t.mySalon} email={user?.email} role={t.barberAccount} onEdit={() => setEditProfileOpen(true)} />
      <DocumentUploadCard />

      <View testID="profile-my-salons">
        <ProfileSectionTitle label={fr ? "Mes salons" : "My salons"} icon="scissors" />
        {isLoading && <ActivityIndicator color={c.primary} accessibilityLabel={fr ? "Chargement des salons" : "Loading salons"} />}
        {isError && <Pressable accessibilityRole="button" onPress={() => refetch()} style={{ paddingVertical: 12 }}><Text style={{ color: c.destructive }}>{fr ? "Impossible de charger les salons. Réessayer" : "Could not load salons. Retry"}</Text></Pressable>}
        {!isLoading && !isError && !myBarbers?.length && (
          <Card><Text style={{ color: c.mutedForeground }}>{fr ? "Aucun salon associé pour le moment." : "No salons linked yet."}</Text></Card>
        )}
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
        <Pressable testID={`edit-salon-${salon.id}`} accessibilityRole="button" disabled={isLoading} onPress={() => setEditingSalonId(salon.id)}>
          {({ pressed }) => (
            <Card style={{ opacity: pressed ? 0.85 : 1, borderRadius: c.radius + 6 }}>
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
                     {[salon.neighborhood, salon.city].filter(Boolean).join(", ") || (fr ? "Ville non renseignée" : "City not set")}
                  </Text>
                  {salon.address && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {salon.address}
                    </Text>
                  )}
                  <Text style={{ color: c.primary, fontSize: 12, marginTop: 4 }}>
                     {coordinates(salon.latitude, salon.longitude)
                       ? (fr ? "Position GPS enregistrée · Modifier" : "GPS location saved · Edit")
                       : (fr ? "Définir la position GPS et le logo" : "Set GPS location and logo")}
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

      <ProfilePreferences />
      <SupportCard />

      <View>
        <ProfileSectionTitle label={t.account} icon="settings" />
        <View style={{ gap: 10 }}>
          <Button
            label={lang === "fr" ? "Accueil" : "Home"}
            variant="primary"
            icon="home"
            onPress={() => {
              setBrowsing(true);
              router.push("/browse");
            }}
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
