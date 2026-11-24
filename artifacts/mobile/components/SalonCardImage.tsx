import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import colors from "@/constants/colors";
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
  logo: string | null;
  gallery: string | null;
  style?: StyleProp<ViewStyle>;
  iconSize: number;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const uri = [logo, gallery].find((url): url is string => !!url && !failed.includes(url));
  if (uri) {
    return <ShimmerImage key={uri} source={{ uri }} style={style} contentFit="cover"
      onError={() => setFailed((previous) => [...previous, uri])} />;
  }
  return (
    <View testID="salon-no-photo" style={[style, styles.placeholder]}>
      <Feather name="home" size={iconSize} color={colors.light.mutedForeground} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.card,
    borderColor: colors.light.border,
    borderWidth: 1,
  },
});
