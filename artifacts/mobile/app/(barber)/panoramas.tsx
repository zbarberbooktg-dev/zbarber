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
import { PanoramaViewer } from "@/components/PanoramaViewer";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";

type MyBarber = { id: number; salonName: string };
type Panorama = { id: number; title: string; imageUrl: string; sortOrder: number };

export default function BarberPanoramas() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: salons, isLoading: salonsLoading } = useQuery<MyBarber[]>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarber[]>("/api/barbers/me"),
  });
  // Panorama API operates on the barber's primary salon (`/barbers/me/panoramas`).
  const barber = salons && salons.length > 0 ? salons[0] : null;

  const { data: items, isLoading } = useQuery<Panorama[]>({
    queryKey: ["myPanoramas", barber?.id],
    queryFn: () => fetcher<Panorama[]>("/api/barbers/me/panoramas"),
    enabled: !!barber,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await fetcher(`/api/barbers/me/panoramas/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myPanoramas", barber?.id] }),
  });

  const pickImage = async () => {
    setUploading(true);
    try {
      const result = await pickAndUploadImage(fetcher);
      if (!result) return;
      setImageUrl(result.objectPath);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de téléverser l'image.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!imageUrl) {
      Alert.alert("Photo requise", "Ajoutez une photo panoramique 360°.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Nom requis", "Donnez un nom à la scène (ex : Accueil, Salle de coupe).");
      return;
    }
    setSaving(true);
    try {
      await fetcher("/api/barbers/me/panoramas", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), imageUrl }),
      });
      setTitle("");
      setImageUrl(null);
      qc.invalidateQueries({ queryKey: ["myPanoramas", barber?.id] });
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

  const sceneList = (items ?? []).map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl }));

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
          Visite 360°
        </Text>
        {sceneList.length > 0 && (
          <Pressable
            onPress={() => setPreviewOpen(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.primary }}
          >
            <Feather name="eye" size={14} color={c.primaryForeground} />
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Aperçu</Text>
          </Pressable>
        )}
      </View>

      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 }}>
        Ajoutez des photos panoramiques 360° (équirectangulaires) de vos différentes pièces. Vos
        clients pourront naviguer entre les scènes depuis la page du salon.
      </Text>

      {/* Composer */}
      <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Nouvelle scène</Text>
        <Pressable
          onPress={pickImage}
          disabled={uploading}
          style={{
            width: "100%", aspectRatio: 2, borderRadius: c.radius - 4, borderWidth: 1, borderColor: c.border,
            backgroundColor: c.muted, alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}
        >
          {uploading ? (
            <ActivityIndicator color={c.primary} />
          ) : imageUrl ? (
            <Image source={{ uri: resolveObjectUrl(imageUrl) ?? undefined }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <>
              <Feather name="compass" size={26} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6 }}>
                Photo panoramique 360°
              </Text>
            </>
          )}
        </Pressable>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nom de la scène (ex : Accueil, Salle de coupe)"
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
              <Feather name="plus" size={16} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Ajouter la scène</Text>
            </>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : sceneList.length === 0 ? (
        <EmptyState icon="compass" title="Aucune scène 360°" description="Ajoutez vos premières photos panoramiques pour créer une visite immersive." />
      ) : (
        <View style={{ gap: 12 }}>
          {(items ?? []).map((p) => (
            <View key={p.id} style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, overflow: "hidden", flexDirection: "row", alignItems: "center" }}>
              <Image source={{ uri: resolveObjectUrl(p.imageUrl) ?? undefined }} style={{ width: 96, height: 64 }} resizeMode="cover" />
              <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, paddingHorizontal: 12 }} numberOfLines={1}>
                {p.title}
              </Text>
              <Pressable onPress={() => handleDelete(p.id)} hitSlop={8} style={{ padding: 14 }}>
                <Feather name="trash-2" size={16} color={c.destructive} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <PanoramaViewer scenes={sceneList} visible={previewOpen} onClose={() => setPreviewOpen(false)} />
    </ScrollView>
  );
}
