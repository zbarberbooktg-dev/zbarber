import React from "react";
import { ScrollView, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { localeMap } from "@/constants/i18n";
import type { LegalDoc } from "@/constants/legal";

const LAST_UPDATED_DATE = new Date("2026-05-01");

export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const c = useColors();
  const { lang } = useApp();
  const dateStr = LAST_UPDATED_DATE.toLocaleDateString(localeMap[lang], {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
    >
      <View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 26, lineHeight: 32 }}>
          {doc.title}
        </Text>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
          {doc.lastUpdated} {dateStr}
        </Text>
      </View>

      {doc.sections.map((s, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>
            {s.heading}
          </Text>
          {s.body && (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 }}>
              {s.body}
            </Text>
          )}
          {s.list && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {s.list.map((item, j) => (
                <View key={j} style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 14, lineHeight: 22 }}>•</Text>
                  <Text style={{ flex: 1, color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
