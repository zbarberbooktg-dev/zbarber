import { Feather } from "@expo/vector-icons";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";

export function SectionHeader({ title, action, onPressAction, testID, icon }: {
  title: string; action?: string; onPressAction?: () => void; testID?: string; icon?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.row} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        {icon}
        <Typography variant="title" accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Typography>
      </View>
      {action && onPressAction ? (
        <Button variant="ghost" size="sm" onPress={onPressAction} accessibilityLabel={action} style={styles.action}>
          {action}
          <Feather name="arrow-right" size={14} color={c.primary} />
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  title: { flexShrink: 1, fontSize: 21, lineHeight: 28 },
  action: { paddingHorizontal: 6 },
});
