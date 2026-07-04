import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Location from "expo-location";
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
import { LocationPickerMap } from "@/components/LocationPickerMap";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch, withSalon } from "@/lib/api";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type HoursRow = {
  day: DayKey;
  isAvailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
};

type Zone = { maxRadiusKm: number; fee: number };

type HomeServiceConfig = {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  hours: HoursRow[];
  zones: Array<{ id: number; maxRadiusKm: number; fee: number }>;
};

const DAYS: { key: DayKey; labelFr: string; labelEn: string }[] = [
  { key: "mon", labelFr: "Lundi", labelEn: "Monday" },
  { key: "tue", labelFr: "Mardi", labelEn: "Tuesday" },
  { key: "wed", labelFr: "Mercredi", labelEn: "Wednesday" },
  { key: "thu", labelFr: "Jeudi", labelEn: "Thursday" },
  { key: "fri", labelFr: "Vendredi", labelEn: "Friday" },
  { key: "sat", labelFr: "Samedi", labelEn: "Saturday" },
  { key: "sun", labelFr: "Dimanche", labelEn: "Sunday" },
];

const DEFAULT_HOURS: HoursRow[] = DAYS.map((d) => ({
  day: d.key,
  isAvailable: false,
  startTime: "09:00",
  endTime: "18:00",
}));

