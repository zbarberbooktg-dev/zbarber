import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: string;
}

export function StatCard({ title, value, icon: Icon, trend, color = "hsl(var(--primary))" }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 flex items-start gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${color}20` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {trend && <p className="text-xs text-muted-foreground mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}
