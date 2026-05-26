import { useT } from "@/lib/i18n";

const classMap: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  suspended:  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  active:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  confirmed:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled:  "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired:    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  reviewing:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  draft:      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  published:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  client:     "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  barber:     "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  admin:      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const cls = classMap[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const label = t.statuses[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
