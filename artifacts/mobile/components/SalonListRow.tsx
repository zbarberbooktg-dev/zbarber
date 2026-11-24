import { Feather } from "@expo/vector-icons";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { Pressable, View } from "react-native";
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
      onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, opacity: pressed ? 0.65 : 1 })}>
      <SalonCardImage salon={salon} iconSize={16} imageWidth={240}
        style={{ width: 88, aspectRatio: 4 / 3, borderRadius: 14 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Typography variant="subtitle" numberOfLines={1} style={{ fontSize: 15 }}>{salon.salonName}</Typography>
        {!!place && <Typography variant="caption" color={c.mutedForeground} numberOfLines={1}>{place}</Typography>}
        {(!!distance || !!salon.rating) && <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {!!salon.rating && <><Feather name="star" size={11} color={c.primary} /><Typography variant="caption">{salon.rating.toFixed(1)}</Typography></>}
          {!!distance && <Typography variant="caption" color={c.mutedForeground}>{distance}</Typography>}
        </View>}
      </View>
      <Feather name="chevron-right" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}
