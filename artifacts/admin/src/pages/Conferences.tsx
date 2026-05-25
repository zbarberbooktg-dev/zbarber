import { useState } from "react";
import { Plus, Pencil, Trash2, Globe, EyeOff } from "lucide-react";
import { useListConferences, useCreateConference, useUpdateConference, useDeleteConference, getListConferencesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";

const EMPTY = { title: "", topic: "", description: "", scheduledAt: "", participationChannel: "", joinLink: "", instructions: "", isPublished: false };

export default function Conferences() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListConferences({});
  const create = useCreateConference();
  const update = useUpdateConference();
  const del = useDeleteConference();

  const conferences = (data as any)?.data ?? [];

  function openCreate() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(c: any) {
    setForm({ title: c.title, topic: c.topic, description: c.description ?? "", scheduledAt: c.scheduledAt?.slice(0, 16) ?? "", participationChannel: c.participationChannel ?? "", joinLink: c.joinLink ?? "", instructions: c.instructions ?? "", isPublished: c.isPublished });
    setEditing(c);
    setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : "" };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListConferencesQueryKey() }); toast({ title: "Conférence mise à jour" }); setShowForm(false); } });
    } else {
      create.mutate({ data: payload }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListConferencesQueryKey() }); toast({ title: "Conférence créée" }); setShowForm(false); } });
    }
  }

  function handleDelete(id: number) {
    if (!confirm("Supprimer cette conférence ?")) return;
    del.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListConferencesQueryKey() }); toast({ title: "Conférence supprimée" }); } });
  }

  return (
    <div>
      <PageHeader
        title="Conférences"
        subtitle="Sessions de formation et événements"
        action={<button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="h-4 w-4" />Nouvelle conférence</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading && <p className="text-muted-foreground col-span-2 py-8 text-center">Chargement...</p>}
        {!isLoading && conferences.length === 0 && <p className="text-muted-foreground col-span-2 py-8 text-center">Aucune conférence</p>}
        {conferences.map((c: any) => (
          <div key={c.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={c.isPublished ? "published" : "draft"} />
                </div>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="text-xs text-primary mt-0.5">{c.topic}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {c.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{c.description}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{new Date(c.scheduledAt).toLocaleDateString("fr", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {c.participationChannel && <span>{c.participationChannel}</span>}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-5">{editing ? "Modifier la conférence" : "Nouvelle conférence"}</h2>
            <div className="space-y-4">
              {([
                ["title", "Titre", "text"],
                ["topic", "Thème / Topic", "text"],
                ["description", "Description", "textarea"],
                ["scheduledAt", "Date et heure", "datetime-local"],
                ["participationChannel", "Canal (Zoom, Meet...)", "text"],
                ["joinLink", "Lien de participation", "text"],
                ["instructions", "Instructions", "textarea"],
              ] as [string, string, string][]).map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  {type === "textarea" ? (
                    <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={3} />
                  ) : (
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full rounded-lg border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  )}
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="rounded" />
                Publier la conférence
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSubmit} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                {editing ? "Enregistrer" : "Créer"}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
