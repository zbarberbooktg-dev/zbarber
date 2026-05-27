import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useListConferences, useCreateConference, useUpdateConference, useDeleteConference, getListConferencesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";

const EMPTY = { title: "", topic: "", description: "", scheduledAt: "", participationChannel: "", joinLink: "", instructions: "", isPublished: false };

export default function Conferences() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, locale } = useT();
  const c = t.conferences;

  const { data, isLoading } = useListConferences({});
  const create = useCreateConference();
  const update = useUpdateConference();
  const del = useDeleteConference();

  const conferences = (data as any)?.data ?? [];
  const onErr = (err: unknown) => toast({ title: formatApiError(err, t.errors), variant: "destructive" as any });

  function openCreate() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(conf: any) {
    setForm({ title: conf.title, topic: conf.topic, description: conf.description ?? "", scheduledAt: conf.scheduledAt?.slice(0, 16) ?? "", participationChannel: conf.participationChannel ?? "", joinLink: conf.joinLink ?? "", instructions: conf.instructions ?? "", isPublished: conf.isPublished });
    setEditing(conf);
    setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "" };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListConferencesQueryKey() }); toast({ title: c.updated_toast }); setShowForm(false); }, onError: onErr });
    } else {
      create.mutate({ data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListConferencesQueryKey() }); toast({ title: c.created_toast }); setShowForm(false); }, onError: onErr });
    }
  }

  function handleDelete(id: number) {
    if (!confirm(c.confirmDelete)) return;
    del.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListConferencesQueryKey() }); toast({ title: c.deleted_toast }); }, onError: onErr });
  }

  const fields: [keyof typeof c.fields, string][] = [
    ["title", "text"],
    ["topic", "text"],
    ["description", "textarea"],
    ["scheduledAt", "datetime-local"],
    ["participationChannel", "text"],
    ["joinLink", "text"],
    ["instructions", "textarea"],
  ];

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        action={<button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="h-4 w-4" />{c.newOne}</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && <p className="text-muted-foreground col-span-2 py-8 text-center">{t.common.loading}</p>}
        {!isLoading && conferences.length === 0 && <p className="text-muted-foreground col-span-2 py-8 text-center">{c.empty}</p>}
        {conferences.map((conf: any) => (
          <div key={conf.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={conf.isPublished ? "published" : "draft"} />
                </div>
                <h3 className="font-semibold">{conf.title}</h3>
                <p className="text-xs text-primary mt-0.5">{conf.topic}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(conf)} className="p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(conf.id)} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {conf.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{conf.description}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{new Date(conf.scheduledAt).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {conf.participationChannel && <span>{conf.participationChannel}</span>}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-5">{editing ? c.editTitle : c.createTitle}</h2>
            <div className="space-y-4">
              {fields.map(([key, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{c.fields[key]}</label>
                  {type === "textarea" ? (
                    <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3} />
                  ) : (
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  )}
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="rounded" />
                {c.publish}
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSubmit} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                {editing ? t.common.save : t.common.create}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">{t.common.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
