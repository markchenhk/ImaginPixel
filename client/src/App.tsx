import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Landing } from "@/pages/landing";
import { AuthPage } from "@/pages/auth-page";
import ImageEditor from "@/pages/image-editor";
import Gallery from "@/pages/gallery";
import Account from "@/pages/account";
import NotFound from "@/pages/not-found";
import { Sidebar } from "@/components/sidebar";

function ProtectedRoute({ path, component: Component }: { path: string; component: () => JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <Component />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex">
      <Sidebar currentPath={location} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Switch>
        <Route path="/">
          {isAuthenticated ? (
            <AppLayout>
              <ImageEditor />
            </AppLayout>
          ) : (
            <Landing />
          )}
        </Route>
        <Route path="/auth" component={AuthPage} />
        <Route path="/gallery">
          <ProtectedRoute path="/gallery" component={() => (
            <AppLayout>
              <Gallery />
            </AppLayout>
          )} />
        </Route>
        <Route path="/account">
          <ProtectedRoute path="/account" component={() => (
            <AppLayout>
              <Account />
            </AppLayout>
          )} />
        </Route>
        <Route path="/usage">
          <ProtectedRoute path="/usage" component={() => (
            <AppLayout>
              <Account />
            </AppLayout>
          )} />
        </Route>
        <Route path="/security">
          <ProtectedRoute path="/security" component={() => (
            <AppLayout>
              <Account />
            </AppLayout>
          )} />
        </Route>
        <Route path="/billing">
          <ProtectedRoute path="/billing" component={() => (
            <AppLayout>
              <Account />
            </AppLayout>
          )} />
        </Route>
        <Route path="/editor">
          <ProtectedRoute path="/editor" component={() => (
            <AppLayout>
              <ImageEditor />
            </AppLayout>
          )} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
