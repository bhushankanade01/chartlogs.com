import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState("");
  const mutation = useVerifyEmail();
  const called = useRef(false);

  useEffect(() => {
    if (!token || called.current) return;
    called.current = true;
    mutation.mutate(
      { data: { token } },
      {
        onSuccess: () => setStatus("success"),
        onError: (err: any) => {
          setErrorMsg(err?.data?.error ?? "This verification link is invalid or has already been used.");
          setStatus("error");
        },
      }
    );
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto" />
          <h2 className="text-xl font-bold">Invalid link</h2>
          <p className="text-muted-foreground text-sm">
            This verification link is missing or malformed.
          </p>
          <Button onClick={() => setLocation("/login")}>Go to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-xl border border-border shadow-xl text-center space-y-6">
        <h2 className="text-3xl font-bold font-mono tracking-tighter text-primary">CHARTLOGS</h2>

        {status === "pending" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
            <p className="text-muted-foreground text-sm">Verifying your email…</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Email verified!</h3>
              <p className="text-muted-foreground text-sm">
                Your account is now fully verified. You can log in and start trading.
              </p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Go to login
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertTriangle className="h-16 w-16 text-yellow-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Verification failed</h3>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Go to login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
