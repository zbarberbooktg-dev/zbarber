import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { CreateSalonModal } from "@/components/CreateSalonModal";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { SupportCard } from "@/components/SupportCard";
import { SignOutButton } from "@/components/SignOutButton";
import { ProfileIdentity, ProfilePreferences, ProfileSectionTitle } from "@/components/ProfileSections";
import { Button, Card } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { setBrowsing } from "@/lib/browseIntent";

export default function ClientProfile() {
  const c = useColors();
  const router = useRouter();
  const { lang, syncAuth, t, user, barberProfile } = useApp();
  const fr = lang === "fr";
  const params = useLocalSearchParams<{ becomeBarber?: string }>();
  const fetcher = useAuthedFetch();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createSalonOpen, setCreateSalonOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  // Becoming a barber is an admin-validated request: the user submits a salon,
  // and only an admin approval activates barber mode. There is no self-promotion.
  const hasPendingBarberRequest = barberProfile?.status === "pending" || barberProfile?.status === "awaiting_document";
  useFocusEffect(useCallback(() => {
    void syncAuth().catch(() => {});
    // Refresh admin approval on return without depending on the unstable token getter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]));

  // Auto-open the salon request form when navigated here with ?becomeBarber=1
  // (e.g. right after choosing "barber" at sign-up).
  useEffect(() => {
    if (params.becomeBarber === "1" && !barberProfile?.id) {
      setCreateSalonOpen(true);
    }
  }, [params.becomeBarber, barberProfile?.id]);

  const handleRefreshLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(fr ? "Permission refusée" : "Permission denied", fr ? "Autorisez la géolocalisation dans vos réglages." : "Allow location access in Settings.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetcher("/api/users/me/location", {
        method: "POST",
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      await syncAuth();
      Alert.alert(fr ? "Position mise à jour" : "Location updated");
    } catch (e: any) {
      Alert.alert(fr ? "Erreur" : "Error", e?.message ?? (fr ? "Impossible d’actualiser la position." : "Unable to update your location."));
    } finally {
      setLocating(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 48 }}
    >
      <ProfileIdentity name={user?.name ?? t.myAccount} email={user?.email} role={t.clientAccount} onEdit={() => setEditOpen(true)} />

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        initialName={user?.name ?? ""}
        initialPhone={user?.phone ?? ""}
      />
      {hasPendingBarberRequest && <DocumentUploadCard />}

      <View>
        <ProfileSectionTitle label={fr ? "Votre position" : "Your location"} icon="map-pin" />
        <Card style={{ borderRadius: c.radius + 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Feather name="map-pin" size={18} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                {user?.city ? `${user.city}${user.country ? ", " + user.country : ""}` : (fr ? "Non renseignée" : "Not set")}
              </Text>
              {user?.latitude && user?.longitude ? (
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                  GPS : {Number(user.latitude).toFixed(3)}, {Number(user.longitude).toFixed(3)}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleRefreshLocation}
              accessibilityRole="button"
              accessibilityState={{ busy: locating, disabled: locating }}
              disabled={locating}
              style={({ pressed }) => ({
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: c.radius - 4,
                backgroundColor: pressed ? c.accent : c.muted,
                flexDirection: "row", alignItems: "center", gap: 6,
              })}
            >
              <Feather name="refresh-cw" size={13} color={c.primary} />
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                 {locating ? (fr ? "En cours…" : "Updating…") : (fr ? "Actualiser" : "Refresh")}
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>

      <ProfilePreferences />
      <SupportCard />

      <View>
        <ProfileSectionTitle label={t.account} icon="settings" />
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
          {hasPendingBarberRequest ? (
            <Button
              label={(t as any).barberRequestPending ?? "Demande barbier en attente de validation"}
              variant="secondary"
              icon="clock"
              disabled
              onPress={() => {}}
            />
          ) : null}
          {user?.role === "barber" && (
            <Button label={lang === "fr" ? "Espace barbier" : "Barber workspace"} variant="secondary" icon="scissors" onPress={() => router.push("/(barber)")} />
          )}
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
      <CreateSalonModal
        visible={createSalonOpen}
        onClose={() => setCreateSalonOpen(false)}
        onCreated={async () => {
          setCreateSalonOpen(false);
          // No role activation here — the request now awaits admin validation.
          try { await syncAuth(); } catch { /* surfaced on next refresh */ }
          Alert.alert(
            (t as any).barberRequestSent ?? "Demande envoyée",
            (t as any).barberRequestSentBody ?? "Votre salon a été soumis. Un administrateur validera votre demande avant l'activation du mode barbier.",
          );
        }}
      />
    </ScrollView>
  );
}
