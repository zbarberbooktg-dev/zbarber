import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { getListNotificationsQueryKey, useListNotifications } from "@workspace/api-client-react";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Input } from "@workspace/zbarber-design/components/native/input";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { reloadAppAsync } from "expo";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { NotificationsSheet } from "./NotificationsSheet";

const brandIcon = require("../../assets/images/icon.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useAuthedFetch } from "@/lib/api";
import type { NearbyLocation } from "@/hooks/home/useNearbyLocation";

/** Compact top bar: brand, saved location, notifications, profile / auth. */
export function HomeTopBar({ location }: { location?: NearbyLocation }) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
  const { user, role, lang, syncAuth } = useApp();
  const fr = lang === "fr";
  const fetcher = useAuthedFetch();
  const [refreshing, setRefreshing] = useState(false);
  const [authWaitTimedOut, setAuthWaitTimedOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: !!isSignedIn && !!user, staleTime: 60_000 } });
  const unread = (notifications.data ?? []).filter((n) => !n.isRead).length;
  const staff = role === "barber" || role === "admin";

  useEffect(() => {
    if (isLoaded) { setAuthWaitTimedOut(false); return; }
    const timer = setTimeout(() => setAuthWaitTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // Unchanged behavior: signed-in users save their position to refine suggestions.
  const refreshLocation = async () => {
    if (!isSignedIn) {
      Alert.alert(fr ? "Connexion requise" : "Sign-in required", fr ? "Connectez-vous pour partager votre position." : "Sign in to share your location.", [
        { text: fr ? "Annuler" : "Cancel", style: "cancel" },
        { text: fr ? "Se connecter" : "Sign in", onPress: () => router.push("/(auth)/sign-in") },
      ]);
      return;
    }
    setRefreshing(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(fr ? "Permission refusée" : "Permission denied", fr ? "Autorisez la géolocalisation dans vos réglages." : "Allow location access in Settings.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetcher("/api/users/me/location", { method: "POST", body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }) });
      await syncAuth();
      location?.updatePosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      Alert.alert(fr ? "Position mise à jour" : "Location updated", fr ? "Vos suggestions seront affinées." : "This helps us improve your suggestions.");
    } catch (e: any) {
      Alert.alert(fr ? "Erreur" : "Error", e?.message ?? (fr ? "Impossible d’actualiser la position." : "Unable to update your location."));
    } finally {
      setRefreshing(false);
    }
  };

  const place = [user?.city, user?.country].filter(Boolean).join(", ");
  return (
    <View style={[styles.bar, { paddingTop: insets.top + (Platform.OS === "web" ? 16 : 8), backgroundColor: c.background }]}>
      <View style={styles.brand}>
        <Image source={brandIcon} style={styles.logo} accessibilityIgnoresInvertColors accessible={false} />
        <Typography variant="title" style={styles.brandText} numberOfLines={1}>Zbarber</Typography>
      </View>
      {!isLoaded && authWaitTimedOut ? (
        <Button variant="outline" size="sm" onPress={() => { void reloadAppAsync(); }} accessibilityLabel={fr ? "Réessayer la connexion" : "Retry connection"}>
          <Feather name="refresh-cw" size={13} color={c.primary} />
          {fr ? "Réessayer" : "Retry"}
        </Button>
      ) : !isLoaded ? (
        <View style={styles.pending} accessibilityLabel={fr ? "Vérification de la session" : "Checking session"}>
          <ActivityIndicator size="small" color={c.primary} />
        </View>
      ) : isSignedIn ? (
        <View style={styles.actions}>
          <Pressable onPress={refreshLocation} disabled={refreshing} accessibilityRole="button" testID="home-location-pill"
            accessibilityLabel={fr ? `Actualiser votre position${place ? `, actuellement ${place}` : ""}` : `Refresh your location${place ? `, currently ${place}` : ""}`}
            style={[styles.pill, { backgroundColor: c.card }]}>
            {refreshing ? <ActivityIndicator size="small" color={c.primary} /> : <Feather name="map-pin" size={13} color={c.primary} />}
            <Typography variant="caption" numberOfLines={1} style={styles.pillText}>{user?.city || (fr ? "Ma position" : "My location")}</Typography>
          </Pressable>
          <View>
            <Button variant="ghost" size="icon" onPress={() => { setNotifOpen(true); void notifications.refetch(); }}
              accessibilityLabel={fr ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : `Notifications, ${unread} unread`}>
              <Feather name="bell" size={18} color={c.foreground} />
            </Button>
            {unread > 0 && <View pointerEvents="none" style={[styles.dot, { backgroundColor: c.primary, borderColor: c.background }]} />}
          </View>
          <Button variant="ghost" size="icon" onPress={() => router.push(staff ? "/(barber)/profile" : "/(client)/profile")}
            accessibilityLabel={fr ? "Profil" : "Profile"}>
            <Feather name="user" size={18} color={c.foreground} />
          </Button>
          <NotificationsSheet visible={notifOpen} onClose={() => setNotifOpen(false)} fr={fr}
            items={notifications.data} loading={notifications.isLoading} error={notifications.isError}
            refreshing={notifications.isRefetching} onRefresh={() => { void notifications.refetch(); }} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button variant="ghost" size="sm" onPress={location?.openSettingsOrLocate} disabled={location?.busy}
            accessibilityLabel={fr ? "Actualiser ma position pour voir les salons proches" : "Update my location to see nearby salons"}>
            <Feather name="map-pin" size={14} color={c.isDark ? c.primary : c.ring} />
            {location?.position ? (fr ? "Position active" : "Location on") : (fr ? "Me localiser" : "Locate me")}
          </Button>
          <Button variant="secondary" size="icon" onPress={() => router.push("/(auth)/sign-in")}
            accessibilityLabel={fr ? "Se connecter ou créer un compte" : "Sign in or create an account"}>
            <Feather name="user" size={18} color={c.foreground} />
          </Button>
        </View>
      )}
    </View>
  );
}

/** Short greeting + catalog search with discreet filter and map access. */
export function HomeSearch({ query, onChangeQuery }: { query: string; onChangeQuery: (q: string) => void }) {
  const c = useColors();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user, lang } = useApp();
  const fr = lang === "fr";
  const first = user?.name?.trim().split(/\s+/)[0];
  return (
    <View style={styles.search}>
      <Typography variant="display" accessibilityRole="header" style={styles.greeting} numberOfLines={1}>
        {isSignedIn && user ? `${fr ? "Bonjour" : "Hello"}, ${first || (fr ? "à vous" : "there")}` : (fr ? "Trouvez votre barbier" : "Find your barber")}
      </Typography>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Feather name="search" size={16} color={c.mutedForeground} style={styles.searchIcon} />
          <Input testID="home-salon-search" value={query} onChangeText={onChangeQuery}
            accessibilityLabel={fr ? "Rechercher un salon par nom, ville ou quartier" : "Search salons by name, city or neighborhood"}
            placeholder={fr ? "Salon, ville, quartier" : "Salon, city, neighborhood"} returnKeyType="search"
            style={styles.input} />
          {query.length > 0 && (
            <Pressable onPress={() => onChangeQuery("")} accessibilityRole="button" accessibilityLabel={fr ? "Effacer la recherche" : "Clear search"} style={styles.clear}>
              <Feather name="x" size={14} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>
        <Button variant="secondary" size="icon" onPress={() => router.push(query.trim() ? { pathname: "/salons", params: { search: query.trim() } } : "/salons")}
          accessibilityLabel={fr ? "Filtres du catalogue" : "Catalog filters"}>
          <Feather name="sliders" size={17} color={c.foreground} />
        </Button>
        <Button variant="secondary" size="icon" onPress={() => router.push("/map" as never)} accessibilityLabel={fr ? "Carte" : "Map"}>
          <Feather name="map" size={17} color={c.foreground} />
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 20, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  logo: { width: 26, height: 26, borderRadius: 7 },
  brandText: { fontSize: 20, lineHeight: 26 },
  pending: { width: 80, height: 44, alignItems: "flex-end", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, maxWidth: 130, paddingHorizontal: 10, borderRadius: 18, marginRight: 2 },
  pillText: { flexShrink: 1 },
  dot: { position: "absolute", top: 10, right: 11, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  search: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18, gap: 12 },
  greeting: { fontSize: 26, lineHeight: 34 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputWrap: { flex: 1, minWidth: 0, justifyContent: "center" },
  searchIcon: { position: "absolute", left: 13, zIndex: 1 },
  input: { paddingLeft: 38, paddingRight: 40 },
  clear: { position: "absolute", right: 2, width: 40, height: 44, alignItems: "center", justifyContent: "center" },
});
