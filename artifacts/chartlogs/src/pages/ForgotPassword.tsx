import { useState } from "react";
import { useLocation } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const mutation = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { data: { email } },
      {
        onSuccess: () => setSent(true),
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Something went wrong. Please try again." });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold font-mono tracking-tighter text-primary">CHARTLOGS</h2>
          <p className="text-muted-foreground mt-2">
            {sent ? "Check your email" : "Reset your password"}
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              If an account exists for <span className="text-foreground font-medium">{email}</span>, 
              a password reset link has been sent. Check your inbox (and spam folder).
            </p>
            <p className="text-xs text-muted-foreground">The link expires in 1 hour.</p>
            <Button className="w-full mt-4" onClick={() => setLocation("/login")}>
              Back to login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="trader@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">
                We'll send a reset link to this address if it's registered.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <div className="text-center">
          <button
            onClick={() => setLocation("/login")}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
