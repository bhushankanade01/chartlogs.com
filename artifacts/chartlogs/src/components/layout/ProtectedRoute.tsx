import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReactNode, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

export function ProtectedRoute({ component: Component }: { component: () => ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}
