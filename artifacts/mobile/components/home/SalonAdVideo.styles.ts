import { StyleSheet } from "react-native";

export const videoStyles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  ctl: { position: "absolute", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", opacity: 0.9 },
  tr: { right: 8, top: 8 },
  br: { right: 8, bottom: 8 },
  bl: { left: 8, bottom: 8 },
  expanded: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 6 },
  media: { flex: 1 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
