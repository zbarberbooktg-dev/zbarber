import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSupportTicketQueryKey,
  getListSupportTicketsQueryKey,
  useCreateSupportTicket,
  useGetSupportTicket,
  useListSupportTickets,
  useReplyToSupportTicket,
  type SupportTicketDraftCategory,
  type SupportTicketSummary,
} from "@workspace/api-client-react";
import { Redirect, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Button, Card } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type View_ = { kind: "list" } | { kind: "new" } | { kind: "thread"; id: number };

const POLL_MS = 20_000;

function errText(e: unknown, fallback: string) {
  const data = (e as { data?: { error?: unknown; message?: unknown } } | undefined)?.data;
  return typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : fallback;
}

function useFocused() {
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  return focused;
}

export default function SupportScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { ready, user, authSyncError, syncAuth, syncing, lang } = useApp();
  const c = useColors();
  if (isLoaded && isSignedIn && ready && !user && authSyncError && !syncing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", gap: 14, padding: 20, backgroundColor: c.background }}>
        <Text style={{ color: c.foreground, textAlign: "center" }}>
          {lang === "fr" ? "Impossible de charger votre compte." : "Your account could not be loaded."}
        </Text>
        <Button label={lang === "fr" ? "Réessayer" : "Retry"} onPress={() => { void syncAuth().catch(() => {}); }} />
      </View>
    );
  }
  if (!isLoaded || !ready || (isSignedIn && !user)) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}><ActivityIndicator color={c.primary} /></View>;
  }
  if (!isSignedIn || !user) return <Redirect href="/" />;
  return <SupportInner key={user.id} userId={user.id} />;
}

function SupportInner({ userId }: { userId: number }) {
  const c = useColors();
  const { lang } = useApp();
  const fr = lang === "fr";
  const [view, setView] = useState<View_>({ kind: "list" });
  const webBottom = Platform.OS === "web" ? 34 : 0;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 + webBottom }}
    >
      {view.kind !== "list" && (
        <Pressable testID="support-back" accessibilityRole="button" onPress={() => setView({ kind: "list" })} hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }}>
          <Feather name="arrow-left" size={18} color={c.primary} />
          <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>{fr ? "Mes demandes" : "My requests"}</Text>
        </Pressable>
      )}
      {view.kind === "list" && <TicketList userId={userId} fr={fr} onNew={() => setView({ kind: "new" })} onOpen={(id) => setView({ kind: "thread", id })} />}
      {view.kind === "new" && <NewTicket userId={userId} fr={fr} onCreated={(id) => setView({ kind: "thread", id })} />}
      {view.kind === "thread" && <Thread userId={userId} id={view.id} fr={fr} />}
    </KeyboardAwareScrollViewCompat>
  );
}

const CATS: Array<{ key: SupportTicketDraftCategory; fr: string; en: string; icon: keyof typeof Feather.glyphMap; prompt: [string, string] }> = [
  { key: "booking", fr: "Réservation", en: "Booking", icon: "calendar", prompt: ["Indiquez le salon, la date et l'heure du rendez-vous, puis ce qui s'est passé.", "Mention the salon, appointment date and time, then what happened."] },
  { key: "salon", fr: "Salon", en: "Salon", icon: "scissors", prompt: ["Nommez le salon concerné et décrivez la situation ou la correction souhaitée.", "Name the salon and describe the situation or the change you need."] },
  { key: "account", fr: "Compte", en: "Account", icon: "user", prompt: ["Décrivez ce que vous essayiez de faire et le message affiché, le cas échéant.", "Describe what you were trying to do and any message shown."] },
  { key: "other", fr: "Autre", en: "Other", icon: "help-circle", prompt: ["Expliquez votre demande avec le plus de détails utiles possible.", "Explain your request with as much useful detail as you can."] },
];

const catLabel = (k: string, fr: boolean) => { const f = CATS.find((x) => x.key === k); return f ? (fr ? f.fr : f.en) : k; };

function StatusPill({ status, fr }: { status: string; fr: boolean }) {
  const c = useColors();
  const open = status === "open";
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: open ? c.accent : c.muted }}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: open ? c.foreground : c.mutedForeground }}>
        {open ? (fr ? "Ouvert" : "Open") : (fr ? "Clôturé" : "Closed")}
      </Text>
    </View>
  );
}

