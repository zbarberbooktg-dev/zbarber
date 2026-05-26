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
  ScrollView,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp, type ThemePref } from "@/contexts/AppContext";
import type { Lang } from "@/constants/i18n";

const { width, height } = Dimensions.get("window");

type SlideMeta = {
  id: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  gradient: readonly [string, string];
  accent: string;
};

const SLIDE_META: SlideMeta[] = [
  { id: "discover", icon: "search", gradient: ["#0A0A0A", "#1C1400"], accent: "#D4AF37" },
  { id: "book", icon: "calendar", gradient: ["#0A0A0A", "#001518"], accent: "#38B2AC" },
  { id: "barber", icon: "scissors", gradient: ["#0A0A0A", "#0F0019"], accent: "#9F7AEA" },
  { id: "community", icon: "star", gradient: ["#0A0A0A", "#1C1400"], accent: "#D4AF37" },
];

export const ONBOARDING_KEY = "gbc.onboarding.v1";

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang, themePref, setThemePref } = useApp();
  const [currentIdx, setCurrentIdx] = useState(0);
  const listRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onb = (t as any).onboarding as {
    langLabel: string;
    themeLabel: string;
    continue: string;
    start: string;
    skip: string;
    slides: Array<{ tag: string; title: string; subtitle: string }>;
  };

  const slides = SLIDE_META.map((m, i) => ({ ...m, ...onb.slides[i] }));

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
    if (currentIdx < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIdx + 1, animated: true });
    } else {
      handleDone();
    }
  };

  const isLast = currentIdx === slides.length - 1;
  const isFirst = currentIdx === 0;

  const langOptions: Array<{ key: Lang; label: string }> = [
    { key: "fr", label: "FR" },
    { key: "en", label: "EN" },
  ];
  const themeOptions: Array<{ key: ThemePref; icon: React.ComponentProps<typeof Feather>["name"] }> = [
    { key: "system", icon: "smartphone" },
    { key: "light", icon: "sun" },
    { key: "dark", icon: "moon" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <FlatList
        ref={listRef}
        data={slides}
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
        renderItem={({ item, index }) => (
          <Slide
            slide={item}
            showPrefs={index === 0}
            insetsTop={insets.top}
            lang={lang}
            setLang={setLang}
            themePref={themePref}
            setThemePref={setThemePref}
            langLabel={onb.langLabel}
            themeLabel={onb.themeLabel}
            langOptions={langOptions}
            themeOptions={themeOptions}
          />
        )}
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
          {slides.map((s, i) => {
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
            return (
              <Animated.View
                key={s.id}
                style={{
                  height: 4,
                  width: dotWidth,
                  borderRadius: 2,
                  backgroundColor: s.accent,
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
              backgroundColor: slides[currentIdx].accent,
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
              {isLast ? onb.start : onb.continue}
            </Text>
          </Pressable>

          {!isLast && !isFirst && (
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
                {onb.skip}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

type SlideProps = {
  slide: SlideMeta & { tag: string; title: string; subtitle: string };
  showPrefs: boolean;
  insetsTop: number;
  lang: Lang;
  setLang: (l: Lang) => void;
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  langLabel: string;
  themeLabel: string;
  langOptions: Array<{ key: Lang; label: string }>;
  themeOptions: Array<{ key: ThemePref; icon: React.ComponentProps<typeof Feather>["name"] }>;
};

function Slide({
  slide, showPrefs, insetsTop,
  lang, setLang, themePref, setThemePref,
  langLabel, themeLabel, langOptions, themeOptions,
}: SlideProps) {
  const { gradient, accent, tag, title, subtitle, icon } = slide;

  return (
    <LinearGradient
      colors={[gradient[0], gradient[1], gradient[0]]}
      locations={[0, 0.55, 1]}
      style={{ width, height }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insetsTop + 56,
          paddingHorizontal: 28,
          paddingBottom: showPrefs ? 280 : 220,
        }}
        showsVerticalScrollIndicator={false}
      >
      {/* Big icon composition */}
      <View style={{ marginBottom: showPrefs ? 32 : 56, position: "relative" }}>
        <View
          style={{
            width: 140, height: 140, borderRadius: 70,
            borderWidth: 1, borderColor: `${accent}25`,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: `${accent}12`,
              borderWidth: 1, borderColor: `${accent}35`,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 68, height: 68, borderRadius: 34,
                backgroundColor: `${accent}20`,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Feather name={icon} size={30} color={accent} />
            </View>
          </View>
        </View>
        <View style={{ position: "absolute", top: 16, right: 24, width: 8, height: 8, borderRadius: 4, backgroundColor: `${accent}60` }} />
        <View style={{ position: "absolute", bottom: 20, right: 0, width: 5, height: 5, borderRadius: 3, backgroundColor: `${accent}40` }} />
      </View>

      <Text style={{ color: accent, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 18 }}>
        {tag}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <View style={{ width: 36, height: 1, backgroundColor: accent }} />
        <Feather name="scissors" size={9} color={`${accent}80`} />
      </View>

      <Text style={{ color: "#F3F0E9", fontFamily: "Inter_700Bold", fontSize: 40, lineHeight: 46, marginBottom: 22 }}>
        {title}
      </Text>

      <Text style={{ color: "#7A7770", fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 24, maxWidth: 300 }}>
        {subtitle}
      </Text>

      {showPrefs && (
        <View style={{ marginTop: 36, gap: 18 }}>
          <PrefRow label={langLabel} accent={accent}>
            {langOptions.map((opt) => {
              const active = lang === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setLang(opt.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderWidth: 1,
                    borderColor: active ? accent : "#2A2A2A",
                    backgroundColor: active ? `${accent}18` : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: active ? accent : "#9A9690", fontFamily: "Inter_600SemiBold", fontSize: 13, letterSpacing: 0.5 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </PrefRow>

          <PrefRow label={themeLabel} accent={accent}>
            {themeOptions.map((opt) => {
              const active = themePref === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setThemePref(opt.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderWidth: 1,
                    borderColor: active ? accent : "#2A2A2A",
                    backgroundColor: active ? `${accent}18` : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Feather name={opt.icon} size={16} color={active ? accent : "#9A9690"} />
                </Pressable>
              );
            })}
          </PrefRow>
        </View>
      )}
      </ScrollView>
    </LinearGradient>
  );
}

function PrefRow({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: `${accent}AA`, fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>{children}</View>
    </View>
  );
}
