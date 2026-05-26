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
  View,
} from "react-native";

import { EmptyState } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";

type MyBarber = { id: number; salonName: string };
type Photo = { id: number; photoUrl: string; caption: string | null };

export default function BarberGallery() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [uploading, setUploading] = useState(false);

  const { data: salons, isLoading: salonsLoading, error: salonsError, refetch: refetchSalons } = useQuery<MyBarber[]>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarber[]>("/api/barbers/me"),
  });
  const barber = salons && salons.length > 0 ? salons[selectedIdx] ?? salons[0] : null;

  const { data: photos, isLoading, refetch } = useQuery<Photo[]>({
    queryKey: ["barberGallery", barber?.id],
    queryFn: () => fetcher<Photo[]>(`/api/barbers/${barber!.id}/gallery`),
    enabled: !!barber,
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: number) => {
      await fetcher(`/api/barbers/${barber!.id}/gallery/${photoId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["barberGallery", barber?.id] });
    },
  });

  const handleAdd = async () => {
    if (!barber) return;
    setUploading(true);
    try {
      const result = await pickAndUploadImage(fetcher);
      if (!result) return;
      await fetcher(`/api/barbers/${barber.id}/gallery`, {
        method: "POST",
        body: JSON.stringify({ photoUrl: result.objectPath }),
      });
      qc.invalidateQueries({ queryKey: ["barberGallery", barber.id] });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'ajouter la photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (photoId: number) => {
    Alert.alert("Supprimer cette photo ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => deletePhoto.mutate(photoId),
      },
    ]);
  };

  if (salonsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (salonsError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
        <Feather name="alert-circle" size={32} color={c.destructive} />
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>
          Impossible de charger votre salon
        </Text>
        <Pressable
          onPress={() => refetchSalons()}
          style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: c.primary }}
        >
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Réessayer</Text>
        </Pressable>
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
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
          Créez d'abord votre salon depuis le tableau de bord.
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
          Galerie
        </Text>
      </View>

      {salons && salons.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {salons.map((s, idx) => {
            const active = idx === selectedIdx;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSelectedIdx(idx)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: active ? c.primary : c.muted,
                }}
              >
                <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {s.salonName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={handleAdd}
        disabled={uploading}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          paddingVertical: 14, borderRadius: c.radius,
          backgroundColor: c.primary, opacity: pressed || uploading ? 0.7 : 1,
        })}
      >
        {uploading ? (
          <ActivityIndicator color={c.primaryForeground} />
        ) : (
          <>
            <Feather name="plus" size={18} color={c.primaryForeground} />
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
              Ajouter une photo
            </Text>
          </>
        )}
      </Pressable>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : !photos || photos.length === 0 ? (
        <EmptyState
          icon="image"
          title="Aucune photo"
          description="Ajoutez des photos de votre salon, de vos coupes et de vos réalisations."
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {photos.map((p) => (
            <View
              key={p.id}
              style={{
                width: "48%", aspectRatio: 1, borderWidth: 1, borderColor: c.border,
                borderRadius: c.radius - 4, overflow: "hidden", position: "relative",
              }}
            >
              <Image
                source={{ uri: resolveObjectUrl(p.photoUrl)! }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => handleDelete(p.id)}
                hitSlop={6}
                style={{
                  position: "absolute", top: 6, right: 6,
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Feather name="trash-2" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