const fmt = (iso: string, fr: boolean) => new Date(iso).toLocaleString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function TicketList({ userId, fr, onNew, onOpen }: { userId: number; fr: boolean; onNew: () => void; onOpen: (id: number) => void }) {
  const c = useColors();
  const focused = useFocused();
  const [cursors, setCursors] = useState<Array<number | undefined>>([undefined]);
  const before = cursors[cursors.length - 1];
  const params = before ? { before } : undefined;
  const q = useListSupportTickets(params, { query: {
    queryKey: [...getListSupportTicketsQueryKey(params), "user", userId],
    refetchInterval: focused ? POLL_MS : false,
  } });
  const items = q.data?.items ?? [];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>{fr ? "Parlons-en" : "Let's sort it out"}</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 14, lineHeight: 20 }}>
          {fr ? "Votre message arrive directement à l'équipe Zbarber. Nous répondons ici." : "Your message goes straight to the Zbarber team. We reply right here."}
        </Text>
      </View>
      <Button label={fr ? "Nouvelle demande" : "New request"} icon="edit-3" onPress={onNew} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {fr ? "Mes demandes" : "My requests"}
        </Text>
        <Pressable testID="support-refresh" accessibilityRole="button" accessibilityLabel={fr ? "Actualiser" : "Refresh"} onPress={() => q.refetch()} hitSlop={10}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          {q.isFetching ? <ActivityIndicator size="small" color={c.primary} /> : <Feather name="refresh-cw" size={16} color={c.primary} />}
        </Pressable>
      </View>
      {q.isLoading ? (
        [0, 1, 2].map((i) => <View key={i} style={{ height: 68, borderRadius: c.radius, backgroundColor: c.muted, opacity: 0.7 }} />)
      ) : q.isError ? (
        <Card>
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
            <Feather name="wifi-off" size={22} color={c.destructive} />
            <Text style={{ color: c.foreground, textAlign: "center" }}>{fr ? "Impossible de charger vos demandes." : "Your requests could not be loaded."}</Text>
            <Button label={fr ? "Réessayer" : "Retry"} variant="secondary" icon="refresh-cw" onPress={() => q.refetch()} />
          </View>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Feather name="inbox" size={22} color={c.primary} />
            </View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold" }}>{cursors.length > 1 ? (fr ? "Plus rien ici" : "Nothing more here") : (fr ? "Aucune demande pour l'instant" : "No requests yet")}</Text>
            <Text style={{ color: c.mutedForeground, fontSize: 13, textAlign: "center" }}>{fr ? "Une question sur un rendez-vous ou un salon ? Écrivez-nous." : "A question about a booking or a salon? Write to us."}</Text>
          </View>
        </Card>
      ) : (
        <View style={{ backgroundColor: c.card, borderRadius: c.radius + 4, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
          {items.map((tk: SupportTicketSummary, i) => (
            <Pressable key={tk.id} testID={`support-ticket-${tk.id}`} onPress={() => onOpen(tk.id)}
              style={({ pressed }) => ({ padding: 14, gap: 6, minHeight: 56, borderTopWidth: i ? 1 : 0, borderColor: c.border, backgroundColor: pressed ? c.muted : "transparent" })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{tk.subject}</Text>
                <StatusPill status={tk.status} fr={fr} />
              </View>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{catLabel(tk.category, fr)} · {fmt(tk.updatedAt, fr)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {(cursors.length > 1 || q.data?.nextBefore) && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {cursors.length > 1 && <View style={{ flex: 1 }}><Button label={fr ? "Plus récentes" : "Newer"} variant="ghost" icon="chevron-left" onPress={() => setCursors((s) => s.slice(0, -1))} /></View>}
          {q.data?.nextBefore ? <View style={{ flex: 1 }}><Button label={fr ? "Plus anciennes" : "Older"} variant="secondary" icon="chevron-right" onPress={() => setCursors((s) => [...s, q.data!.nextBefore!])} /></View> : null}
        </View>
      )}
    </View>
  );
}

function NewTicket({ userId, fr, onCreated }: { userId: number; fr: boolean; onCreated: (id: number) => void }) {
  const c = useColors();
  const qc = useQueryClient();
  const [category, setCategory] = useState<SupportTicketDraftCategory | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateSupportTicket();
  const cat = CATS.find((x) => x.key === category);
  const s = subject.trim(), m = message.trim();
  const valid = !!category && s.length >= 3 && s.length <= 120 && m.length >= 10 && m.length <= 4000;

  const submit = () => {
    if (!valid || !category || create.isPending) return;
    setError(null);
    create.mutate({ data: { category, subject: s, message: m } }, {
      onSuccess: (thread) => {
        qc.setQueryData([...getGetSupportTicketQueryKey(thread.ticket.id), "user", userId], thread);
        qc.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
        onCreated(thread.ticket.id);
      },
      onError: (e) => setError(errText(e, fr ? "L'envoi a échoué. Vérifiez votre connexion et réessayez." : "Sending failed. Check your connection and try again.")),
    });
  };

  const inputStyle = { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: c.radius, paddingHorizontal: 14, paddingVertical: 12, color: c.foreground, fontSize: 15, fontFamily: "Inter_400Regular" } as const;
  const label = (n: string, txt: string) => (
    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}><Text style={{ color: c.primary }}>{n}  </Text>{txt}</Text>
  );

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 22 }}>{fr ? "Dites-nous tout" : "Tell us what's up"}</Text>
      <View style={{ gap: 10 }}>
        {label("1", fr ? "C'est à propos de..." : "This is about...")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATS.map((x) => {
            const active = category === x.key;
            return (
              <Pressable key={x.key} testID={`support-cat-${x.key}`} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setCategory(x.key)}
                style={{ flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: c.radius, borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.accent : c.card }}>
                <Feather name={x.icon} size={16} color={active ? c.primary : c.mutedForeground} />
                <Text style={{ color: c.foreground, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium" }}>{fr ? x.fr : x.en}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {cat && (
        <>
          <View style={{ gap: 8 }}>
            {label("2", fr ? "En quelques mots" : "In a few words")}
            <TextInput testID="support-subject" value={subject} onChangeText={setSubject} maxLength={120} editable={!create.isPending} accessibilityLabel={fr ? "Sujet" : "Subject"} placeholder={fr ? "Ex. : rendez-vous non confirmé" : "E.g. appointment not confirmed"} placeholderTextColor={c.mutedForeground} style={inputStyle} />
          </View>
          <View style={{ gap: 8 }}>
            {label("3", fr ? "Votre message" : "Your message")}
            <View style={{ flexDirection: "row", gap: 8, backgroundColor: c.muted, borderRadius: c.radius, padding: 10 }}>
              <Feather name="info" size={14} color={c.primary} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, color: c.mutedForeground, fontSize: 13, lineHeight: 18 }}>{fr ? cat.prompt[0] : cat.prompt[1]}</Text>
            </View>
            <TextInput testID="support-message" value={message} onChangeText={setMessage} maxLength={4000} editable={!create.isPending} accessibilityLabel={fr ? "Votre message" : "Your message"} multiline textAlignVertical="top"
              placeholder={fr ? "Écrivez comme vous le diriez au salon..." : "Write it like you'd tell the salon..."} placeholderTextColor={c.mutedForeground}
              style={[inputStyle, { minHeight: 140 }]} />
            <Text style={{ color: m.length > 0 && m.length < 10 ? c.warning : c.mutedForeground, fontSize: 12, textAlign: "right" }}>
              {m.length < 10 ? (fr ? `Encore ${10 - m.length} caractères minimum` : `${10 - m.length} more characters needed`) : `${m.length}/4000`}
            </Text>
          </View>
        </>
      )}
      {error && <Text testID="support-create-error" style={{ color: c.destructive, fontSize: 13 }}>{error}</Text>}
      <Button label={fr ? "Envoyer à l'équipe" : "Send to the team"} icon="send" loading={create.isPending} disabled={!valid || create.isPending} onPress={submit} />
    </View>
  );
}

function Thread({ userId, id, fr }: { userId: number; id: number; fr: boolean }) {
  const c = useColors();
  const qc = useQueryClient();
  const focused = useFocused();
  const key = [...getGetSupportTicketQueryKey(id), "user", userId];
  const q = useGetSupportTicket(id, { query: { queryKey: key, refetchInterval: focused ? POLL_MS : false } });
  const reply = useReplyToSupportTicket();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (!sent) return; const t = setTimeout(() => setSent(false), 2500); return () => clearTimeout(t); }, [sent]);

  if (q.isLoading) return <View style={{ gap: 10 }}>{[0, 1].map((i) => <View key={i} style={{ height: 80, borderRadius: c.radius, backgroundColor: c.muted }} />)}</View>;
  if (q.isError || !q.data) return (
    <Card><View style={{ alignItems: "center", gap: 10 }}>
      <Text style={{ color: c.foreground }}>{fr ? "Impossible d'afficher cette demande." : "This request could not be shown."}</Text>
      <Button label={fr ? "Réessayer" : "Retry"} variant="secondary" icon="refresh-cw" onPress={() => q.refetch()} />
    </View></Card>
  );
  const { ticket, messages } = q.data;
  const open = ticket.status === "open";

  const send = () => {
    const msg = text.trim();
    if (!msg || reply.isPending) return;
    setError(null);
    reply.mutate({ id, data: { message: msg } }, {
      onSuccess: () => {
        setText(""); setSent(true);
        qc.invalidateQueries({ queryKey: key });
        qc.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
      },
      onError: (e) => {
        setError(errText(e, fr ? "Message non envoyé. Réessayez." : "Message not sent. Please retry."));
        qc.invalidateQueries({ queryKey: key });
      },
    });
  };

  return (
    <View style={{ gap: 14 }} testID="support-thread">
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{catLabel(ticket.category, fr)} · #{ticket.id}</Text>
          <StatusPill status={ticket.status} fr={fr} />
        </View>
        <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>{ticket.subject}</Text>
      </View>
      {messages.map((msg) => {
        const mine = msg.author === "user";
        return (
          <View key={msg.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "88%", gap: 4 }}>
            <Text style={{ color: c.mutedForeground, fontSize: 11, textAlign: mine ? "right" : "left" }}>
              {mine ? (fr ? "Vous" : "You") : (fr ? "Équipe Zbarber" : "Zbarber team")} · {fmt(msg.createdAt, fr)}
            </Text>
            <View style={{ padding: 12, borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, backgroundColor: mine ? c.accent : c.card, borderWidth: 1, borderColor: mine ? c.accent : c.border }}>
              <Text style={{ color: c.foreground, fontSize: 15, lineHeight: 21 }}>{msg.message}</Text>
            </View>
          </View>
        );
      })}
      {messages.every((m) => m.author === "user") && open && (
        <Text style={{ color: c.mutedForeground, fontSize: 13, textAlign: "center" }}>{fr ? "Bien reçu. L'équipe vous répondra ici." : "Received. The team will reply here."}</Text>
      )}
      {open ? (
        <View style={{ gap: 8 }}>
          <TextInput testID="support-reply" value={text} onChangeText={setText} editable={!reply.isPending} accessibilityLabel={fr ? "Votre réponse" : "Your reply"} multiline maxLength={4000} textAlignVertical="top"
            placeholder={fr ? "Ajouter une précision..." : "Add a detail..."} placeholderTextColor={c.mutedForeground}
            style={{ minHeight: 80, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: c.radius, padding: 12, color: c.foreground, fontSize: 15 }} />
          {error && <Text style={{ color: c.destructive, fontSize: 13 }}>{error}</Text>}
          {sent && <Text style={{ color: c.success, fontSize: 13 }}>{fr ? "Message envoyé" : "Message sent"}</Text>}
          <Button label={fr ? "Envoyer" : "Send"} icon="send" loading={reply.isPending} disabled={!text.trim() || reply.isPending} onPress={send} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: c.radius, backgroundColor: c.muted }}>
          <Feather name="lock" size={14} color={c.mutedForeground} />
          <Text style={{ flex: 1, color: c.mutedForeground, fontSize: 13 }}>{fr ? "Cette demande est clôturée. Ouvrez-en une nouvelle si besoin." : "This request is closed. Start a new one if needed."}</Text>
        </View>
      )}
    </View>
  );
}
