import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListReservationsQueryKey, useGetBarber, useListBarberServices } from "@workspace/api-client-react";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateTimePicker, type AvailabilityDay } from "@/components/DateTimePicker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LocationPickerMap } from "@/components/LocationPickerMap";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";
import { salonReservationHref } from "@/lib/reservationRoute";

type Point = { latitude: number; longitude: number };
type Quote = { inRange: boolean; fee: number | null; distanceKm: number };
type Mode = "salon" | "home";

const dateOnly = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const barberId = Number(id);
  const { userId } = useAuth();
  const c = useColors();
  const { lang } = useApp();
  if (!salonReservationHref(id)) {
    return <View style={{ flex: 1, backgroundColor: c.background, padding: 20 }}>
      <Text style={{ color: c.foreground }}>{lang === "fr" ? "Salon introuvable." : "Salon not found."}</Text>
    </View>;
  }
  return <BookingForm key={`${barberId}:${userId ?? "guest"}`} barberId={barberId} />;
}

function BookingForm({ barberId }: { barberId: number }) {
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { lang, locale, t, signingOut } = useApp();
  const fetcher = useAuthedFetch();
  const fr = lang === "fr";
  const barber = useGetBarber(barberId);
  const serviceList = useListBarberServices(barberId);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("salon");
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<Point | null>(null);
  const [gpsSeq, setGpsSeq] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  const [window] = useState(() => {
    const first = new Date();
    const last = new Date(first);
    last.setDate(last.getDate() + 55);
    return { from: dateOnly(first), to: dateOnly(last) };
  });

  const service = serviceList.data?.find((s) => s.isActive && s.id === serviceId);
  const services = (serviceList.data ?? []).filter((s) => s.isActive);
  const home = useQuery({
    queryKey: ["homeServicePublic", barberId],
    queryFn: ({ signal }) => fetcher<{ enabled: boolean }>(`/api/barbers/${barberId}/home-service`, { signal }),
    enabled: !!barber.data && !barber.isError,
  });
  const availability = useQuery({
    queryKey: ["availability", barberId, serviceId, window.from, window.to, mode],
    queryFn: ({ signal }) => fetcher<AvailabilityDay[]>(`/api/barbers/${barberId}/availability?from=${window.from}&to=${window.to}&serviceId=${serviceId}&mode=${mode}`, { signal }),
    enabled: !!service && (mode === "salon" || home.data?.enabled === true),
  });
  const quote = useQuery({
    queryKey: ["booking-home-quote", userId, barberId, coords?.latitude, coords?.longitude],
    queryFn: ({ signal }) => fetcher<Quote>(`/api/barbers/${barberId}/home-service/quote`, {
      method: "POST", body: JSON.stringify(coords), signal,
    }),
    enabled: !!isSignedIn && !!coords && mode === "home" && home.data?.enabled === true,
    gcTime: 0,
    retry: false,
  });
  const money = (n: number) => `${n.toLocaleString(locale)} FC`;
  const salonName = barber.data?.salonName;
  const address = [barber.data?.address, barber.data?.neighborhood, barber.data?.city].filter(Boolean).join(" · ");
  const day = availability.data?.find((d) => d.isWorking && !d.isBlocked && d.slots.some((s) => s.iso === slot && s.available));
  const picked = day?.slots.find((s) => s.iso === slot && s.available);
  const slotText = day && picked ? `${new Date(`${day.date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} · ${picked.time}` : null;
  const hasSlots = availability.data?.some((d) => d.isWorking && !d.isBlocked && d.slots.some((s) => s.available));
  const fee = mode === "home" && !quote.isError && quote.data?.inRange ? quote.data.fee : null;
  const validPlace = mode === "salon" || (home.data?.enabled === true && !!coords && !locating && !quote.isFetching && fee !== null && Number.isFinite(fee) && fee >= 0);
  const valid = !!service && !!picked && !availability.isError && validPlace;
  const signIn = () => router.push({ pathname: "/(auth)/sign-in", params: { bookingSalon: String(barberId) } });
  const choose = (next: Mode) => {
    if (submitting.current) return;
    setMode(next);
    setSlot(null);
    setSubmitError("");
  };
  const locate = async () => {
    if (locating || submitting.current) return;
    setLocating(true);
    setLocationError("");
    setSubmitError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setLocationError(t.hsPermissionDenied); return; }
      const { coords: point } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: point.latitude, longitude: point.longitude });
      setGpsSeq((n) => n + 1);
    } catch {
      setLocationError(fr ? "Impossible de récupérer votre position. Réessayez." : "We couldn't get your location. Try again.");
    } finally { setLocating(false); }
  };

  const submit = async () => {
    if (sent || submitting.current || !isLoaded || signingOut) return;
    if (!isSignedIn) { signIn(); return; }
    if (!valid || !picked || !service || new Date(picked.iso).getTime() <= Date.now()) {
      setSubmitError(fr ? "Vérifiez le service, le lieu et le créneau choisi." : "Check the service, location and selected time.");
      void availability.refetch();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setSubmitError("");
    try {
      await fetcher("/api/reservations", {
        method: "POST",
        body: JSON.stringify({
          barberId, serviceId: service.id, scheduledAt: picked.iso,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(mode === "home" && coords ? { isHomeService: true, ...coords } : {}),
        }),
      });
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ["availability", barberId] });
    } catch (error) {
      let message = "";
      try { message = JSON.parse(error instanceof Error ? error.message : "").error ?? ""; } catch { /* handled below */ }
      if (message === "Slot already booked") {
        setSlot(null);
        setSubmitError(fr ? "Ce créneau vient d’être pris. Choisissez une autre heure." : "That time was just booked. Choose another time.");
        void availability.refetch();
      } else {
        setSubmitError(fr ? "Impossible d’envoyer la réservation. Vérifiez les informations ou réessayez." : "The request could not be sent. Check the details or try again.");
        if (mode === "home") void quote.refetch();
      }
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  };

  const title = { color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 } as const;
  const caption = { color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 } as const;
  const card = { padding: 16, gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: c.radius } as const;
  const highlight = c.isDark ? c.primary : c.foreground;
  const step = (number: number, label: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: c.accent }}>
        <Text style={{ color: highlight, fontFamily: "Inter_700Bold" }}>{number}</Text>
      </View>
      <Text accessibilityRole="header" style={[title, { flex: 1 }]}>{label}</Text>
    </View>
  );
  const action = (label: string, onPress: () => void, id: string, disabled = false, filled = false) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: c.radius, backgroundColor: filled ? c.primary : c.secondary, opacity: disabled ? 0.50 : pressed ? 0.85 : 1 })}>
      <Text style={{ color: filled && c.isDark ? c.primaryForeground : c.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ width: "100%", maxWidth: 700, alignSelf: "center", gap: 14, paddingHorizontal: 16, paddingTop: 20, paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 16) + 16 }}>
      <View style={{ gap: 6, marginBottom: 3 }}>
        <Text style={{ color: highlight, fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 1.1 }}>{fr ? "RENDEZ-VOUS" : "APPOINTMENT"}</Text>
        <Text accessibilityRole="header" style={[title, { fontSize: 27, lineHeight: 34 }]}>{salonName ?? (fr ? "Votre réservation" : "Your booking")}</Text>
        <Text style={caption}>{fr ? "Choisissez votre prestation, le lieu et un horaire. Vérifiez le récapitulatif avant d’envoyer votre demande." : "Choose a service, location and time. Check the summary before sending your request."}</Text>
      </View>
      {sent ? (
        <View testID="reservation-sent" style={card}>
          <Feather name="check-circle" color={c.success} size={28} />
          <Text accessibilityRole="header" style={title}>{fr ? "Demande envoyée" : "Request sent"}</Text>
          <Text style={caption}>{fr ? "Votre rendez-vous est en attente de confirmation par le salon." : "Your appointment is awaiting confirmation from the salon."}</Text>
          {action(fr ? "Voir mes réservations" : "View my bookings", () => router.replace("/(client)/bookings"), "reservation-my-bookings", false, true)}
        </View>
      ) : barber.isError || serviceList.isError ? (
        <View style={card}><Text style={caption}>{fr ? "Impossible de charger ce salon ou ses prestations." : "We couldn't load this salon or its services."}</Text>
          {action(fr ? "Réessayer" : "Try again", () => { void barber.refetch(); void serviceList.refetch(); }, "reservation-retry")}
        </View>
      ) : barber.isLoading || serviceList.isLoading ? <ActivityIndicator color={c.primary} /> : !services.length ? (
        <View style={card}><Text style={caption}>{fr ? "Ce salon ne propose pas encore de réservation en ligne." : "This salon does not offer online booking yet."}</Text></View>
      ) : (
        <>
          {isLoaded && !isSignedIn && (
            <View style={[card, { backgroundColor: c.accent }]}>
              <Text style={caption}>{fr ? "Connectez-vous avant de choisir et d’envoyer votre réservation." : "Sign in before choosing and sending your booking."}</Text>
              {action(fr ? "Se connecter" : "Sign in", signIn, "reservation-sign-in")}
            </View>
          )}
          <View style={card}>
            {step(1, fr ? "Choisir une prestation" : "Choose a service")}
            <Text style={caption}>{fr ? "Sélectionnez le service souhaité. Sa durée détermine les horaires proposés." : "Select a service. Its duration determines the times offered."}</Text>
            {services.map((s) => {
              const active = serviceId === s.id;
              return <Pressable key={s.id} testID={`reservation-service-${s.id}`} accessibilityRole="radio" accessibilityState={{ checked: active, disabled: saving }} disabled={saving}
                onPress={() => { if (serviceId !== s.id) { setServiceId(s.id); setSlot(null); setSubmitError(""); } }}
                style={{ padding: 12, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.accent : c.background, borderRadius: c.radius, flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
                <Feather name={active ? "check-circle" : "circle"} color={active ? highlight : c.mutedForeground} size={17} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[title, { fontSize: 15 }]}>{s.name}</Text>
                  {!!s.description && <Text style={caption}>{s.description}</Text>}
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={{ color: highlight, fontFamily: "Inter_700Bold" }}>{money(Number(s.price))}</Text>
                  <Text style={caption}>{s.durationMinutes} min</Text>
                </View>
              </Pressable>;
            })}
          </View>
          <View style={card}>
            {step(2, fr ? "Préciser le lieu" : "Choose the location")}
            <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
              {(["salon", ...(home.data?.enabled ? ["home"] : [])] as Mode[]).map((option) => (
                <Pressable key={option} testID={`reservation-mode-${option}`} onPress={() => mode !== option && choose(option)}
                  accessibilityRole="radio" accessibilityState={{ checked: mode === option, disabled: saving }} disabled={saving}
                  style={{ flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 46, padding: 9, backgroundColor: mode === option ? c.accent : c.background, borderWidth: 1, borderColor: mode === option ? c.primary : c.border, borderRadius: c.radius }}>
                  <Feather name={option === "salon" ? "map-pin" : "home"} size={15} color={highlight} />
                  <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" }}>{option === "salon" ? t.hsModeSalon : t.hsModeHome}</Text>
                </Pressable>
              ))}
            </View>
            {home.isError && <View style={{ gap: 6 }}>
              <Text style={caption}>{fr ? "Impossible de vérifier l’option à domicile." : "The home visit option could not be checked."}</Text>
              {action(fr ? "Réessayer" : "Try again", () => { void home.refetch(); }, "reservation-home-retry")}
            </View>}
            {mode === "salon" ? (
              <Text style={caption}>{address || (fr ? "Le rendez-vous se déroule au salon." : "The appointment takes place at the salon.")}</Text>
            ) : (
              <>
                <Text style={caption}>{fr ? "Indiquez le lieu exact du rendez-vous pour vérifier la zone et calculer les frais de déplacement." : "Share the appointment location to check the service area and travel fee."}</Text>
                {isSignedIn ? action(locating ? t.hsLocating : t.hsUseMyLocation, () => { void locate(); }, "reservation-locate", locating || saving)
                  : action(fr ? "Se connecter pour indiquer le lieu" : "Sign in to set the location", signIn, "reservation-quote-sign-in")}
                {!!locationError && <Text accessibilityRole="alert" style={caption}>{locationError}</Text>}
                {!!coords && (
                  <View pointerEvents={saving ? "none" : "auto"} style={{ gap: 8 }}>
                    <Text style={caption}>{t.hsMapHint}</Text>
                    <LocationPickerMap latitude={coords.latitude} longitude={coords.longitude} recenterKey={gpsSeq} height={225}
                      onChange={(latitude, longitude) => { setCoords({ latitude, longitude }); setSubmitError(""); }} tint={c.primary} background={c.card} />
                    {quote.isFetching ? <ActivityIndicator color={c.primary} /> : quote.isError ? action(fr ? "Recalculer les frais" : "Retry travel quote", () => { void quote.refetch(); }, "reservation-quote-retry", saving)
                      : quote.data?.inRange === false ? <Text accessibilityRole="alert" style={caption}>{t.hsOutOfRange}</Text>
                        : fee !== null && <Text style={caption}>{t.hsQuoteDistance} : {quote.data?.distanceKm} km · {t.hsQuoteFee} : {money(fee)}</Text>}
                  </View>
                )}
              </>
            )}
          </View>
          <View style={card}>
            {step(3, fr ? "Choisir une date et une heure" : "Choose a date and time")}
            {!service ? <Text style={caption}>{fr ? "Choisissez d’abord une prestation pour voir les créneaux." : "Choose a service first to see the available times."}</Text>
              : availability.isError ? <>
                <Text style={caption}>{fr ? "Impossible de charger les créneaux." : "Available times could not be loaded."}</Text>
                {action(fr ? "Réessayer" : "Try again", () => { void availability.refetch(); }, "reservation-slots-retry")}
              </> : availability.isFetching && !availability.data ? <ActivityIndicator color={c.primary} />
                : hasSlots ? <View pointerEvents={saving ? "none" : "auto"}>
                  <DateTimePicker availability={availability.data} value={picked ? slot : null} locale={locale}
                    onChange={(iso) => { if (!submitting.current) { setSlot(iso); setSubmitError(""); } }}
                    placeholder={fr ? "Ouvrir le calendrier" : "Open the calendar"} />
                </View> : <Text style={caption}>{fr ? "Aucun créneau disponible pour cette prestation et ce lieu." : "No times are available for this service and location."}</Text>}
            {slotText && <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" }}>{slotText}</Text>}
          </View>
          <View style={card}>
            {step(4, fr ? "Vérifier et envoyer" : "Review and send")}
            <Text style={caption}>{fr ? "Une précision pour le salon ? (facultatif)" : "Anything the salon should know? (optional)"}</Text>
            <TextInput testID="reservation-notes" accessibilityLabel={fr ? "Précision facultative" : "Optional note"} value={notes}
              onChangeText={setNotes} multiline maxLength={500} editable={!saving}
              placeholder={fr ? "Ex. : préférences de coupe" : "E.g. haircut preferences"} placeholderTextColor={c.mutedForeground}
              style={{ minHeight: 72, textAlignVertical: "top", padding: 12, color: c.foreground, borderWidth: 1, borderColor: c.border, borderRadius: c.radius, backgroundColor: c.background }} />
            {service ? (
              <View style={{ padding: 12, gap: 5, backgroundColor: c.secondary, borderRadius: c.radius }}>
                <Text style={[title, { fontSize: 15 }]}>{service.name} · {service.durationMinutes} min</Text>
                <Text style={caption}>{slotText ?? (fr ? "Créneau à choisir" : "Choose a time")}</Text>
                <Text style={caption}>{mode === "salon" ? t.hsModeSalon : t.hsModeHome}{mode === "home" && fee !== null ? ` · ${t.hsQuoteFee} : ${money(fee)}` : ""}</Text>
                {mode === "salon" || fee !== null
                  ? <Text style={{ color: highlight, fontFamily: "Inter_700Bold" }}>{fr ? "Total estimé" : "Estimated total"} : {money(Number(service.price) + (fee ?? 0))}</Text>
                  : <Text style={caption}>{fr ? "Les frais de déplacement restent à calculer." : "Travel fees still need to be calculated."}</Text>}
              </View>
            ) : <Text style={caption}>{fr ? "Le récapitulatif apparaîtra après la sélection de la prestation." : "The summary will appear once you choose a service."}</Text>}
            <Text style={caption}>{fr ? "Le salon doit confirmer le rendez-vous. Cette étape ne débite aucun paiement." : "The salon must confirm the appointment. No payment is taken here."}</Text>
            {!!submitError && <Text testID="reservation-error" accessibilityRole="alert" style={{ color: c.destructive }}>{submitError}</Text>}
            {action(saving ? (fr ? "Envoi en cours…" : "Sending…") : !isSignedIn ? (fr ? "Se connecter pour réserver" : "Sign in to book") : (fr ? "Envoyer la demande" : "Send booking request"),
              () => { void submit(); }, "reservation-submit", saving || signingOut || !isLoaded || (!!isSignedIn && !valid), true)}
          </View>
        </>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}
