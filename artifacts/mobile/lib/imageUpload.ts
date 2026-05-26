import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

type Source = "camera" | "library";

export type UploadedImage = { objectPath: string; uri: string };

export async function pickImageWithSource(
  source: Source,
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorisez l'accès à l'appareil photo dans les réglages.");
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    return res.assets[0];
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permission refusée", "Autorisez l'accès à votre galerie dans les réglages.");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0];
}

export function promptImageSource(): Promise<Source | null> {
  return new Promise((resolve) => {
    Alert.alert("Ajouter une photo", "Choisir la source", [
      { text: "Annuler", style: "cancel", onPress: () => resolve(null) },
      { text: "Galerie", onPress: () => resolve("library") },
      { text: "Appareil photo", onPress: () => resolve("camera") },
    ]);
  });
}

/**
 * Picks an image from camera or gallery, uploads it via presigned URL,
 * returns the resulting object path (e.g. "/objects/...").
 */
export async function pickAndUploadImage(
  fetcher: <T = unknown>(path: string, init?: RequestInit) => Promise<T>,
): Promise<UploadedImage | null> {
  const source = await promptImageSource();
  if (!source) return null;
  const asset = await pickImageWithSource(source);
  if (!asset) return null;

  const ct = asset.mimeType || "image/jpeg";
  const name = asset.fileName || `image-${Date.now()}.jpg`;
  const size = asset.fileSize ?? 0;

  const presigned = await fetcher<{ uploadURL: string; objectPath: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      body: JSON.stringify({ name, size, contentType: ct }),
    },
  );

  const fileResp = await fetch(asset.uri);
  const blob = await fileResp.blob();
  const put = await fetch(presigned.uploadURL, {
    method: "PUT",
    headers: { "content-type": ct },
    body: blob,
  });
  if (!put.ok) throw new Error(`Upload échoué (${put.status})`);

  return { objectPath: presigned.objectPath, uri: asset.uri };
}

/**
 * Resolve a stored object path to a full URL for <Image source={{ uri }}>.
 * Accepts already-full URLs (http*) and returns them unchanged.
 */
export function resolveObjectUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) return objectPath;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";
  if (objectPath.startsWith("/objects/")) {
    return `${base}/api/storage${objectPath}`;
  }
  return `${base}${objectPath.startsWith("/") ? "" : "/"}${objectPath}`;
}
