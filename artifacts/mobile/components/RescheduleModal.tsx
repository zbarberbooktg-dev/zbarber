import { useUpdateReservationStatus } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";

import { DateTimePicker } from "@/components/DateTimePicker";
import { useApp } from "@/contexts/AppContext";
import { useAuthedFetch } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  onClose: () => void;
  reservationId: number;
  barberId: number;
  serviceId: number | null | undefined;
  onRescheduled: () => void;
};

export function RescheduleModal({ visible, onClose, reservationId, barberId, serviceId, onRescheduled }: Props) {
  const c = useColors();
  const { locale } = useApp();
  const fetcher = useAuthedFetch();
  const updateStatus = useUpdateReservationStatus();
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);

  const fromIso = React.useMemo(() => {
    const d = new Date(); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);
  const toIso = React.useMemo(() => {
    // 8 weeks ahead so clients can reschedule across several weeks on the calendar.
    const d = new Date(); d.setDate(d.getDate() + 55);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const { data: availability, isLoading } = useQuery<Array<{ date: string; isWorking: boolean; isBlocked: boolean; slots: Array<{ time: string; iso: string; available: boolean }> }>>({
    queryKey: ["availability", barberId, serviceId, fromIso, toIso],
    queryFn: () => fetcher(`/api/barbers/${barberId}/availability?from=${fromIso}&to=${toIso}${serviceId ? `&serviceId=${serviceId}` : ""}`),
    enabled: visible && !!barberId,
  });

  React.useEffect(() => {
    if (!visible) setSelectedSlot(null);
  }, [visible]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    try {
      await updateStatus.mutateAsync({ id: reservationId, data: { scheduledAt: selectedSlot } });
      onRescheduled();
      onClose();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de modifier le rendez-vous.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
        >
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 6 }}>
            Modifier le rendez-vous
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 18 }}>
            Choisissez un nouveau créneau disponible.
          </Text>

          {isLoading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <DateTimePicker
              availability={availability}
              value={selectedSlot}
              onChange={setSelectedSlot}
              locale={locale}
              placeholder="Choisir une date et une heure"
              emptyLabel="Aucun créneau disponible"
            />
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 13, borderRadius: c.radius - 4,
                backgroundColor: c.muted, alignItems: "center", opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!selectedSlot || updateStatus.isPending}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 13, borderRadius: c.radius - 4,
                backgroundColor: c.primary, alignItems: "center",
                opacity: !selectedSlot || updateStatus.isPending ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              {updateStatus.isPending ? (
                <ActivityIndicator color={c.primaryForeground} size="small" />
              ) : (
                <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Confirmer</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
