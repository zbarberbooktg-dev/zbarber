import type { QueryClient } from "@tanstack/react-query";
import type { ImageSourcePropType } from "react-native";
import { resolveObjectUrl } from "./imageUpload";

export function salonImageSource(
  salon: { logoUrl?: string | null; cardImageUrl?: string | null },
  fallback: ImageSourcePropType,
): ImageSourcePropType {
  const uri = resolveObjectUrl(salon.logoUrl || salon.cardImageUrl, 700);
  return uri ? { uri } : fallback;
}

export async function refreshSalonDiscovery(client: QueryClient) {
  await client.invalidateQueries({
    predicate: ({ queryKey }) => {
      const key = queryKey[0];
      return typeof key === "string" && (
        key.startsWith("/api/barbers") || ["barbersMe", "barberGallery", "salon", "barber"].includes(key)
      );
    },
  });
}
