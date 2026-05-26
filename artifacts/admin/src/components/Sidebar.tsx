import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Scissors, Calendar, CreditCard,
  Banknote, Video, Bell, Star, Moon, Sun, LogOut, ChevronRight,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { useTheme } from "@/lib/theme";
import { useT, LanguageToggle } from "@/lib/i18n";

export function Sidebar() {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const { t } = useT();
  const { signOut } = useClerk();
  const { user } = useUser();

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/admin/sign-in" });
  };

  const nav = [
    { path: "/",              label: t.nav.dashboard,     icon: LayoutDashboard },
    { path: "/barbers",       label: t.nav.barbers,       icon: Scissors },
    { path: "/users",         label: t.nav.users,         icon: Users },
    { path: "/reservations",  label: t.nav.reservations,  icon: Calendar },
    { path: "/subscriptions", label: t.nav.subscriptions, icon: CreditCard },
    { path: "/financing",     label: t.nav.financing,     icon: Banknote },
    { path: "/conferences",   label: t.nav.conferences,   icon: Video },
    { path: "/notifications", label: t.nav.notifications, icon: Bell },
    { path: "/reviews",       label: t.nav.reviews,       icon: Star },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col" style={{ backgroundColor: "hsl(var(--sidebar-bg))", borderRight: "1px solid hsl(var(--sidebar-border))" }}>
      <div className="flex h-16 items-center gap-3 px-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "hsl(var(--sidebar-accent))" }}>
          <Scissors className="h-4 w-4 text-black" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">{t.brand.name}</p>
          <p className="text-xs" style={{ color: "hsl(var(--sidebar-fg))" }}>{t.brand.role}</p>
        </div>
        <LanguageToggle />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map(({ path, label, icon: Icon }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
                active ? "font-medium text-white bg-white/10" : "hover:bg-white/5"
              }`}
              style={{ color: active ? "hsl(var(--sidebar-accent))" : "hsl(var(--sidebar-fg))" }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-70" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4 space-y-1" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 hover:bg-white/5"
          style={{ color: "hsl(var(--sidebar-fg))" }}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === "dark" ? t.common.lightMode : t.common.darkMode}</span>
        </button>
        {user && (
          <div className="px-3 py-2 text-xs truncate" style={{ color: "hsl(var(--sidebar-fg))" }}>
            {user.primaryEmailAddress?.emailAddress ?? user.username ?? ""}
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 hover:bg-white/5"
          style={{ color: "hsl(var(--sidebar-fg))" }}
        >
          <LogOut className="h-4 w-4" />
          <span>{t.common.logout}</span>
        </button>
      </div>
    </aside>
  );
}
