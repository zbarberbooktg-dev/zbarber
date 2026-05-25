import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { useListReviews, useDeleteReview, getListReviewsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

export default function Reviews() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListReviews({ page: String(page), limit: "20" });
  const del = useDeleteReview();

  const reviews = (data as any)?.data ?? [];
  const total = (data as any)?.total ?? 0;

  function handleDelete(id: number) {
    if (!confirm("Supprimer cet avis ?")) return;
    del.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListReviewsQueryKey() }); toast({ title: "Avis supprimé" }); } });
  }

  return (
    <div>
      <PageHeader title="Avis clients" subtitle={`${total} avis sur la plateforme`} />

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Barbier #</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Note</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Commentaire</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</td></tr>}
            {!isLoading && reviews.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucun avis</td></tr>}
            {reviews.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{r.clientName ?? `Client #${r.clientId}`}</td>
                <td className="px-4 py-3 text-muted-foreground">#{r.barberId}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">({r.rating}/5)</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs">
                  <p className="line-clamp-2">{r.comment ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("fr")}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex justify-end gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Précédent</button>
          <span className="rounded-lg border px-3 py-1.5 text-sm">{page}</span>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  );
}
