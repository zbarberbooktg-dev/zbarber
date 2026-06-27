import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { EditProfileModal } from "@/components/EditProfileModal";
import { EditSalonLocationModal } from "@/components/EditSalonLocationModal";
import { Avatar, Button, Card } from "@/components/UI";
import { useApp, type ThemePref } from "@/contexts/AppContext";
import type { Lang } from "@/constants/i18n";
import { useColors } from "@/hooks/useColors";

type MyBarber = {
  id: number;
  salonName: string;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export default function BarberProfile() {
  const c = useColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const { themePref, setThemePref, lang, setLang, signOut, t, user } = useApp();
  const { data: myBarbers, refetch } = useQuery<MyBarber[]>({
    queryKey: ["barbersMe"],
    queryFn: async () => {
      const token = await getToken();
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/barbers/me`, {
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const barber = myBarbers?.[0] ?? null;
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
        <SectionLabel label="Mon salon" />
        <Pressable onPress={() => setEditLocationOpen(true)}>
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
                    {barber?.salonName ?? "Configurer mon salon"}
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {[barber?.neighborhood, barber?.city].filter(Boolean).join(", ") || "Ville non renseignée"}
                  </Text>
                  {barber?.address && (
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {barber.address}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={18} color={c.mutedForeground} />
              </View>
            </Card>
          )}
        </Pressable>
      </View>

      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        initialName={user?.name ?? ""}
        initialPhone={user?.phone ?? ""}
      />

      <EditSalonLocationModal
        visible={editLocationOpen}
        onClose={() => setEditLocationOpen(false)}
        initial={{
          country: (barber as any)?.country ?? null,
          city: barber?.city,
          neighborhood: barber?.neighborhood,
          address: barber?.address,
          phone: barber?.phone,
          whatsapp: barber?.whatsapp,
        }}
        onSaved={() => {
          refetch();
        }}
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
        <SectionLabel label={t.account} />
        <View style={{ gap: 10 }}>
          <Button
            label={lang === "fr" ? "Accueil" : "Home"}
            variant="secondary"
            icon="home"
            onPress={() => router.push("/?browse=1")}
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
    </ScrollView>
  );
}
