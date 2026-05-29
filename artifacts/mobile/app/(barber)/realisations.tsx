import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";

type MyBarber = { id: number; salonName: string };
type Service = { id: number; name: string };
type Realisation = {
  id: number;
  serviceId: number | null;
  beforeUrl: string;
  afterUrl: string;
  caption: string | null;
};

export default function BarberRealisations() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();

  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: salons, isLoading: salonsLoading } = useQuery<MyBarber[]>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarber[]>("/api/barbers/me"),
  });
  // Realisations API operates on the barber's primary salon (`/barbers/me/realisations`),
  // so we always use the primary salon to stay consistent with the backend.
  const barber = salons && salons.length > 0 ? salons[0] : null;

  const { data: services } = useQuery<Service[]>({
    queryKey: ["barberServices", barber?.id],
    queryFn: () => fetcher<Service[]>(`/api/barbers/${barber!.id}/services`),
    enabled: !!barber,
  });

  const { data: items, isLoading } = useQuery<Realisation[]>({
    queryKey: ["myRealisations", barber?.id],
    queryFn: () => fetcher<Realisation[]>("/api/barbers/me/realisations"),
    enabled: !!barber,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await fetcher(`/api/barbers/me/realisations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myRealisations", barber?.id] }),
  });

  const pickImage = async (which: "before" | "after") => {
    const setUploading = which === "before" ? setUploadingBefore : setUploadingAfter;
    setUploading(true);
    try {
      const result = await pickAndUploadImage(fetcher);
      if (!result) return;
      if (which === "before") setBeforeUrl(result.objectPath);
      else setAfterUrl(result.objectPath);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de téléverser l'image.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!beforeUrl || !afterUrl) {
      Alert.alert("Photos requises", "Ajoutez une photo avant et une photo après.");
      return;
    }
    setSaving(true);
    try {
      await fetcher("/api/barbers/me/realisations", {
        method: "POST",
        body: JSON.stringify({
          beforeUrl,
          afterUrl,
          serviceId: serviceId ?? null,
          caption: caption.trim() || null,
        }),
      });
      setBeforeUrl(null);
      setAfterUrl(null);
      setCaption("");
      setServiceId(null);
      qc.invalidateQueries({ queryKey: ["myRealisations", barber?.id] });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Supprimer ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteItem.mutate(id) },
    ]);
  };

  if (salonsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!barber) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
        <Feather name="scissors" size={32} color={c.mutedForeground} />
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>
          Aucun salon trouvé
        </Text>
        <Pressable
          onPress={() => router.replace("/(barber)")}
          style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: c.primary }}
        >
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Tableau de bord</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20, flex: 1 }}>
          Avant / Après
        </Text>
      </View>

      {/* Composer */}
      <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Nouvelle réalisation</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PickSlot label="Avant" uri={resolveObjectUrl(beforeUrl)} uploading={uploadingBefore} onPress={() => pickImage("before")} c={c} />
          <PickSlot label="Après" uri={resolveObjectUrl(afterUrl)} uploading={uploadingAfter} onPress={() => pickImage("after")} c={c} />
        </View>
        {services && services.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>Service (optionnel)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {services.map((s) => {
                const active = serviceId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setServiceId(active ? null : s.id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? c.primary : c.muted }}
                  >
                    <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Légende (optionnel)"
          placeholderTextColor={c.mutedForeground}
          style={{
            backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius - 4,
            paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14,
          }}
        />
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            paddingVertical: 13, borderRadius: c.radius, backgroundColor: c.primary, opacity: pressed || saving ? 0.7 : 1,
          })}
        >
          {saving ? (
            <ActivityIndicator color={c.primaryForeground} />
          ) : (
            <>
              <Feather name="check" size={16} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Publier</Text>
            </>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon="layers" title="Aucune réalisation" description="Montrez vos transformations avant / après à vos clients." />
      ) : (
        <View style={{ gap: 14 }}>
          {items.map((r) => (
            <View key={r.id} style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
              <View style={{ flexDirection: "row" }}>
                <BeforeAfterImg uri={resolveObjectUrl(r.beforeUrl)} tag="Avant" c={c} />
                <BeforeAfterImg uri={resolveObjectUrl(r.afterUrl)} tag="Après" c={c} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}>
                <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {r.caption || (services?.find((s) => s.id === r.serviceId)?.name ?? "Réalisation")}
                </Text>
                <Pressable onPress={() => handleDelete(r.id)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color={c.destructive} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function PickSlot({ label, uri, uploading, onPress, c }: { label: string; uri: string | null; uploading: boolean; onPress: () => void; c: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      style={{
        flex: 1, aspectRatio: 1, borderRadius: c.radius - 4, borderWidth: 1, borderColor: c.border,
        backgroundColor: c.muted, alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
    >
      {uploading ? (
        <ActivityIndicator color={c.primary} />
      ) : uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <>
          <Feather name="camera" size={22} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function BeforeAfterImg({ uri, tag, c }: { uri: string | null; tag: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flex: 1, aspectRatio: 1, position: "relative" }}>
      {uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
      <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{tag}</Text>
      </View>
    </View>
  );
}
