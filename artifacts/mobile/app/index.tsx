import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { getListBarbersQueryKey, useApprovedSalonCatalog, useListBarbers } from "@workspace/api-client-react";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { Redirect, useFocusEffect, useLocalSearchParams, usePathname } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useBrowsing } from "@/lib/browseIntent";
import { nearbySalons, newestRegisteredSalons } from "@/lib/salonSearch";
import { useHomeFavorites } from "@/hooks/home/useHomeFavorites";
import { useNearbyLocation } from "@/hooks/home/useNearbyLocation";
import { SalonAdsCarousel } from "@/components/SalonAdsCarousel";
import { HomeSearch, HomeTopBar } from "@/components/home/HomeHeader";
import { CategoryRow } from "@/components/home/CategoryRow";
import { NearbySection } from "@/components/home/NearbySection";
import { DiscoverSection } from "@/components/home/DiscoverSection";
import { SearchResults } from "@/components/home/SearchResults";
import { InspirationSection } from "@/components/home/InspirationSection";
import { JournalSection } from "@/components/home/JournalSection";
import { CatalogFooter } from "@/components/home/CatalogFooter";
import { HomeBottomNav } from "@/components/home/HomeBottomNav";
import { LazyMount } from "@/components/home/LazyMount";
import { CardRowSkeleton, ListSkeleton } from "@/components/home/HomeSkeletons";
import { ONBOARDING_KEY } from "./onboarding";

export default function PublicHome() {
  const c = useColors();
  const pathname = usePathname();
  const { browse } = useLocalSearchParams<{ browse?: string }>();
  const { isSignedIn, isLoaded } = useAuth();
  const { ready, syncing, user, role, lang } = useApp();
  const fr = lang === "fr";
  const { width } = useWindowDimensions();
  // About two covers per screen width, with a peek of the next one.
  const cardWidth = Math.round(Math.min(220, (width - 40 - 12) / 2.15));

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [category, setCategory] = useState<{ id: number | null; name: string | null }>({ id: null, name: null });
  const [lowerReady, setLowerReady] = useState(false);
  // Reactive: a barber/admin who tapped "Accueil" reaches the public home (see lib/browseIntent).
  const browsing = useBrowsing();
  const forceBrowse = pathname === "/browse" || browse === "1" || browsing;
  const canUsePublicHome = isLoaded && (!isSignedIn || (!!user && ready && (role === "client" || forceBrowse)));

  const adViewport = useRef({ offset: 0, viewport: 0, top: 0, height: 0, visible: false });
  const [adsVisible, setAdsVisible] = useState(false);
  const updateAdVisibility = () => {
    const frame = adViewport.current;
    const intersection = Math.min(frame.offset + frame.viewport, frame.top + frame.height) - Math.max(frame.offset, frame.top);
    const visible = frame.height > 0 && intersection >= frame.height * 0.6;
    if (visible !== frame.visible) { frame.visible = visible; setAdsVisible(visible); }
  };

  const listParams = { status: "approved" as const, search: search || undefined, limit: 20 };
  const { data, isLoading, isFetching, isError, refetch, isRefetching } = useListBarbers(
    listParams, { query: { queryKey: getListBarbersQueryKey(listParams), staleTime: 30000, refetchOnMount: "always" } },
  );
  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch: refetchCatalog } = useApprovedSalonCatalog();
  const newest = useMemo(() => newestRegisteredSalons(catalog), [catalog]);
  const location = useNearbyLocation(fr, !!onboardingDone && canUsePublicHome);
  const nearest = useMemo(
    () => location.position ? nearbySalons(catalog ?? [], location.position, null).slice(0, 20) : [],
    [catalog, location.position],
  );
  const favorites = useHomeFavorites(fr);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useFocusEffect(useCallback(() => { void refetch(); void refetchCatalog(); }, [refetch, refetchCatalog]));
  useEffect(() => { AsyncStorage.getItem(ONBOARDING_KEY).then((val) => setOnboardingDone(!!val)); }, []);
  // Secondary sections (gallery, journal) mount after first paint or on scroll.
  useEffect(() => { const t = setTimeout(() => setLowerReady(true), 1200); return () => clearTimeout(t); }, []);

  const list = data?.data ?? [];
  const searching = isLoading || query.trim() !== search || (!!query.trim() && isFetching);

  // The home is public: do not gate on Clerk loading; only on onboarding and signed-in sync.
  if (onboardingDone === null || (isSignedIn && (!ready || (syncing && !user)))) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (isSignedIn && user && (role === "barber" || role === "admin") && !forceBrowse) return <Redirect href="/(barber)" />;

  const q = query.trim();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <HomeTopBar location={location} />
      <ScrollView
        onLayout={(e) => { adViewport.current.viewport = e.nativeEvent.layout.height; updateAdVisibility(); }}
        onScroll={(e) => {
          adViewport.current.offset = e.nativeEvent.contentOffset.y;
          updateAdVisibility();
          if (!lowerReady && e.nativeEvent.contentOffset.y > 120) setLowerReady(true);
        }}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); void refetchCatalog(); }} tintColor={c.primary} />}
      >
        <HomeSearch query={query} onChangeQuery={setQuery} />
        {q ? (
          <SearchResults query={q} list={list} total={data?.total ?? 0} searching={searching} isError={isError}
            onRetry={() => { void refetch(); }} fr={fr} />
        ) : (
          <>
            <CategoryRow selectedId={category.id} onSelect={(id, name) => setCategory({ id, name })} fr={fr} />
            <SalonAdsCarousel visible={adsVisible} onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              Object.assign(adViewport.current, { top: y, height });
              updateAdVisibility();
            }} />
            <NearbySection location={location} salons={nearest} catalogLoading={catalogLoading} catalogError={catalogError}
              onRetryCatalog={() => { void refetchCatalog(); }} favorites={favorites} cardWidth={cardWidth} fr={fr} />
            <DiscoverSection newest={newest} newestLoading={catalogLoading} newestError={catalogError} onRetryNewest={() => { void refetchCatalog(); }}
              featured={list.slice(0, 6)} featuredLoading={isLoading} featuredError={isError} onRetryFeatured={() => { void refetch(); }}
              categoryId={category.id} categoryName={category.name} position={location.position}
              favorites={favorites} cardWidth={cardWidth} fr={fr} />
            <LazyMount ready={lowerReady} placeholder={<View style={{ marginBottom: 28 }}><CardRowSkeleton cardWidth={cardWidth * 0.8} aspect={3 / 4} count={4} /></View>}>
              <InspirationSection fr={fr} />
            </LazyMount>
            <LazyMount ready={lowerReady} placeholder={<View style={{ marginBottom: 28 }}><ListSkeleton rows={2} /></View>}>
              <JournalSection fr={fr} />
            </LazyMount>
            <CatalogFooter fr={fr} signedIn={!!isSignedIn} />
          </>
        )}
      </ScrollView>
      <HomeBottomNav />
    </View>
  );
}
