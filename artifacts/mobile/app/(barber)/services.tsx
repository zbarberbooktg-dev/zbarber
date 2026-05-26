import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Card, EmptyState, Pill } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

type Service = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
};

type MyBarberItem = { id: number };

export default function BarberServices() {
  const c = useColors();
  const fetcher = useAuthedFetch();
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: myBarbers } = useQuery<MyBarberItem[]>({
    queryKey: ["barbersMe"],
    queryFn: () => fetcher<MyBarberItem[]>("/api/barbers/me"),
  });

  const barberId = myBarbers?.[0]?.id;
  const { data, isLoading, refetch, isRefetching } = useQuery<Service[]>({
    queryKey: ["mySalonServices", barberId],
    enabled: !!barberId,
    queryFn: () => fetcher<Service[]>(`/api/barbers/${barberId}/services`),
  });

  const services = data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Button label="Ajouter un service" icon="plus" onPress={() => setCreating(true)} fullWidth />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="scissors"
              title="Aucun service"
              description="Ajoutez vos prestations pour que vos clients puissent réserver."
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => setEditing(item)}>
              {({ pressed }) => (
                <Card style={{ opacity: pressed ? 0.85 : 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>{item.name}</Text>
                      {item.description && (
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                        <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{item.price.toLocaleString()} FC</Text>
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{item.durationMinutes} min</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Pill label={item.isActive ? "Actif" : "Inactif"} tone={item.isActive ? "success" : "neutral"} />
                      <Feather name="edit-2" size={14} color={c.mutedForeground} />
                    </View>
                  </View>
                </Card>
              )}
            </Pressable>
          )}
        />
      )}

      <ServiceModal
        visible={creating || !!editing}
        service={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); refetch(); }}
        barberId={barberId}
      />
    </View>
  );
}

function ServiceModal({
  visible, service, onClose, onSaved, barberId,
}: {
  visible: boolean;
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
  barberId: number | undefined;
}) {
  const c = useColors();
  const fetcher = useAuthedFetch();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setPrice(service?.price != null ? String(service.price) : "");
    setDuration(service?.durationMinutes != null ? String(service.durationMinutes) : "");
    setIsActive(service?.isActive ?? true);
    setErr(null);
  }, [visible, service]);

  const handleSave = async () => {
    setErr(null);
    const p = parseFloat(price);
    const d = parseInt(duration, 10);
    if (!name.trim()) return setErr("Le nom est obligatoire");
    if (!Number.isFinite(p) || p <= 0) return setErr("Prix invalide");
    if (!Number.isFinite(d) || d <= 0) return setErr("Durée invalide");
    if (!barberId) return setErr("Profil salon introuvable");
    setSaving(true);
    try {
      if (service) {
        await fetcher(`/api/services/${service.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            price: p,
            durationMinutes: d,
            isActive,
          }),
        });
      } else {
        await fetcher(`/api/barbers/${barberId}/services`, {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            price: p,
            durationMinutes: d,
          }),
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!service) return;
    setSaving(true);
    try {
      await fetcher(`/api/services/${service.id}`, { method: "DELETE" });
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>Annuler</Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>{service ? "Modifier" : "Nouveau service"}</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={10}>
            {saving ? <ActivityIndicator color={c.primary} size="small" />
              : <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enregistrer</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 96 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Field label="Nom *">
            <TextInput value={name} onChangeText={setName} placeholder="Coupe homme" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>
          <Field label="Description">
            <TextInput value={description} onChangeText={setDescription} multiline placeholder="Détails de la prestation" placeholderTextColor={c.mutedForeground} style={[inputStyle(c), { minHeight: 70, textAlignVertical: "top" }]} />
          </Field>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Prix (FC) *">
                <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="15000" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Durée (min) *">
                <TextInput value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="30" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
              </Field>
            </View>
          </View>

          {service && (
            <Pressable onPress={() => setIsActive((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: isActive ? c.primary : c.border,
                backgroundColor: isActive ? c.primary : "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {isActive && <Feather name="check" size={14} color={c.primaryForeground} />}
              </View>
              <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                Service actif et réservable
              </Text>
            </Pressable>
          )}

          {err && <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>}

          {service && (
            <View style={{ marginTop: 24 }}>
              <Button label="Supprimer ce service" variant="destructive" icon="trash-2" onPress={handleDelete} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View>
      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(c: ReturnType<typeof useColors>) {
  return {
    backgroundColor: c.card,
    color: c.foreground,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: c.radius,
    padding: 14,
    fontFamily: "Inter_400Regular" as const,
  };
}
