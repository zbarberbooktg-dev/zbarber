import { useAuth } from "@clerk/expo";
import { getListFavoritesQueryKey, useAddFavorite, useListFavorites, useRemoveFavorite } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Platform } from "react-native";

/** Favorites for salon cards: same endpoints as the salon screen and the Favorites tab. */
export function useHomeFavorites(fr: boolean) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const favorites = useListFavorites({ query: { queryKey: getListFavoritesQueryKey(), enabled: !!isSignedIn, staleTime: 30_000 } });
  const add = useAddFavorite();
  const remove = useRemoveFavorite();
  const [busyId, setBusyId] = useState<number | null>(null);
  const ids = useMemo(() => new Set((isSignedIn ? favorites.data ?? [] : []).map((b) => b.id)), [favorites.data, isSignedIn]);

  const toggle = async (barberId: number) => {
    if (!isSignedIn) {
      if (Platform.OS === "web") { router.push("/(auth)/sign-in"); return; }
      Alert.alert(fr ? "Connexion requise" : "Sign-in required",
        fr ? "Connectez-vous pour enregistrer vos salons favoris." : "Sign in to save your favorite salons.", [
          { text: fr ? "Annuler" : "Cancel", style: "cancel" },
          { text: fr ? "Se connecter" : "Sign in", onPress: () => router.push("/(auth)/sign-in") },
        ]);
      return;
    }
    if (busyId !== null) return;
    setBusyId(barberId);
    try {
      if (ids.has(barberId)) await remove.mutateAsync({ barberId });
      else await add.mutateAsync({ data: { barberId } });
      await queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
    } catch (e: any) {
      Alert.alert(fr ? "Erreur" : "Error", e?.message ?? (fr ? "Action impossible pour le moment." : "Unable to update favorites."));
    } finally {
      setBusyId(null);
    }
  };
  return { isFavorite: (id: number) => ids.has(id), toggle, busyId };
}
export type HomeFavorites = ReturnType<typeof useHomeFavorites>;
