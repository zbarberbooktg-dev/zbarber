import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Card } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch, withSalon } from "@/lib/api";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type ScheduleRow = {
  day: DayKey;
  isWorking: boolean;
  startTime?: string | null;
  endTime?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
};

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

const DEFAULTS: ScheduleRow[] = DAYS.map((d) => ({
  day: d.key,
  isWorking: d.key !== "sun",
  startTime: "09:00",
  endTime: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
}));

export default function BarberHours() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const { selectedSalonId } = useApp();
  const [rows, setRows] = useState<ScheduleRow[]>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ScheduleRow[]>({
    queryKey: ["mySchedule", selectedSalonId],
    queryFn: () => fetcher<ScheduleRow[]>(withSalon("/api/barbers/me/schedule", selectedSalonId)),
  });

  useEffect(() => {
    if (data && data.length) {
      const byDay = new Map(data.map((r) => [r.day, r]));
      setRows(DAYS.map((d) => byDay.get(d.key) ?? DEFAULTS.find((x) => x.day === d.key)!));
    }
  }, [data]);

  const updateRow = (day: DayKey, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    setErr(null); setOk(null); setSaving(true);
    try {
      await fetcher(withSalon("/api/barbers/me/schedule", selectedSalonId), {
        method: "PUT",
        body: JSON.stringify(rows.map((r) => ({
          day: r.day,
          isWorking: r.isWorking,
          startTime: r.isWorking ? r.startTime ?? undefined : undefined,
          endTime: r.isWorking ? r.endTime ?? undefined : undefined,
          breakStart: r.isWorking ? r.breakStart ?? undefined : undefined,
          breakEnd: r.isWorking ? r.breakEnd ?? undefined : undefined,
        }))),
      });
      setOk("Horaires enregistrés");
      setTimeout(() => router.back(), 600);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Horaires d'ouverture", headerBackTitle: "Retour" }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {rows.map((r) => {
            const dayLabel = DAYS.find((d) => d.key === r.day)?.label ?? r.day;
            return (
              <Card key={r.day}>
                <Pressable
                  onPress={() => updateRow(r.day, { isWorking: !r.isWorking })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: r.isWorking ? 12 : 0 }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                    borderColor: r.isWorking ? c.primary : c.border,
                    backgroundColor: r.isWorking ? c.primary : "transparent",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {r.isWorking && <Feather name="check" size={14} color={c.primaryForeground} />}
                  </View>
                  <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{dayLabel}</Text>
                  <Text style={{ color: r.isWorking ? c.primary : c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {r.isWorking ? "Ouvert" : "Fermé"}
                  </Text>
                </Pressable>

                {r.isWorking && (
                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TimeInput c={c} label="Ouverture" value={r.startTime ?? ""} onChange={(v) => updateRow(r.day, { startTime: v })} />
                      <TimeInput c={c} label="Fermeture" value={r.endTime ?? ""} onChange={(v) => updateRow(r.day, { endTime: v })} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TimeInput c={c} label="Pause début" value={r.breakStart ?? ""} onChange={(v) => updateRow(r.day, { breakStart: v })} />
                      <TimeInput c={c} label="Pause fin" value={r.breakEnd ?? ""} onChange={(v) => updateRow(r.day, { breakEnd: v })} />
                    </View>
                  </View>
                )}
              </Card>
            );
          })}

          {err && <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>}
          {ok && <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>{ok}</Text>}
        </ScrollView>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Enregistrer les horaires" icon="save" onPress={handleSave} loading={saving} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function TimeInput({ c, label, value, onChange }: {
  c: ReturnType<typeof useColors>;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="09:00"
        placeholderTextColor={c.mutedForeground}
        style={{
          backgroundColor: c.background,
          color: c.foreground,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: c.radius - 4,
          padding: 10,
          fontFamily: "Inter_500Medium",
          fontSize: 14,
          textAlign: "center",
        }}
      />
    </View>
  );
}
