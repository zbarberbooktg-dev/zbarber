import { Feather } from "@expo/vector-icons";
import { getListServiceCategoriesQueryKey, useListServiceCategories } from "@workspace/api-client-react";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ChipRowSkeleton } from "./HomeSkeletons";

type FeatherName = React.ComponentProps<typeof Feather>["name"];
const iconFor = (icon?: string | null): FeatherName =>
  icon && icon in Feather.glyphMap ? (icon as FeatherName) : "scissors";

/** Real platform categories; selecting one filters the "À découvrir" section. Hidden when none exist. */
export function CategoryRow({ selectedId, onSelect, fr }: { selectedId: number | null; onSelect: (id: number | null, name: string | null) => void; fr: boolean }) {
  const c = useColors();
  const categories = useListServiceCategories({ query: { queryKey: getListServiceCategoriesQueryKey(), staleTime: 5 * 60_000 } });
  if (categories.isLoading) return <View style={styles.wrap}><ChipRowSkeleton /></View>;
  if (categories.isError || !categories.data?.length) return null;
  const chip = (active: boolean) => active ? "default" as const : "secondary" as const;
  return (
    <View style={styles.wrap} testID="home-categories">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Button size="sm" variant={chip(selectedId === null)} accessibilityState={{ selected: selectedId === null }}
          onPress={() => onSelect(null, null)}>
          {fr ? "Tous" : "All"}
        </Button>
        {categories.data.map((cat) => {
          const active = selectedId === cat.id;
          return (
            <Button key={cat.id} size="sm" variant={chip(active)} accessibilityState={{ selected: active }}
              testID={`home-category-${cat.id}`} onPress={() => onSelect(active ? null : cat.id, active ? null : cat.name)}>
              <Feather name={iconFor(cat.icon)} size={14} color={active ? c.primaryForeground : c.primary} />
              {cat.name}
            </Button>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 26 },
  row: { paddingHorizontal: 20, gap: 8 },
});
