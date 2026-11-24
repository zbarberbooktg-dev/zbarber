import { Feather } from "@expo/vector-icons";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { resolveObjectUrl } from "@/lib/imageUpload";
import { ShimmerImage } from "./ShimmerImage";

type Props = {
  salon: { logoUrl?: string | null; cardImageUrl?: string | null };
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  imageWidth?: number;
};

export function SalonCardImage({ salon, style, iconSize = 36, imageWidth = 700 }: Props) {
  const logo = resolveObjectUrl(salon.logoUrl?.trim(), imageWidth);
  const gallery = resolveObjectUrl(salon.cardImageUrl?.trim(), imageWidth);
  return <SalonCardVisual key={JSON.stringify([logo, gallery])} logo={logo} gallery={gallery} style={style} iconSize={iconSize} />;
}

function SalonCardVisual({ logo, gallery, style, iconSize }: {
  logo: string | null; gallery: string | null; style?: StyleProp<ViewStyle>; iconSize: number;
}) {
  const c = useColors();
  const [failed, setFailed] = useState<string[]>([]);
  const uri = [logo, gallery].find((url): url is string => !!url && !failed.includes(url));
  if (uri) {
    return <ShimmerImage key={uri} source={{ uri }} style={style} contentFit="cover"
      onError={() => setFailed((previous) => [...previous, uri])} />;
  }
  // Unmistakable placeholder: flat surface, thin scissors mark, no fake photo.
  return (
    <View testID="salon-no-photo" accessibilityLabel="Photo indisponible" style={[style, styles.placeholder, { backgroundColor: c.card }]}>
      <Typography variant="display" style={{ position: "absolute", fontSize: iconSize * 3, lineHeight: iconSize * 4, opacity: 0.08 }}>Z</Typography>
      <View style={[styles.ring, { borderColor: c.border, width: iconSize * 2, height: iconSize * 2, borderRadius: iconSize }]}>
        <Feather name="scissors" size={iconSize} color={c.mutedForeground} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ring: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
