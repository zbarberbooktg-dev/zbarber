import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { CreateSalonModal } from "@/components/CreateSalonModal";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { Avatar, Button, Card } from "@/components/UI";
import { useApp, type ThemePref } from "@/contexts/AppContext";
import type { Lang } from "@/constants/i18n";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

export default function ClientProfile() {
  const c = useColors();
  const router = useRouter();
  const { themePref, setThemePref, lang, setLang, signOut, syncAuth, t, user } = useApp();
  const fetcher = useAuthedFetch();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createSalonOpen, setCreateSalonOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [switching, setSwitching] = useState(false);

  const activateBarberRole = async () => {
    await fetcher("/api/auth/active-role", { method: "POST", body: JSON.stringify({ role: "barber" }) });
    await syncAuth();
    router.replace("/(barber)");
  };

  const handleSwitchToBarber = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      await activateBarberRole();
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      // API returns "Create a barber profile first" (400) when the user has no salon yet.
      if (msg.toLowerCase().includes("barber profile")) {
        setCreateSalonOpen(true);
      } else {
        Alert.alert("Erreur", msg || "Impossible de basculer en mode barbier.");
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleRefreshLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission refusée", "Autorisez la géolocalisation dans vos réglages.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetcher("/api/users/me/location", {
        method: "POST",
        body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      await syncAuth();
      Alert.alert("Position mise à jour", "Merci !");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'actualiser la position.");
    } finally {
      setLocating(false);
    }
  };

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
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={user?.name ?? t.myAccount} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
              {user?.name ?? t.myAccount}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {user?.email ?? t.clientAccount}
            </Text>
          </View>
          <Pressable
            onPress={() => setEditOpen(true)}
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

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        initialName={user?.name ?? ""}
        initialPhone={user?.phone ?? ""}
      />

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
        <SectionLabel label="Position" />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Feather name="map-pin" size={18} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                {user?.city ? `${user.city}${user.country ? ", " + user.country : ""}` : "Non renseignée"}
              </Text>
              {user?.latitude && user?.longitude ? (
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                  GPS : {Number(user.latitude).toFixed(3)}, {Number(user.longitude).toFixed(3)}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleRefreshLocation}
              disabled={locating}
              style={({ pressed }) => ({
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: c.radius - 4,
                backgroundColor: pressed ? c.accent : c.muted,
                flexDirection: "row", alignItems: "center", gap: 6,
              })}
            >
              <Feather name="refresh-cw" size={13} color={c.primary} />
              <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {locating ? "..." : "Actualiser"}
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel label={t.account} />
        <View style={{ gap: 10 }}>
          <Button
            label={switching ? "..." : t.switchToBarber}
            variant="secondary"
            icon="refresh-cw"
            onPress={handleSwitchToBarber}
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
          <Button
            label={t.signOut}
            variant="ghost"
            icon="log-out"
            onPress={async () => {
              await signOut();
              router.replace("/role-select");
            }}
          />
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
          try { await activateBarberRole(); }
          catch (e: any) { Alert.alert("Erreur", e?.message ?? "Salon créé mais bascule impossible."); }
        }}
      />
    </ScrollView>
  );
}
