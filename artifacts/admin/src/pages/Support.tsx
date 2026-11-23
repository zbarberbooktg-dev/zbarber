import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Inbox, Lock, MessageSquare, RefreshCw, Send, Settings2 } from "lucide-react";
import {
  getGetSupportLinksQueryKey,
  getGetSupportTicketQueryKey,
  getListSupportTicketsQueryKey,
  useCloseSupportTicket,
  useGetSupportLinks,
  useGetSupportTicket,
  useListSupportTickets,
  useReplyToSupportTicket,
  useSaveSupportLinks,
  type SupportLinks,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

const POLL = 20_000;
const CAT: Record<string, [string, string]> = { account: ["Compte", "Account"], booking: ["Réservation", "Booking"], salon: ["Salon", "Salon"], other: ["Autre", "Other"] };

function useVisible() {
  const [v, setV] = useState(typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const on = () => setV(document.visibilityState === "visible" && document.hasFocus());
    window.addEventListener("focus", on); window.addEventListener("blur", on); document.addEventListener("visibilitychange", on);
    return () => { window.removeEventListener("focus", on); window.removeEventListener("blur", on); document.removeEventListener("visibilitychange", on); };
  }, []);
  return v;
}

function apiText(err: unknown): string | null {
  const d = (err as any)?.data;
  return typeof d?.error === "string" ? d.error : typeof d?.message === "string" ? d.message : null;
}

