import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";

export function DocumentUploadCard() {
  const c = useColors();
  const { barberProfile, syncAuth, t, locale } = useApp();
  const fetcher = useAuthedFetch();
  const [uploading, setUploading] = useState(false);

  if (barberProfile?.status !== "awaiting_document") return null;

  const hasSubmitted = !!barberProfile.documentUrl;
  const deadline = barberProfile.documentDeadline
    ? new Date(barberProfile.documentDeadline).toLocaleDateString(locale)
    : null;
  const previewUri = resolveObjectUrl(barberProfile.documentUrl);

  async function handleUpload() {
    if (uploading) return;
    setUploading(true);
    try {
      const uploaded = await pickAndUploadImage(fetcher);
      if (!uploaded) return;
      await fetcher("/api/barbers/me/document", {
        method: "POST",
        body: JSON.stringify({ documentUrl: uploaded.objectPath }),
      });
      await syncAuth();
      Alert.alert(t.docUploadSuccess);
    } catch {
      Alert.alert(t.docUploadError);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: c.radius,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Feather name="file-text" size={18} color={c.primary} style={{ marginRight: 8 }} />
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: c.foreground }}>
          {hasSubmitted ? t.docSubmittedTitle : t.docAwaitingTitle}
        </Text>
      </View>
      <Text style={{ fontFamily: "Inter_400Regular", color: c.mutedForeground, lineHeight: 20, marginBottom: 12 }}>
        {hasSubmitted ? t.docSubmittedDesc : t.docAwaitingDesc}
      </Text>

      {deadline && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Feather name="calendar" size={16} color={c.primary} style={{ marginRight: 8 }} />
          <Text style={{ fontFamily: "Inter_600SemiBold", color: c.foreground }}>
            {t.docDeadline(deadline)}
          </Text>
        </View>
      )}

      {!!barberProfile.documentReviewNote && (
        <View
          style={{
            backgroundColor: c.destructive + "15",
            borderRadius: c.radius,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", color: c.destructive, marginBottom: 2 }}>
            {t.docReviewNote}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", color: c.destructive }}>
            {barberProfile.documentReviewNote}
          </Text>
        </View>
      )}

      {hasSubmitted && previewUri && (
        <Image
          source={{ uri: previewUri }}
          style={{ width: "100%", height: 180, borderRadius: c.radius, marginBottom: 12, backgroundColor: c.muted }}
          resizeMode="contain"
        />
      )}

      <Pressable
        onPress={handleUpload}
        disabled={uploading}
        style={({ pressed }) => ({
          backgroundColor: c.primary,
          padding: 14,
          borderRadius: c.radius,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          opacity: pressed || uploading ? 0.7 : 1,
        })}
      >
        <Feather name="upload" size={18} color={c.primaryForeground} style={{ marginRight: 8 }} />
        <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
          {uploading ? t.docUploading : hasSubmitted ? t.docReplaceBtn : t.docUploadBtn}
        </Text>
      </Pressable>
    </View>
  );
}
