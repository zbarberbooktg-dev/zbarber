import { Feather } from "@expo/vector-icons";
import { getListNotificationsQueryKey, useMarkNotificationRead, type Notification } from "@workspace/api-client-react";
import { Button } from "@workspace/zbarber-design/components/native/button";
import { Card } from "@workspace/zbarber-design/components/native/card";
import { Typography } from "@workspace/zbarber-design/components/native/typography";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { FlatList, Modal, Platform, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListSkeleton } from "./HomeSkeletons";

/** Lists the signed-in user's real notifications; tapping an unread one marks it read. */
export function NotificationsSheet({ visible, onClose, items, loading, error, refreshing, onRefresh, fr }: {
  visible: boolean; onClose: () => void; items: Notification[] | undefined; loading: boolean; error: boolean;
  refreshing: boolean; onRefresh: () => void; fr: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const markRead = useMarkNotificationRead({
    mutation: { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }); } },
  });
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(fr ? "fr-FR" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const sorted = [...(items ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View testID="home-notifications" style={[styles.root, { backgroundColor: c.background,
        paddingTop: Platform.OS === "web" ? 67 : insets.top, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom }]}>
        <View style={styles.header}>
          <Typography variant="title" accessibilityRole="header" style={{ flex: 1 }}>Notifications</Typography>
          <Button variant="ghost" size="icon" onPress={onClose} testID="home-notifications-close"
            accessibilityLabel={fr ? "Fermer les notifications" : "Close notifications"}>
            <Feather name="x" size={20} color={c.foreground} />
          </Button>
        </View>
        {markRead.isError && <Typography color={c.destructive} style={{ marginHorizontal: 20, marginBottom: 8 }} accessibilityLiveRegion="polite">
          {fr ? "Impossible de marquer cette notification comme lue. Réessayez." : "Could not mark this notification as read. Try again."}
        </Typography>}
        {loading ? <View style={{ paddingTop: 8 }}><ListSkeleton rows={4} /></View> : error ? (
          <Card style={styles.msg}>
            <Typography variant="body" color={c.mutedForeground} style={{ flex: 1 }}>
              {fr ? "Impossible de charger vos notifications." : "Your notifications couldn't be loaded."}
            </Typography>
            <Button size="sm" variant="outline" onPress={onRefresh}>{fr ? "Réessayer" : "Retry"}</Button>
          </Card>
        ) : (
          <FlatList data={sorted} keyExtractor={(n) => String(n.id)} contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="bell-off" size={26} color={c.mutedForeground} />
                <Typography variant="body" color={c.mutedForeground} style={{ textAlign: "center" }}>
                  {fr ? "Aucune notification pour le moment." : "No notifications yet."}
                </Typography>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable disabled={item.isRead || markRead.isPending} onPress={() => markRead.mutate({ id: item.id })}
                accessibilityRole="button" accessibilityState={{ disabled: item.isRead }}
                accessibilityLabel={`${item.isRead ? "" : fr ? "Non lue. " : "Unread. "}${item.title}. ${item.message ?? ""}`}
                accessibilityHint={item.isRead ? undefined : fr ? "Marquer comme lue" : "Mark as read"}
                style={({ pressed }) => [styles.item, { backgroundColor: c.card, opacity: pressed ? 0.8 : 1 }]}>
                <View style={[styles.dot, { backgroundColor: item.isRead ? "transparent" : c.primary }]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Typography variant="subtitle" style={{ fontSize: 15 }}>{item.title}</Typography>
                  {!!item.message && <Typography variant="body" color={c.mutedForeground}>{item.message}</Typography>}
                  <Typography variant="caption" color={c.mutedForeground}>
                    {fmt(item.createdAt)}{item.isRead ? (fr ? " · Lue" : " · Read") : (fr ? " · Non lue" : " · Unread")}
                  </Typography>
                </View>
              </Pressable>
            )} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, paddingVertical: 6 },
  list: { padding: 20, gap: 10, flexGrow: 1 },
  item: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  msg: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 60 },
});