export default function BarberHomeService() {
  const c = useColors();
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const { selectedSalonId, t, locale } = useApp();
  const isFr = String(locale).startsWith("fr");

  const [enabled, setEnabled] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  // Bumped on a fresh GPS capture so the map recenters; dragging the marker must not.
  const [coordsSeq, setCoordsSeq] = useState(0);
  const [hours, setHours] = useState<HoursRow[]>(DEFAULT_HOURS);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const { data, isLoading } = useQuery<HomeServiceConfig>({
    queryKey: ["myHomeService", selectedSalonId],
    queryFn: () => fetcher<HomeServiceConfig>(withSalon("/api/barbers/me/home-service", selectedSalonId)),
  });

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    if (data.latitude != null && data.longitude != null) {
      setCoords({ latitude: data.latitude, longitude: data.longitude });
    }
    if (data.hours?.length) {
      const byDay = new Map(data.hours.map((h) => [h.day, h]));
      setHours(DAYS.map((d) => byDay.get(d.key) ?? DEFAULT_HOURS.find((x) => x.day === d.key)!));
    }
    if (data.zones) setZones(data.zones.map((z) => ({ maxRadiusKm: z.maxRadiusKm, fee: z.fee })));
  }, [data]);

  const updateRow = (day: DayKey, patch: Partial<HoursRow>) => {
    setHours((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  };

  const captureLocation = async () => {
    setErr(null); setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setErr(t.hsPermissionDenied); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setCoordsSeq((n) => n + 1);
    } catch {
      setErr(t.hsPermissionDenied);
    } finally {
      setLocating(false);
    }
  };

  const addZone = () => setZones((prev) => [...prev, { maxRadiusKm: 5, fee: 5000 }]);
  const removeZone = (idx: number) => setZones((prev) => prev.filter((_, i) => i !== idx));
  const updateZone = (idx: number, patch: Partial<Zone>) =>
    setZones((prev) => prev.map((z, i) => (i === idx ? { ...z, ...patch } : z)));

  const handleSave = async () => {
    setErr(null); setOk(null);
    const validZones = zones.filter((z) => z.maxRadiusKm > 0);
    if (enabled && !coords) { setErr(t.hsNeedLocation); return; }
    // Enabling the home service requires at least one distance zone so the client
    // can be shown a travel fee automatically.
    if (enabled && validZones.length === 0) { setErr(t.hsNeedZones); return; }
    setSaving(true);
    try {
      await fetcher(withSalon("/api/barbers/me/home-service", selectedSalonId), {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
          hours: hours.map((h) => ({
            day: h.day,
            isAvailable: h.isAvailable,
            startTime: h.isAvailable ? h.startTime ?? undefined : undefined,
            endTime: h.isAvailable ? h.endTime ?? undefined : undefined,
          })),
          zones: zones
            .filter((z) => z.maxRadiusKm > 0)
            .map((z) => ({ maxRadiusKm: z.maxRadiusKm, fee: Math.max(0, z.fee) })),
        }),
      });
      setOk(t.hsSaved);
      setTimeout(() => router.back(), 700);
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
      <Stack.Screen options={{ title: t.hsTitle, headerBackTitle: "Retour" }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Enable toggle */}
          <Card>
            <Pressable
              onPress={() => setEnabled((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: enabled ? c.primary : c.border,
                backgroundColor: enabled ? c.primary : "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {enabled && <Feather name="check" size={14} color={c.primaryForeground} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{t.hsEnable}</Text>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>{t.hsEnableHint}</Text>
              </View>
            </Pressable>
          </Card>

          {/* Salon GPS location */}
          <Card>
            <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{t.hsSalonLocation}</Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, marginBottom: 12 }}>{t.hsSalonLocationHint}</Text>
            {coords && (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="map-pin" size={14} color={c.primary} />
                  <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    {t.hsLocationSet}: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  </Text>
                </View>
                <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  {t.hsSalonMapHint}
                </Text>
                <LocationPickerMap
                  latitude={coords.latitude}
                  longitude={coords.longitude}
                  onChange={(lat, lng) => setCoords({ latitude: lat, longitude: lng })}
                  recenterKey={coordsSeq}
                  height={200}
                  tint={c.primary}
                  background={c.card}
                />
              </View>
            )}
            <Button
              label={t.hsUseMyLocation}
              icon="crosshair"
              variant="secondary"
              onPress={captureLocation}
              loading={locating}
              fullWidth
            />
          </Card>

          {/* Weekly home-visit hours */}
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 4 }}>{t.hsHours}</Text>
          {hours.map((r) => {
            const dayLabel = DAYS.find((d) => d.key === r.day);
            return (
              <Card key={r.day}>
                <Pressable
                  onPress={() => updateRow(r.day, { isAvailable: !r.isAvailable })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: r.isAvailable ? 12 : 0 }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                    borderColor: r.isAvailable ? c.primary : c.border,
                    backgroundColor: r.isAvailable ? c.primary : "transparent",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {r.isAvailable && <Feather name="check" size={14} color={c.primaryForeground} />}
                  </View>
                  <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
                    {isFr ? dayLabel?.labelFr : dayLabel?.labelEn}
                  </Text>
                  <Text style={{ color: r.isAvailable ? c.primary : c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    {r.isAvailable ? (isFr ? "Disponible" : "Available") : (isFr ? "Indisponible" : "Off")}
                  </Text>
                </Pressable>

                {r.isAvailable && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TimeInput c={c} label={isFr ? "Début" : "Start"} value={r.startTime ?? ""} onChange={(v) => updateRow(r.day, { startTime: v })} />
                    <TimeInput c={c} label={isFr ? "Fin" : "End"} value={r.endTime ?? ""} onChange={(v) => updateRow(r.day, { endTime: v })} />
                  </View>
                )}
              </Card>
            );
          })}

          {/* Fee zones */}
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 4 }}>{t.hsZones}</Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -6 }}>{t.hsZonesHint}</Text>
          {zones.map((z, idx) => (
            <Card key={idx}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <NumInput c={c} label={t.hsZoneRadius} value={z.maxRadiusKm} onChange={(v) => updateZone(idx, { maxRadiusKm: v })} />
                <NumInput c={c} label={t.hsZoneFee} value={z.fee} onChange={(v) => updateZone(idx, { fee: v })} />
                <Pressable
                  onPress={() => removeZone(idx)}
                  style={{ padding: 10, marginBottom: 1 }}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={18} color={c.destructive} />
                </Pressable>
              </View>
            </Card>
          ))}
          <Button label={t.hsAddZone} icon="plus" variant="secondary" onPress={addZone} fullWidth />

          {err && <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>}
          {ok && <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>{ok}</Text>}
        </ScrollView>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label={t.hsSave} icon="save" onPress={handleSave} loading={saving} fullWidth />
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

function NumInput({ c, label, value, onChange }: {
  c: ReturnType<typeof useColors>;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(v) => {
          const cleaned = v.replace(/[^0-9.]/g, "");
          setText(cleaned);
          const n = parseFloat(cleaned);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="numeric"
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
