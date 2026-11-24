import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { SalonCardImage } from "./SalonCardImage";

type Salon = {
  salonName: string; logoUrl?: string | null; cardImageUrl?: string | null;
  neighborhood?: string | null; city?: string | null; country?: string | null; rating?: number | null;
};

export function SalonListRow({ salon, onPress, distance, showCountry }: {
  salon: Salon; onPress: () => void; distance?: string; showCountry?: boolean;
}) {
  const c = useColors();
  const place = [salon.neighborhood, salon.city, showCountry ? salon.country : null].filter(Boolean).join(" · ");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[salon.salonName, place, distance].filter(Boolean).join(", ")}
      onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
      <SalonCardImage salon={salon} iconSize={24} imageWidth={210}
        style={{ width: 68, height: 64, borderRadius: 14 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{salon.salonName}</Text>
        {!!place && <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 12 }}>{place}</Text>}
        {(!!distance || !!salon.rating) && <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
          {!!salon.rating && <><Feather name="star" size={12} color={c.primary} /><Text style={{ color: c.foreground, fontSize: 12 }}>{salon.rating.toFixed(1)}</Text></>}
          {!!distance && <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{distance}</Text>}
        </View>}
      </View>
      <Feather name="chevron-right" size={18} color={c.primary} />
    </Pressable>
  );
}
