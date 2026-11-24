import { Skeleton } from "@workspace/zbarber-design/components/native/skeleton";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

export function CardRowSkeleton({ cardWidth, aspect = 4 / 3, count = 3 }: { cardWidth: number; aspect?: number; count?: number }) {
  return (
    <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}
      accessibilityLabel="Chargement" accessible>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: cardWidth, gap: 8 }}>
          <Skeleton style={{ width: "100%", aspectRatio: aspect, height: undefined, borderRadius: 16 }} />
          <Skeleton style={{ width: "75%", height: 14 }} />
          <Skeleton style={{ width: "50%", height: 11 }} />
        </View>
      ))}
    </ScrollView>
  );
}

export function ChipRowSkeleton() {
  return (
    <View style={[styles.row, { flexDirection: "row" }]}>
      {[72, 96, 84, 64].map((w) => <Skeleton key={w} style={{ width: w, height: 40, borderRadius: 12 }} />)}
    </View>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 14 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Skeleton style={{ width: 88, height: 66, borderRadius: 14 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ width: "80%", height: 14 }} />
            <Skeleton style={{ width: "50%", height: 11 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { paddingHorizontal: 20, gap: 12 } });
