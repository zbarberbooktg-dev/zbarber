import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useSubmitBarberDocument } from "@workspace/api-client-react";
import React, { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, Text, View, type ImageSourcePropType } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { pickAndUploadImage, resolveObjectUrl } from "@/lib/imageUpload";

export function DocumentUploadCard() {
  const c = useColors();
  const { barberProfile, syncAuth, t } = useApp();
  const fetcher = useAuthedFetch();
  const submitDocument = useSubmitBarberDocument();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!barberProfile || !["pending", "awaiting_document", "approved"].includes(barberProfile.status)) return null;

  const hasSubmitted = !!barberProfile.documentUrl;
  const previewUri = resolveObjectUrl(barberProfile.documentUrl);

  async function refreshStatus() {
    setRefreshing(true);
    setError(null);
    try { await syncAuth(); }
    catch { setError(t.docStatusError); }
    finally { setRefreshing(false); }
  }

  async function handleUpload() {
    if (uploading) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await pickAndUploadImage(fetcher);
      if (!uploaded) return;
      await submitDocument.mutateAsync({ data: { documentUrl: uploaded.objectPath }, params: { salonId: barberProfile!.id } });
      await syncAuth();
      Alert.alert(t.docUploadSuccess);
    } catch {
      setError(t.docUploadError);
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
        <PrivateDocumentPreview uri={previewUri} />
      )}

      <Pressable
        onPress={handleUpload}
        testID="optional-salon-document-upload"
        disabled={uploading || refreshing}
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
      {barberProfile.status !== "approved" && (
        <Pressable onPress={refreshStatus} disabled={refreshing || uploading} testID="refresh-salon-approval" style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
            {refreshing ? "…" : t.docRefreshStatus}
          </Text>
        </Pressable>
      )}
      {error && <Text accessibilityRole="alert" style={{ color: c.destructive, marginTop: 10 }}>{error}</Text>}
    </View>
  );
}

// Private documents require the owner's token, unlike public gallery images.
// Browser Image cannot send Authorization, so use a short-lived in-memory blob.
function PrivateDocumentPreview({ uri }: { uri: string }) {
  const c = useColors();
  const { t } = useApp();
  const { getToken } = useAuth();
  const [source, setSource] = useState<ImageSourcePropType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let blobUrl: string | undefined;
    setSource(null);
    setFailed(false);
    void (async () => {
      try {
        const token = await getToken();
        if (controller.signal.aborted) return;
        if (!token) throw new Error("Auth required");
        const headers = { Authorization: `Bearer ${token}` };
        if (Platform.OS !== "web") {
          setSource({ uri, headers });
          return;
        }
        const response = await fetch(uri, { headers, signal: controller.signal });
        if (!response.ok) throw new Error("Preview unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        blobUrl = URL.createObjectURL(blob);
        setSource({ uri: blobUrl });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // Clerk's getToken identity is unstable; refresh only when the file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);
  if (failed) return <Text style={{ color: c.mutedForeground, marginBottom: 12 }}>{t.docPreviewError}</Text>;
  return source ? <Image source={source} onError={() => setFailed(true)} style={{ width: "100%", height: 180, borderRadius: c.radius, marginBottom: 12, backgroundColor: c.muted }} resizeMode="contain" /> : null;
}
