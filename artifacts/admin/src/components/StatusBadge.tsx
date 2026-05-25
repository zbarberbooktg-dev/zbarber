const configs: Record<string, { label: string; cls: string }> = {
  pending:    { label: "En attente",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved:   { label: "Approuvé",   cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected:   { label: "Rejeté",     cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  suspended:  { label: "Suspendu",   cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  active:     { label: "Actif",      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  confirmed:  { label: "Confirmé",   cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed:  { label: "Terminé",    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  cancelled:  { label: "Annulé",     cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  expired:    { label: "Expiré",     cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  reviewing:  { label: "En révision",cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  draft:      { label: "Brouillon",  cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  published:  { label: "Publié",     cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  client:     { label: "Client",     cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  barber:     { label: "Barbier",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  admin:      { label: "Admin",      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = configs[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
