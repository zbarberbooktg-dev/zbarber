import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { Sidebar } from "@/components/Sidebar";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function Router() {
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
