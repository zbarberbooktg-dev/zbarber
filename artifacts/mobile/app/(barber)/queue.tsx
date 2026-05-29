import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

type MyBarber = { id: number; salonName: string };
type Service = { id: number; name: string };
type WalkInStatus = "waiting" | "in_progress" | "done" | "cancelled";
type WalkIn = {
  id: number;
  serviceId: number | null;
  clientName: string;
  clientPhone: string | null;
  status: WalkInStatus;
  position: number;
  notes: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<WalkInStatus, string> = {
  waiting: "En attente",
  in_progress: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};

export default function BarberQueue() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: salons, isLoading: salonsLoading } = useQuery<MyBarber[]>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarber[]>("/api/barbers/me"),
  });
  // The walk-in queue API operates on the barber's primary salon (`/barbers/me/queue`),
  // so we always use the primary salon here to stay consistent with the backend.
  const barber = salons && salons.length > 0 ? salons[0] : null;

  const { data: services } = useQuery<Service[]>({
    queryKey: ["barberServices", barber?.id],
    queryFn: () => fetcher<Service[]>(`/api/barbers/${barber!.id}/services`),
    enabled: !!barber,
  });

  const { data: items, isLoading } = useQuery<WalkIn[]>({
    queryKey: ["myQueue", barber?.id],
    queryFn: () => fetcher<WalkIn[]>("/api/barbers/me/queue"),
    enabled: !!barber,
    refetchInterval: 20000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["myQueue", barber?.id] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: WalkInStatus }) => {
      await fetcher(`/api/barbers/me/queue/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    },
    onSuccess: invalidate,
  });

  const removeEntry = useMutation({
    mutationFn: async (id: number) => {
      await fetcher(`/api/barbers/me/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  const handleAdd = async () => {
    if (!clientName.trim()) {
      Alert.alert("Nom requis", "Entrez le nom du client.");
      return;
    }
    setSaving(true);
    try {
      await fetcher("/api/barbers/me/queue", {
        method: "POST",
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim() || null,
          serviceId: serviceId ?? null,
        }),
      });
      setClientName("");
      setClientPhone("");
      setServiceId(null);
      invalidate();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'ajouter.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (id: number) => {
    Alert.alert("Retirer ?", "Retirer ce client de la file.", [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => removeEntry.mutate(id) },
    ]);
  };

  if (salonsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!barber) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
        <Feather name="users" size={32} color={c.mutedForeground} />
        <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>Aucun salon trouvé</Text>
        <Pressable onPress={() => router.replace("/(barber)")} style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: c.primary }}>
          <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Tableau de bord</Text>
        </Pressable>
      </View>
    );
  }

  const waiting = (items ?? []).filter((i) => i.status === "waiting" || i.status === "in_progress");
  const finished = (items ?? []).filter((i) => i.status === "done" || i.status === "cancelled");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20, flex: 1 }}>File d'attente</Text>
      </View>

      {/* Add walk-in */}
      <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Ajouter un client</Text>
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          placeholder="Nom du client"
          placeholderTextColor={c.mutedForeground}
          style={{ backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius - 4, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14 }}
        />
        <TextInput
          value={clientPhone}
          onChangeText={setClientPhone}
          placeholder="Téléphone (optionnel)"
          placeholderTextColor={c.mutedForeground}
          keyboardType="phone-pad"
          style={{ backgroundColor: c.muted, color: c.foreground, borderRadius: c.radius - 4, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14 }}
        />
        {services && services.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {services.map((s) => {
              const active = serviceId === s.id;
              return (
                <Pressable key={s.id} onPress={() => setServiceId(active ? null : s.id)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? c.primary : c.muted }}>
                  <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{s.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Pressable
          onPress={handleAdd}
          disabled={saving}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: c.radius, backgroundColor: c.primary, opacity: pressed || saving ? 0.7 : 1 })}
        >
          {saving ? <ActivityIndicator color={c.primaryForeground} /> : (
            <>
              <Feather name="user-plus" size={16} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>Ajouter à la file</Text>
            </>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : waiting.length === 0 && finished.length === 0 ? (
        <EmptyState icon="users" title="File vide" description="Ajoutez des clients sans rendez-vous pour gérer l'ordre de passage." />
      ) : (
        <>
          {waiting.length > 0 && (
            <View style={{ gap: 10 }}>
              {waiting.map((item, idx) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  order={idx + 1}
                  serviceName={services?.find((s) => s.id === item.serviceId)?.name ?? null}
                  c={c}
                  onStart={() => setStatus.mutate({ id: item.id, status: "in_progress" })}
                  onDone={() => setStatus.mutate({ id: item.id, status: "done" })}
                  onCancel={() => setStatus.mutate({ id: item.id, status: "cancelled" })}
                  onRemove={() => confirmRemove(item.id)}
                />
              ))}
            </View>
          )}
          {finished.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Historique</Text>
              {finished.map((item) => (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 12, opacity: 0.7 }}>
                  <Feather name={item.status === "done" ? "check-circle" : "x-circle"} size={16} color={item.status === "done" ? c.primary : c.destructive} />
                  <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{item.clientName}</Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>{STATUS_LABEL[item.status]}</Text>
                  <Pressable onPress={() => confirmRemove(item.id)} hitSlop={8}>
                    <Feather name="trash-2" size={15} color={c.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function QueueCard({
  item, order, serviceName, c, onStart, onDone, onCancel, onRemove,
}: {
  item: WalkIn;
  order: number;
  serviceName: string | null;
  c: ReturnType<typeof useColors>;
  onStart: () => void;
  onDone: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const active = item.status === "in_progress";
  return (
    <View style={{ backgroundColor: c.card, borderRadius: c.radius, borderWidth: 1, borderColor: active ? c.primary : c.border, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: active ? c.primary : c.muted, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{order}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{item.clientName}</Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
            {serviceName ?? "Sans service"}{item.clientPhone ? ` · ${item.clientPhone}` : ""}
          </Text>
        </View>
        {active && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: c.primary }}>
            <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>En cours</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!active && (
          <ActionBtn label="Démarrer" icon="play" onPress={onStart} c={c} variant="primary" />
        )}
        {active && (
          <ActionBtn label="Terminer" icon="check" onPress={onDone} c={c} variant="primary" />
        )}
        <ActionBtn label="Annuler" icon="slash" onPress={onCancel} c={c} variant="muted" />
        <Pressable onPress={onRemove} hitSlop={8} style={{ width: 40, alignItems: "center", justifyContent: "center", borderRadius: c.radius - 4, borderWidth: 1, borderColor: c.border }}>
          <Feather name="trash-2" size={16} color={c.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

function ActionBtn({ label, icon, onPress, c, variant }: { label: string; icon: any; onPress: () => void; c: ReturnType<typeof useColors>; variant: "primary" | "muted" }) {
  const bg = variant === "primary" ? c.primary : c.muted;
  const fg = variant === "primary" ? c.primaryForeground : c.foreground;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: c.radius - 4, backgroundColor: bg, opacity: pressed ? 0.7 : 1 })}>
      <Feather name={icon} size={14} color={fg} />
      <Text style={{ color: fg, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
