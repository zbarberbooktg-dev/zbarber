import { Feather } from "@expo/vector-icons";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_400Regular_Italic,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import { useListBarbers } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";

const PALETTE = {
  bg: "#0A0A0A",
  surface: "#141414",
  surfaceAlt: "#1A1A1A",
  border: "#2A2A2A",
  borderSubtle: "#1F1F1F",
  text: "#F3F0E9",
  textMuted: "#A09D94",
  textDim: "#5A5A5A",
  gold: "#D4AF37",
};

const heroImage = require("../../assets/images/client-home/hero.png");
const salonFallbacks: ImageSourcePropType[] = [
  require("../../assets/images/client-home/salon1.png"),
  require("../../assets/images/client-home/salon2.png"),
  require("../../assets/images/client-home/salon3.png"),
];
const styleImages = [
  { src: require("../../assets/images/client-home/style1.png"), label: "Le Dégradé" },
  { src: require("../../assets/images/client-home/style2.png"), label: "La Barbe" },
  { src: require("../../assets/images/client-home/style3.png"), label: "Le Taper" },
  { src: require("../../assets/images/client-home/style4.png"), label: "Classique" },
];

export default function Discover() {
  const router = useRouter();
  const { t, user, lang } = useApp();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const { data, isLoading, refetch, isRefetching } = useListBarbers({ status: "approved" });
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular_Italic,
  });

  const list = useMemo(() => {
    const items = data?.data ?? [];
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (b) =>
        b.salonName.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.neighborhood?.toLowerCase().includes(q),
    );
  }, [data, query]);

  const featured = list.slice(0, 4);
  const nearby = list.slice(0, 3);
  const firstName = user?.name?.split(" ")[0] ?? (lang === "fr" ? "vous" : "you");
  const serif = fontsLoaded ? "PlayfairDisplay_500Medium" : "Inter_700Bold";
  const serifBold = fontsLoaded ? "PlayfairDisplay_600SemiBold" : "Inter_700Bold";
  const serifItalic = fontsLoaded ? "PlayfairDisplay_400Regular_Italic" : "Inter_400Regular";

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: PALETTE.bg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: PALETTE.surfaceAlt,
              borderWidth: 1,
              borderColor: PALETTE.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="user" size={18} color={PALETTE.gold} />
          </View>
          <View>
            <Text
              style={{
                color: PALETTE.textMuted,
                fontSize: 10,
                fontFamily: "Inter_500Medium",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {lang === "fr" ? "Lieu actuel" : "Current city"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: PALETTE.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                Casablanca
              </Text>
              <Feather name="chevron-down" size={12} color={PALETTE.text} />
            </View>
          </View>
        </View>
        <Pressable
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: PALETTE.surfaceAlt,
            borderWidth: 1,
            borderColor: PALETTE.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="bell" size={16} color={PALETTE.gold} />
          <View
            style={{
              position: "absolute",
              top: 9,
              right: 9,
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: PALETTE.gold,
              borderWidth: 1,
              borderColor: PALETTE.bg,
            }}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={PALETTE.gold}
          />
        }
      >
        {/* Hero + search */}
        <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 24 }}>
          <Text style={{ color: "#fff", fontFamily: serifBold, fontSize: 38, lineHeight: 44 }}>
            {lang === "fr" ? `Salut, ${firstName}` : `Hi, ${firstName}`}
          </Text>
          <Text
            style={{
              color: PALETTE.textMuted,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              marginTop: 4,
              marginBottom: 20,
            }}
          >
            {lang === "fr"
              ? "Découvrez l'art du grooming d'exception."
              : "Discover the art of exceptional grooming."}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: PALETTE.surface,
              borderWidth: 1,
              borderColor: PALETTE.border,
              paddingHorizontal: 14,
            }}
          >
            <Feather name="search" size={16} color={PALETTE.gold} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                lang === "fr" ? "Rechercher un salon, un style..." : "Search a salon, a style..."
              }
              placeholderTextColor={PALETTE.textDim}
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 10,
                color: PALETTE.text,
                fontFamily: "Inter_400Regular",
                fontSize: 13,
              }}
            />
          </View>
        </View>

        {/* Hero editorial image */}
        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <ImageBackground
            source={heroImage}
            style={{ width: "100%", aspectRatio: 16 / 9, justifyContent: "flex-end" }}
            imageStyle={{ opacity: 0.85 }}
          >
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(10,10,10,0.45)",
              }}
            />
            <View style={{ padding: 16 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: PALETTE.gold,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: "#000",
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontFamily: "Inter_700Bold",
                    textTransform: "uppercase",
                  }}
                >
                  {lang === "fr" ? "L'Édito" : "Editorial"}
                </Text>
              </View>
              <Text style={{ color: "#fff", fontFamily: serif, fontSize: 22, lineHeight: 28 }}>
                {lang === "fr" ? "La Renaissance du Rasage" : "The Shaving Renaissance"}
              </Text>
            </View>
          </ImageBackground>
        </View>

        {/* Salons en vedette */}
        <SectionHeader
          title={lang === "fr" ? "Salons en Vedette" : "Featured Salons"}
          action={lang === "fr" ? "Tout voir" : "View all"}
          serifFont={serif}
        />
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={PALETTE.gold} />
          </View>
        ) : featured.length === 0 ? (
          <Text
            style={{
              paddingHorizontal: 20,
              color: PALETTE.textMuted,
              fontFamily: serifItalic,
              fontSize: 14,
              marginBottom: 32,
            }}
          >
            {lang === "fr"
              ? "Bientôt — nos premiers salons partenaires."
              : "Coming soon — our first partner salons."}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 16 }}
            style={{ marginBottom: 32 }}
          >
            {featured.map((b, idx) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/(client)/barber/${b.id}` as never)}
                style={{ width: 260 }}
              >
                <View
                  style={{
                    aspectRatio: 3 / 4,
                    borderWidth: 1,
                    borderColor: PALETTE.border,
                    marginBottom: 12,
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={salonFallbacks[idx % salonFallbacks.length]}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="heart" size={14} color="#fff" />
                  </View>
                  {b.rating && Number(b.rating) > 0 ? (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Feather name="star" size={12} color={PALETTE.gold} />
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Inter_700Bold",
                          fontSize: 12,
                        }}
                      >
                        {Number(b.rating).toFixed(1)}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.6)",
                          fontFamily: "Inter_400Regular",
                          fontSize: 11,
                        }}
                      >
                        ({b.reviewCount ?? 0})
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{ color: "#fff", fontFamily: serif, fontSize: 20, marginBottom: 4 }}
                  numberOfLines={1}
                >
                  {b.salonName}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="map-pin" size={11} color={PALETTE.textMuted} />
                  <Text
                    style={{
                      color: PALETTE.textMuted,
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {b.neighborhood ? `${b.neighborhood} • ${b.city}` : b.city}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Inspiration */}
        <SectionHeader
          title={lang === "fr" ? "L'Inspiration" : "Inspiration"}
          action={lang === "fr" ? "Galerie" : "Gallery"}
          serifFont={serif}
        />
        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {styleImages.map((s) => (
              <View
                key={s.label}
                style={{
                  width: "48%",
                  aspectRatio: 1,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                  overflow: "hidden",
                }}
              >
                <Image source={s.src} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                <View
                  style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" }}
                />
                <Text
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: 12,
                    color: "#fff",
                    fontFamily: serifItalic,
                    fontSize: 13,
                  }}
                >
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Loyalty card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <View
            style={{
              backgroundColor: PALETTE.surface,
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.35)",
              padding: 22,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
              }}
            >
              <View>
                <Text style={{ color: "#fff", fontFamily: serif, fontSize: 20, marginBottom: 2 }}>
                  {lang === "fr" ? "Le Cercle" : "The Circle"}
                </Text>
                <Text
                  style={{
                    color: PALETTE.textMuted,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                  }}
                >
                  {lang === "fr" ? "Membre Privilège" : "Privilege Member"}
                </Text>
              </View>
              <Feather name="scissors" size={22} color={PALETTE.gold} />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: PALETTE.gold,
                  fontSize: 10,
                  letterSpacing: 2,
                  fontFamily: "Inter_600SemiBold",
                  textTransform: "uppercase",
                }}
              >
                {lang === "fr" ? "Progression" : "Progress"}
              </Text>
              <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 14 }}>3 / 5</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((step) => (
                <View
                  key={step}
                  style={{
                    flex: 1,
                    height: 3,
                    backgroundColor: step <= 3 ? PALETTE.gold : PALETTE.border,
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                color: PALETTE.textMuted,
                fontFamily: serifItalic,
                fontSize: 11,
                textAlign: "center",
                marginTop: 14,
              }}
            >
              {lang === "fr"
                ? "Encore 2 prestations pour un soin offert."
                : "2 more services for a complimentary treatment."}
            </Text>
          </View>
        </View>

        {/* Près de chez vous */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <Text style={{ color: PALETTE.text, fontFamily: serif, fontSize: 22, marginBottom: 16 }}>
            {lang === "fr" ? "Près de chez vous" : "Near you"}
          </Text>
          <View style={{ gap: 14 }}>
            {nearby.length === 0 && !isLoading ? (
              <Text
                style={{
                  color: PALETTE.textMuted,
                  fontFamily: serifItalic,
                  fontSize: 13,
                }}
              >
                {lang === "fr" ? "Pas encore de salons proches." : "No nearby salons yet."}
              </Text>
            ) : (
              nearby.map((b, idx) => (
                <Pressable
                  key={`near-${b.id}`}
                  onPress={() => router.push(`/(client)/barber/${b.id}` as never)}
                  style={{
                    flexDirection: "row",
                    gap: 14,
                    padding: 14,
                    backgroundColor: PALETTE.surface,
                    borderWidth: 1,
                    borderColor: PALETTE.border,
                    alignItems: "center",
                  }}
                >
                  <Image
                    source={salonFallbacks[idx % salonFallbacks.length]}
                    style={{ width: 76, height: 76 }}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: "#fff", fontFamily: serif, fontSize: 17, marginBottom: 4 }}
                      numberOfLines={1}
                    >
                      {b.salonName}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 6,
                      }}
                    >
                      <Feather name="map-pin" size={10} color={PALETTE.textMuted} />
                      <Text
                        style={{
                          color: PALETTE.textMuted,
                          fontFamily: "Inter_400Regular",
                          fontSize: 11,
                        }}
                        numberOfLines={1}
                      >
                        {b.neighborhood ? `${b.neighborhood} • ${b.city}` : b.city}
                      </Text>
                    </View>
                    {b.rating && Number(b.rating) > 0 ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Feather name="star" size={10} color={PALETTE.gold} />
                        <Text
                          style={{
                            color: "#fff",
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 11,
                          }}
                        >
                          {Number(b.rating).toFixed(1)}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          color: PALETTE.gold,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 10,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        {t.newBadge}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderWidth: 1,
                      borderColor: PALETTE.gold,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="chevron-right" size={16} color={PALETTE.gold} />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  serifFont,
}: {
  title: string;
  action: string;
  serifFont: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 16,
      }}
    >
      <Text style={{ color: PALETTE.text, fontFamily: serifFont, fontSize: 22 }}>{title}</Text>
      <Pressable>
        <Text
          style={{
            color: PALETTE.gold,
            fontSize: 11,
            fontFamily: "Inter_600SemiBold",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {action}
        </Text>
      </Pressable>
    </View>
  );
}
