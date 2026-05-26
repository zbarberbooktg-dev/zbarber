import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    id: "discover",
    tag: "01 — DÉCOUVERTE",
    title: "Trouvez\nl'excellence.",
    subtitle:
      "Parcourez les meilleurs salons certifiés près de chez vous. Photos, avis, services et tarifs — tout en un coup d'œil.",
    icon: "search" as const,
    gradient: ["#0A0A0A", "#1C1400"] as const,
    accent: "#D4AF37",
    flair: "search",
  },
  {
    id: "book",
    tag: "02 — RÉSERVATION",
    title: "Réservez\nsans effort.",
    subtitle:
      "Choisissez votre prestation, votre créneau et confirmez en quelques secondes. Rappels automatiques inclus.",
    icon: "calendar" as const,
    gradient: ["#0A0A0A", "#001518"] as const,
    accent: "#38B2AC",
    flair: "calendar",
  },
  {
    id: "barber",
    tag: "03 — BARBIER PRO",
    title: "Développez\nvotre clientèle.",
    subtitle:
      "Publiez vos services, gérez vos horaires, confirmez ou refusez les rendez-vous. Votre salon, votre tempo.",
    icon: "scissors" as const,
    gradient: ["#0A0A0A", "#0F0019"] as const,
    accent: "#9F7AEA",
    flair: "scissors",
  },
  {
    id: "community",
    tag: "04 — COMMUNAUTÉ",
    title: "Rejoignez\nle cercle.",
    subtitle:
      "Des milliers de clients et barbiers font confiance à Global Barber Corp. Élevez votre expérience grooming.",
    icon: "star" as const,
    gradient: ["#0A0A0A", "#1C1400"] as const,
    accent: "#D4AF37",
    flair: "star",
  },
];

export const ONBOARDING_KEY = "gbc.onboarding.v1";

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIdx, setCurrentIdx] = useState(0);
  const listRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIdx(viewableItems[0].index);
      }
    },
  ).current;

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/");
  };

  const handleNext = () => {
    if (currentIdx < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIdx + 1, animated: true });
    } else {
      handleDone();
    }
  };

  const isLast = currentIdx === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => <Slide slide={item} />}
      />

      {/* Fixed bottom controls */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          backgroundColor: "transparent",
          gap: 28,
          alignItems: "center",
        }}
      >
        {/* Progress dots */}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [6, 28, 6],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.25, 1, 0.25],
              extrapolate: "clamp",
            });
            const accent = SLIDES[i].accent;
            return (
              <Animated.View
                key={s.id}
                style={{
                  height: 4,
                  width: dotWidth,
                  borderRadius: 2,
                  backgroundColor: accent,
                  opacity,
                }}
              />
            );
          })}
        </View>

        {/* CTA */}
        <View style={{ width: "100%", gap: 12 }}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => ({
              backgroundColor: SLIDES[currentIdx].accent,
              paddingVertical: 17,
              alignItems: "center",
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text
              style={{
                color: "#000",
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                letterSpacing: 0.4,
              }}
            >
              {isLast ? "Commencer" : "Continuer →"}
            </Text>
          </Pressable>

          {!isLast && (
            <Pressable
              onPress={handleDone}
              style={{ alignItems: "center", paddingVertical: 8 }}
            >
              <Text
                style={{
                  color: "#5A5A5A",
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  letterSpacing: 0.3,
                }}
              >
                Passer l'introduction
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Slide({ slide }: { slide: (typeof SLIDES)[0] }) {
  const insets = useSafeAreaInsets();
  const { gradient, accent, tag, title, subtitle, icon } = slide;

  return (
    <LinearGradient
      colors={[gradient[0], gradient[1], gradient[0]]}
      locations={[0, 0.55, 1]}
      style={{
        width,
        minHeight: height,
        paddingTop: insets.top + 56,
        paddingHorizontal: 28,
        paddingBottom: 200,
      }}
    >
      {/* Big icon composition */}
      <View style={{ marginBottom: 56, position: "relative" }}>
        {/* Outer ring */}
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 1,
            borderColor: `${accent}25`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Middle ring */}
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: `${accent}12`,
              borderWidth: 1,
              borderColor: `${accent}35`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Core */}
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: `${accent}20`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name={icon} size={30} color={accent} />
            </View>
          </View>
        </View>

        {/* Decorative small dots */}
        <View
          style={{
            position: "absolute",
            top: 16,
            right: 24,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: `${accent}60`,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 20,
            right: 0,
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: `${accent}40`,
          }}
        />
      </View>

      {/* Tag */}
      <Text
        style={{
          color: accent,
          fontFamily: "Inter_700Bold",
          fontSize: 10,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          marginBottom: 18,
        }}
      >
        {tag}
      </Text>

      {/* Divider */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <View style={{ width: 36, height: 1, backgroundColor: accent }} />
        <Feather name="scissors" size={9} color={`${accent}80`} />
      </View>

      {/* Title */}
      <Text
        style={{
          color: "#F3F0E9",
          fontFamily: "Inter_700Bold",
          fontSize: 40,
          lineHeight: 46,
          marginBottom: 22,
        }}
      >
        {title}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          color: "#7A7770",
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          lineHeight: 24,
          maxWidth: 300,
        }}
      >
        {subtitle}
      </Text>
    </LinearGradient>
  );
}
