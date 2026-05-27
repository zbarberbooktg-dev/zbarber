import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";
import { Sidebar } from "@/components/Sidebar";
import SignIn from "@/pages/SignIn";
import ChangePassword from "@/pages/ChangePassword";
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
import Articles from "@/pages/Articles";
import Admins from "@/pages/Admins";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
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

function AppRoutes() {
  const { admin, loading } = useAdminAuth();
  if (loading) return <AuthLoading />;
  if (!admin) {
    return (
      <Switch>
        <Route path="/sign-in" component={SignIn} />
        <Route><Redirect to="/sign-in" /></Route>
      </Switch>
    );
  }
  if (admin.mustChangePassword) return <ChangePassword forced />;
  return (
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
        <Route path="/articles" component={Articles} />
        <Route path="/admins" component={Admins} />
        <Route path="/sign-in"><Redirect to="/" /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <WouterRouter base={basePath}>
              <AdminAuthProvider>
                <AppRoutes />
              </AdminAuthProvider>
            </WouterRouter>
          </QueryClientProvider>
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
