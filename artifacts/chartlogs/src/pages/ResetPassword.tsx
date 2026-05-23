import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const mutation = useResetPassword();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto" />
          <h2 className="text-xl font-bold">Invalid reset link</h2>
          <p className="text-muted-foreground text-sm">This reset link is missing or invalid. Please request a new one.</p>
          <Button onClick={() => setLocation("/forgot-password")}>Request new link</Button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ variant: "destructive", title: "Passwords don't match" });
      return;
    }
    mutation.mutate(
      { data: { token, password } },
      {
        onSuccess: () => setDone(true),
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Reset failed",
            description: err?.data?.error || "Invalid or expired link. Please request a new one.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold font-mono tracking-tighter text-primary">CHARTLOGS</h2>
          <p className="text-muted-foreground mt-2">{done ? "Password updated" : "Set new password"}</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
            <p className="text-muted-foreground text-sm">Your password has been reset. You can now log in with your new password.</p>
            <Button className="w-full" onClick={() => setLocation("/login")}>Go to login</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-background border-input"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="bg-background border-input"
                placeholder="Repeat password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Set new password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
