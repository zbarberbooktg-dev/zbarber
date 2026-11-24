import { Feather } from "@expo/vector-icons";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Card } from "@workspace/zbarber-design/components/native/card";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

export function CatalogFooter({ fr, signedIn }: { fr: boolean; signedIn: boolean }) {
  const c = useColors();
  const router = useRouter();
  return (
    <View testID="home-salon-catalog-preview" style={styles.wrap}>
      <Button variant="outline" size="lg" onPress={() => router.push("/salons")} style={styles.full}>
        {fr ? "Voir le catalogue complet des salons" : "Browse the full salon directory"}
        <Feather name="arrow-right" size={16} color={c.primary} />
      </Button>
      {!signedIn && (
        <Card style={styles.cta}>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="subtitle">{fr ? "Vous êtes barbier ?" : "Are you a barber?"}</Typography>
            <Typography variant="caption" color={c.mutedForeground}>{fr ? "Publiez votre salon et gérez vos rendez-vous." : "List your salon and manage your appointments."}</Typography>
          </View>
          <Button size="sm" onPress={() => router.push("/(auth)/sign-up")}>{fr ? "Démarrer" : "Get started"}</Button>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 14, marginBottom: 12 },
  full: { justifyContent: "space-between" },
  cta: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
