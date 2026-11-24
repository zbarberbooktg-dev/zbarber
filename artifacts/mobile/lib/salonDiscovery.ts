import type { QueryClient } from "@tanstack/react-query";

export async function refreshSalonDiscovery(client: QueryClient, options?: { excludeOwned?: boolean }) {
  await client.invalidateQueries({
    predicate: ({ queryKey }) => {
      const key = queryKey[0];
      if (options?.excludeOwned && key === "/api/barbers/me") return false;
      return typeof key === "string" && (
        key.startsWith("/api/barbers") || ["barbersMe", "barberGallery", "salon", "barber"].includes(key)
      );
    },
  });
}