function Status({ s, fr }: { s: string; fr: boolean }) {
  const open = s === "open";
  return (
    <span data-testid="status-ticket" className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${open ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "bg-muted text-muted-foreground"}`}>
      {open ? (fr ? "Ouvert" : "Open") : (fr ? "Clôturé" : "Closed")}
    </span>
  );
}

export default function Support() {
  const { lang } = useT();
  const fr = lang === "fr";
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");
  return (
    <div>
      <PageHeader title="Assistance" subtitle={fr ? "Demandes des utilisateurs et canaux de contact" : "User requests and contact channels"} />
      <div className="mb-5 inline-flex rounded-lg border bg-card p-1">
        {([["inbox", fr ? "Boîte de réception" : "Inbox", Inbox], ["settings", fr ? "Liens de contact" : "Contact links", Settings2]] as const).map(([k, l, I]) => (
          <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${tab === k ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
            <I className="h-4 w-4" />{l}
          </button>
        ))}
      </div>
      {tab === "inbox" ? <InboxView fr={fr} /> : <LinksForm fr={fr} />}
    </div>
  );
}

function InboxView({ fr }: { fr: boolean }) {
  const visible = useVisible();
  const { admin } = useAdminAuth();
  const [cursors, setCursors] = useState<Array<number | undefined>>([undefined]);
  const before = cursors[cursors.length - 1];
  const params = before ? { before } : undefined;
  const q = useListSupportTickets(params, { query: {
    queryKey: [...getListSupportTicketsQueryKey(params), "admin", admin?.id],
    refetchInterval: visible ? POLL : false,
    gcTime: 0,
  } });
  const [selected, setSelected] = useState<number | null>(null);
  const items = q.data?.items ?? [];
  const fmt = (s: string) => new Date(s).toLocaleString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">{fr ? "Demandes" : "Requests"}</span>
          <button data-testid="button-refresh-tickets" onClick={() => q.refetch()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="refresh">
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        {q.isLoading ? (
          <div className="p-3 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />)}</div>
        ) : q.isError ? (
          <div className="p-6 text-center text-sm space-y-3">
            <p className="text-muted-foreground">{fr ? "Impossible de charger les demandes." : "Could not load requests."}</p>
            <button onClick={() => q.refetch()} className="rounded-md border px-3 py-1.5 hover:bg-muted">{fr ? "Réessayer" : "Retry"}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">{fr ? "Boîte vide" : "Inbox is empty"}</p>
            <p className="text-xs text-muted-foreground mt-1">{fr ? "Les nouvelles demandes apparaîtront ici." : "New requests will appear here."}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((tk) => (
              <li key={tk.id}>
                <button data-testid={`row-ticket-${tk.id}`} onClick={() => setSelected(tk.id)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${selected === tk.id ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/40"}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">{tk.subject}</span>
                    <Status s={tk.status} fr={fr} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {tk.requesterName ?? "—"} · {CAT[tk.category]?.[fr ? 0 : 1] ?? tk.category} · {fmt(tk.updatedAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(cursors.length > 1 || q.data?.nextBefore) && (
          <div className="mt-auto flex justify-between border-t px-3 py-2">
            <button data-testid="button-page-newer" disabled={cursors.length <= 1} onClick={() => setCursors((s) => s.slice(0, -1))} className="flex items-center gap-1 rounded-md px-2 py-1 text-sm disabled:opacity-40 hover:bg-muted"><ChevronLeft className="h-4 w-4" />{fr ? "Récentes" : "Newer"}</button>
            <button data-testid="button-page-older" disabled={!q.data?.nextBefore} onClick={() => setCursors((s) => [...s, q.data!.nextBefore!])} className="flex items-center gap-1 rounded-md px-2 py-1 text-sm disabled:opacity-40 hover:bg-muted">{fr ? "Anciennes" : "Older"}<ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {selected ? <ThreadPanel key={selected} id={selected} fr={fr} visible={visible} fmt={fmt} /> : (
        <div className="hidden lg:flex rounded-xl border border-dashed items-center justify-center p-10 text-center text-sm text-muted-foreground">
          <div><MessageSquare className="mx-auto h-8 w-8 opacity-50 mb-2" />{fr ? "Sélectionnez une demande pour lire la conversation." : "Select a request to read the conversation."}</div>
        </div>
      )}
    </div>
  );
}

function ThreadPanel({ id, fr, visible, fmt }: { id: number; fr: boolean; visible: boolean; fmt: (s: string) => string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useT();
  const { admin } = useAdminAuth();
  const q = useGetSupportTicket(id, { query: {
    queryKey: [...getGetSupportTicketQueryKey(id), "admin", admin?.id],
    refetchInterval: visible ? POLL : false,
    gcTime: 0,
  } });
  const reply = useReplyToSupportTicket();
  const close = useCloseSupportTicket();
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetSupportTicketQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
  };
  const fail = (e: unknown) => { toast({ title: apiText(e) ?? formatApiError(e, t.errors), variant: "destructive" as any }); refresh(); };

  if (q.isLoading) return <div className="rounded-xl border bg-card p-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)}</div>;
  if (q.isError || !q.data) return (
    <div className="rounded-xl border bg-card p-6 text-sm text-center space-y-3">
      <p className="text-muted-foreground">{fr ? "Conversation indisponible." : "Conversation unavailable."}</p>
      <button onClick={() => q.refetch()} className="rounded-md border px-3 py-1.5 hover:bg-muted">{fr ? "Réessayer" : "Retry"}</button>
    </div>
  );
  const { ticket, messages } = q.data;
  const open = ticket.status === "open";

  return (
    <div className="rounded-xl border bg-card flex flex-col min-h-[520px]" data-testid="panel-thread">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">#{ticket.id} · {CAT[ticket.category]?.[fr ? 0 : 1]} · {ticket.requesterName ?? ""}</p>
          <h2 className="mt-0.5 font-semibold truncate">{ticket.subject}</h2>
        </div>
        <Status s={ticket.status} fr={fr} />
        {open && (confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{fr ? "Clôturer ?" : "Close?"}</span>
            <button data-testid="button-confirm-close" disabled={close.isPending} onClick={() => close.mutate({ id }, {
              onSuccess: () => { setConfirming(false); toast({ title: fr ? "Demande clôturée" : "Request closed" }); refresh(); },
              onError: (e) => { setConfirming(false); fail(e); },
            })} className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50">{fr ? "Confirmer" : "Confirm"}</button>
            <button onClick={() => setConfirming(false)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">{fr ? "Annuler" : "Cancel"}</button>
          </div>
        ) : (
          <button data-testid="button-close-ticket" onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"><CheckCircle2 className="h-3.5 w-3.5" />{fr ? "Clôturer" : "Close"}</button>
        ))}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 max-h-[60vh]">
        {messages.map((m) => {
          const admin = m.author === "admin";
          return (
            <div key={m.id} className={`flex flex-col ${admin ? "items-end" : "items-start"}`}>
              <span className="mb-1 text-[11px] text-muted-foreground">{admin ? (fr ? "Équipe" : "Team") : (ticket.requesterName ?? (fr ? "Utilisateur" : "User"))} · {fmt(m.createdAt)}</span>
              <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${admin ? "bg-primary/15 rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>{m.message}</div>
            </div>
          );
        })}
      </div>
      {open ? (
        <form className="border-t p-4 flex gap-2 items-end" onSubmit={(e) => {
          e.preventDefault();
          const msg = text.trim();
          if (!msg || reply.isPending || close.isPending) return;
          reply.mutate({ id, data: { message: msg } }, { onSuccess: () => { setText(""); refresh(); }, onError: fail });
        }}>
          <textarea data-testid="input-reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={3} disabled={reply.isPending || close.isPending}
            aria-label={fr ? "Votre réponse" : "Your reply"}
            placeholder={fr ? "Écrire une réponse…" : "Write a reply…"}
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button data-testid="button-send-reply" type="submit" disabled={!text.trim() || reply.isPending || close.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" />{reply.isPending ? "..." : (fr ? "Envoyer" : "Send")}
          </button>
        </form>
      ) : (
        <div className="border-t px-5 py-3 text-xs text-muted-foreground flex items-center gap-2"><Lock className="h-3.5 w-3.5" />{fr ? "Demande clôturée, réponses désactivées." : "Request closed, replies disabled."}</div>
      )}
    </div>
  );
}

const FIELDS: Array<{ k: keyof SupportLinks; label: string; ph: string }> = [
  { k: "whatsapp", label: "WhatsApp", ph: "+33612345678" },
  { k: "tiktok", label: "TikTok", ph: "https://www.tiktok.com/@zbarber" },
  { k: "instagram", label: "Instagram", ph: "https://www.instagram.com/zbarber" },
  { k: "facebook", label: "Facebook", ph: "https://www.facebook.com/zbarber" },
];
type Form = Record<keyof SupportLinks, string>;
const toForm = (d: SupportLinks): Form => ({ whatsapp: d.whatsapp ?? "", tiktok: d.tiktok ?? "", instagram: d.instagram ?? "", facebook: d.facebook ?? "" });

function LinksForm({ fr }: { fr: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useT();
  const q = useGetSupportLinks({ query: { queryKey: getGetSupportLinksQueryKey(), refetchOnWindowFocus: false } });
  const save = useSaveSupportLinks();
  const [form, setForm] = useState<Form | null>(null);
  const init = useRef(false);
  useEffect(() => { if (q.data && !init.current) { init.current = true; setForm(toForm(q.data)); } }, [q.data]);

  if (q.isLoading || (!form && !q.isError)) return <div className="rounded-xl border bg-card p-6 max-w-xl space-y-4">{FIELDS.map((f) => <div key={f.k} className="h-10 rounded-md bg-muted animate-pulse" />)}</div>;
  if (q.isError || !form) return (
    <div className="rounded-xl border bg-card p-6 max-w-xl text-sm space-y-3">
      <p className="text-muted-foreground">{fr ? "Impossible de charger les liens." : "Could not load links."}</p>
      <button onClick={() => q.refetch()} className="rounded-md border px-3 py-1.5 hover:bg-muted">{fr ? "Réessayer" : "Retry"}</button>
    </div>
  );

  const errs: Partial<Form> = {};
  if (form.whatsapp.trim() && !/^\+[1-9][0-9]{6,14}$/.test(form.whatsapp.trim())) errs.whatsapp = fr ? "Format international requis, ex. +33612345678" : "International format required, e.g. +33612345678";
  (["tiktok", "instagram", "facebook"] as const).forEach((k) => {
    const v = form[k].trim();
    if (v && (!/^https:\/\/\S+$/i.test(v) || v.length > 500)) errs[k] = fr ? "Adresse HTTPS complète requise" : "Full HTTPS address required";
  });
  const hasErr = Object.keys(errs).length > 0;

  return (
    <form className="rounded-xl border bg-card p-6 max-w-xl space-y-5" onSubmit={(e) => {
      e.preventDefault();
      if (hasErr || save.isPending) return;
      const body: SupportLinks = { whatsapp: form.whatsapp.trim() || null, tiktok: form.tiktok.trim() || null, instagram: form.instagram.trim() || null, facebook: form.facebook.trim() || null };
      save.mutate({ data: body }, {
        onSuccess: (saved) => { qc.setQueryData(getGetSupportLinksQueryKey(), saved); setForm(toForm(saved)); toast({ title: fr ? "Liens enregistrés" : "Links saved" }); },
        onError: (err) => toast({ title: apiText(err) ?? formatApiError(err, t.errors), variant: "destructive" as any }),
      });
    }}>
      <p className="text-sm text-muted-foreground">{fr ? "Laissez un champ vide pour masquer le lien dans l'application." : "Leave a field blank to hide it in the app."}</p>
      {FIELDS.map((f) => (
        <label key={f.k} className="block space-y-1.5">
          <span className="text-sm font-medium">{f.label}</span>
          <input data-testid={`input-${f.k}`} value={form[f.k]} placeholder={f.ph} inputMode={f.k === "whatsapp" ? "tel" : "url"} disabled={save.isPending} maxLength={f.k === "whatsapp" ? 16 : 500}
            onChange={(e) => setForm((s) => (s ? { ...s, [f.k]: e.target.value } : s))}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${errs[f.k] ? "border-destructive" : ""}`} />
          {errs[f.k] && <span className="text-xs text-destructive">{errs[f.k]}</span>}
        </label>
      ))}
      <button data-testid="button-save-links" type="submit" disabled={hasErr || save.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {save.isPending ? (fr ? "Enregistrement..." : "Saving...") : (fr ? "Enregistrer" : "Save")}
      </button>
    </form>
  );
}
