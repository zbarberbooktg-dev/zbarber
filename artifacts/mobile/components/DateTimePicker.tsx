import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type AvailabilityDay = {
  date: string; // YYYY-MM-DD
  isWorking: boolean;
  isBlocked: boolean;
  slots: Array<{ time: string; iso: string; available: boolean; reason?: string }>;
};

type Props = {
  availability: AvailabilityDay[] | undefined;
  value: string | null;
  onChange: (iso: string) => void;
  locale: string;
  placeholder?: string;
  emptyLabel?: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday-first month grid: array of weeks, each a 7-length array of Date.
function buildMonthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

// A calendar (multi-week) + digital time-slot grid picker. Replaces the flat
// slot dropdown so clients can plan appointments several weeks ahead: pick a
// day on the calendar, then pick a time from the digital HH:MM grid for that
// day.
export function DateTimePicker({ availability, value, onChange, locale, placeholder, emptyLabel }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    for (const day of availability ?? []) map.set(day.date, day);
    return map;
  }, [availability]);

  const selectedDay = useMemo(() => {
    for (const day of availability ?? []) {
      if (day.slots.some((s) => s.iso === value)) return day;
    }
    return null;
  }, [availability, value]);

  const selectedTime = useMemo(() => {
    if (!selectedDay) return null;
    return selectedDay.slots.find((s) => s.iso === value)?.time ?? null;
  }, [selectedDay, value]);

  const minDate = availability?.[0]?.date ?? null;
  const maxDate = availability?.[availability.length - 1]?.date ?? null;

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activeDate, setActiveDate] = useState<string | null>(selectedDay?.date ?? null);

  const openPicker = () => {
    const base = selectedDay ? new Date(selectedDay.date + "T00:00:00") : today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setActiveDate(selectedDay?.date ?? null);
    setOpen(true);
  };

  const weeks = useMemo(() => buildMonthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonthDisabled = minDate != null && new Date(viewYear, viewMonth, 0) < new Date(minDate + "T00:00:00");
  const nextMonthDisabled = maxDate != null && new Date(viewYear, viewMonth + 1, 1) > new Date(maxDate + "T00:00:00");

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "").slice(0, 2);
    });
  }, [locale]);

  const activeDay = activeDate ? byDate.get(activeDate) ?? null : null;
  const activeDaySlots = activeDay?.slots.filter((s) => s.available) ?? [];

  const triggerLabel = selectedDay && selectedTime
    ? `${new Date(selectedDay.date + "T00:00:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · ${selectedTime}`
    : null;

  const hasAnySlot = (availability ?? []).some((d) => d.slots.some((s) => s.available));

  return (
    <>
      <Pressable
        onPress={() => hasAnySlot && openPicker()}
        disabled={!hasAnySlot}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: triggerLabel ? c.primary : c.border,
          backgroundColor: c.card,
          opacity: !hasAnySlot ? 0.6 : pressed ? 0.85 : 1,
          borderRadius: c.radius - 4,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Feather name="calendar" size={16} color={triggerLabel ? c.primary : c.mutedForeground} />
          <Text
            style={{
              color: triggerLabel ? c.foreground : c.mutedForeground,
              fontFamily: triggerLabel ? "Inter_600SemiBold" : "Inter_400Regular",
              fontSize: 14,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {triggerLabel ?? (!hasAnySlot ? (emptyLabel ?? "Aucun créneau disponible") : (placeholder ?? "Choisir une date et une heure"))}
          </Text>
        </View>
        <Feather name="chevron-down" size={18} color={c.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 24,
              maxHeight: "88%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                {placeholder ?? "Choisir une date et une heure"}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={c.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {/* Month navigation */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Pressable
                  onPress={() => {
                    if (prevMonthDisabled) return;
                    const d = new Date(viewYear, viewMonth - 1, 1);
                    setViewYear(d.getFullYear());
                    setViewMonth(d.getMonth());
                  }}
                  disabled={prevMonthDisabled}
                  hitSlop={10}
                  style={{ opacity: prevMonthDisabled ? 0.3 : 1, padding: 6 }}
                >
                  <Feather name="chevron-left" size={20} color={c.foreground} />
                </Pressable>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textTransform: "capitalize" }}>
                  {monthLabel}
                </Text>
                <Pressable
                  onPress={() => {
                    if (nextMonthDisabled) return;
                    const d = new Date(viewYear, viewMonth + 1, 1);
                    setViewYear(d.getFullYear());
                    setViewMonth(d.getMonth());
                  }}
                  disabled={nextMonthDisabled}
                  hitSlop={10}
                  style={{ opacity: nextMonthDisabled ? 0.3 : 1, padding: 6 }}
                >
                  <Feather name="chevron-right" size={20} color={c.foreground} />
                </Pressable>
              </View>

              {/* Weekday header */}
              <View style={{ flexDirection: "row", marginBottom: 4 }}>
                {weekdayLabels.map((w, i) => (
                  <View key={i} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase" }}>
                      {w}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              {weeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
                  {week.map((date, di) => {
                    const iso = toISODate(date);
                    const inMonth = date.getMonth() === viewMonth;
                    const dayData = byDate.get(iso);
                    const inRange = !!dayData;
                    const hasSlots = inRange && dayData!.isWorking && !dayData!.isBlocked && dayData!.slots.some((s) => s.available);
                    const isActive = activeDate === iso;
                    const isToday = iso === toISODate(today);
                    const disabled = !inMonth || !hasSlots;

                    return (
                      <Pressable
                        key={di}
                        onPress={() => {
                          if (disabled) return;
                          setActiveDate(iso);
                        }}
                        disabled={disabled}
                        style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isActive ? c.primary : "transparent",
                            borderWidth: isToday && !isActive ? 1 : 0,
                            borderColor: c.primary,
                          }}
                        >
                          <Text
                            style={{
                              color: !inMonth ? c.border : isActive ? c.primaryForeground : hasSlots ? c.foreground : c.mutedForeground,
                              fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                              fontSize: 13,
                              opacity: disabled && inMonth ? 0.4 : 1,
                            }}
                          >
                            {date.getDate()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {/* Digital time grid for the active day */}
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10 }}>
                  {activeDate
                    ? new Date(activeDate + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
                    : "Sélectionnez une date"}
                </Text>
                {activeDate && activeDaySlots.length === 0 && (
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                    Aucun créneau disponible ce jour-là.
                  </Text>
                )}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {activeDaySlots.map((s) => {
                    const active = s.iso === value;
                    return (
                      <Pressable
                        key={s.iso}
                        onPress={() => {
                          onChange(s.iso);
                          setOpen(false);
                        }}
                        style={({ pressed }) => ({
                          minWidth: 76,
                          alignItems: "center",
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: c.radius - 6,
                          borderWidth: 1,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.accent : pressed ? c.muted : "transparent",
                        })}
                      >
                        <Text
                          style={{
                            color: active ? c.primary : c.foreground,
                            fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                            fontSize: 14,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {s.time}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
