import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect, Link } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider, useT } from "@/lib/i18n";
import { formatApiError } from "@/lib/errors";
import { Sidebar } from "@/components/Sidebar";
import { fetchAuthMe, syncAuth, AuthApiError, type AuthMeResponse } from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import Dashboard from "@/pages/Dashboard";
import Barbers from "@/pages/Barbers";
import BarberDetail from "@/pages/BarberDetail";
import Users from "@/pages/Users";
import Reservations from "@/pages/Reservations";
import Subscriptions from "@/pages/Subscriptions";
import Financing from "@/pages/Financing";
import Conferences from "@/pages/Conferences";
import Notifications from "@/pages/Notifications";
import Reviews from "@/pages/Reviews";
import Gallery from "@/pages/Gallery";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(43, 96%, 46%)",
    colorForeground: "hsl(220, 25%, 8%)",
    colorMutedForeground: "hsl(220, 10%, 50%)",
    colorDanger: "hsl(0, 72%, 51%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(220, 15%, 96%)",
    colorInputForeground: "hsl(220, 25%, 8%)",
    colorNeutral: "hsl(220, 15%, 88%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: { backgroundColor: "#ffffff", borderRadius: "1rem", width: "440px", maxWidth: "100%", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.12)", border: "1px solid #e5e7eb" },
    card: { boxShadow: "none", border: 0, backgroundColor: "transparent", borderRadius: 0 },
    footer: { boxShadow: "none", border: 0, backgroundColor: "transparent", borderRadius: 0 },
    headerTitle: { color: "#0A0F1A", fontSize: "1.5rem", fontWeight: 700 },
    headerSubtitle: { color: "#4b5563" },
    socialButtonsBlockButtonText: { color: "#0A0F1A", fontWeight: 500 },
    formFieldLabel: { color: "#0A0F1A", fontWeight: 500 },
    formFieldInput: { color: "#0A0F1A", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" },
    footerActionLink: { color: "#C99214", fontWeight: 600 },
    footerActionText: { color: "#4b5563" },
    dividerText: { color: "#6b7280" },
    identityPreviewEditButton: { color: "#C99214" },
    logoBox: { marginBottom: "0.5rem" },
    logoImage: { height: "3rem", width: "auto" },
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function AccessDenied({ user }: { user: AuthMeResponse["user"] }) {
  const { signOut } = useClerk();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground">Accès refusé</h1>
        <p className="text-muted-foreground">
          Le compte <strong>{user.email}</strong> n'a pas les droits administrateur (rôle&nbsp;: {user.role}). Connectez-vous avec un compte admin pour accéder à cette console.
        </p>
        <Button onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })} variant="default">
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AuthError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useT();
  const { signOut } = useClerk();
  const msg = formatApiError(error, t.errors);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-lg">
        <h1 className="text-2xl font-bold text-foreground">{t.errors.generic}</h1>
        <p className="text-muted-foreground">{msg}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={onRetry} variant="default">{t.common.save === "Enregistrer" ? "Réessayer" : "Retry"}</Button>
          <Button onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })} variant="outline">
            {t.common.logout}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const synced = await syncAuth();
        if (!cancel) { setMe(synced); setLoading(false); }
      } catch (err) {
        if (cancel) return;
        if (err instanceof AuthApiError && (err.status === 401 || err.status === 403)) {
          signOut({ redirectUrl: `${basePath}/sign-in` }).catch(() => {
            window.location.href = `${basePath}/sign-in`;
          });
          return;
        }
        setError(err);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [isLoaded, isSignedIn, attempt, signOut]);

  if (!isLoaded || loading) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (error) return <AuthError error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!me) return <AuthError error={new Error("No profile")} onRetry={() => setAttempt((n) => n + 1)} />;
  if (me.user.role !== "admin") return <AccessDenied user={me.user} />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

function ProtectedRouter() {
  return (
    <AdminGate>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/barbers" component={Barbers} />
          <Route path="/barbers/:id">{(params) => <BarberDetail params={params} />}</Route>
          <Route path="/users" component={Users} />
          <Route path="/reservations" component={Reservations} />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/financing" component={Financing} />
          <Route path="/conferences" component={Conferences} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/reviews" component={Reviews} />
          <Route path="/gallery" component={Gallery} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AdminGate>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevRef.current !== undefined && prevRef.current !== uid) qc.clear();
      prevRef.current = uid;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route>
            <Show when="signed-in">
              <ProtectedRouter />
            </Show>
            <Show when="signed-out">
              <Redirect to="/sign-in" />
            </Show>
          </Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <ClerkProviderWithRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

// silence unused import (Link reserved for sidebar usage already covered)
void Link;

export default App;
