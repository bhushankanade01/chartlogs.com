import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="text-xl font-bold text-primary font-mono tracking-tighter">
          CHARTLOGS
        </div>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/login")}>
            Log In
          </Button>
          <Button onClick={() => setLocation("/register")}>Sign Up</Button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground max-w-3xl">
          Your Trading Edge Starts Here
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl">
          A professional trading journal built for serious forex and stock
          traders. Track, analyze, and optimize your performance with precision.
        </p>
        <div className="flex items-center gap-4">
          <Button size="lg" className="text-lg px-8" onClick={() => setLocation("/register")}>
            Start for Free
          </Button>
        </div>
        
        <div className="mt-20 w-full max-w-5xl rounded-xl border border-border bg-card p-2 shadow-2xl overflow-hidden flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground font-mono text-sm opacity-50">
            System Interface Placeholder
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border">
        &copy; {new Date().getFullYear()} ChartLogs. All rights reserved.
      </footer>
    </div>
  );
}
