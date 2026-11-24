import type { Barber } from "@workspace/api-client-react";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Card } from "@workspace/zbarber-design/components/native/card";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SalonListRow } from "@/components/SalonListRow";
import { ListSkeleton } from "./HomeSkeletons";
import { SectionHeader } from "./SectionHeader";

/** Server-side search preview (first 20) with hand-off to the full /salons catalog. */
export function SearchResults({ query, list, total, searching, isError, onRetry, fr }: {
  query: string; list: Barber[]; total: number; searching: boolean; isError: boolean; onRetry: () => void; fr: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  return (
    <View testID="home-search-results" style={styles.section}>
      <SectionHeader title={searching ? (fr ? "Recherche en cours" : "Searching") : `${total} ${fr ? "résultat" : "result"}${total !== 1 ? "s" : ""}`} />
      {searching ? <ListSkeleton rows={4} /> : isError ? (
        <Card style={styles.msg}>
          <Typography variant="body" color={c.mutedForeground} style={{ flex: 1 }}>{fr ? "Impossible de charger les salons." : "Salons couldn’t be loaded."}</Typography>
          <Button size="sm" variant="outline" onPress={onRetry}>{fr ? "Réessayer" : "Retry"}</Button>
        </Card>
      ) : list.length === 0 ? (
        <Card style={styles.msg}>
          <Typography variant="body" color={c.mutedForeground}>{fr ? "Aucun salon ne correspond." : "No salons match your search."}</Typography>
        </Card>
      ) : (
        <View style={styles.list}>
          {list.map((s) => <SalonListRow key={s.id} salon={s} onPress={() => router.push(`/salon/${s.id}` as never)} />)}
          {total > list.length && (
            <Button variant="outline" style={{ marginTop: 10 }} onPress={() => router.push({ pathname: "/salons", params: { search: query } })}>
              {fr ? `Voir les ${total} résultats` : `View all ${total} results`}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  list: { paddingHorizontal: 20, gap: 4 },
  msg: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
