import { Feather } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";

export function AppHeaderBack({ lang, onPress }: { lang: string; onPress: () => void }) {
  const c = useColors();
  const label = lang === "fr" ? "Retour" : "Back";
  return (
    <Pressable
      testID="screen-header-back"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 12 }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        paddingRight: 8,
        gap: 3,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Feather name="chevron-left" size={23} color={c.primary} />
      <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
