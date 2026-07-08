import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAccount } from "@/contexts/AccountContext";
import {
  useUpdateSettings,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  getListAccountsQueryKey,
  useListChecklistTemplates,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
  getListChecklistTemplatesQueryKey,
  useConnectBroker,
  useGetBrokerStatus,
  useDisconnectBroker,
  getGetBrokerStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Check, Plus, Pencil, Trash2, Wallet, X, Star, ListChecks, GripVertical,
  Link2, Link2Off, RefreshCw, AlertCircle, CheckCircle2, Clock, ShieldAlert,
} from "lucide-react";

function ChecklistsTab() {
  const { data: templates, isLoading } = useListChecklistTemplates();
  const createTemplate = useCreateChecklistTemplate();
  const updateTemplate = useUpdateChecklistTemplate();
  const deleteTemplate = useDeleteChecklistTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);

  const resetForm = () => { setName(""); setQuestions([""]); setEditingId(null); setShowForm(false); };

  const startEdit = (t: { id: number; name: string; questions: unknown }) => {
    setEditingId(t.id);
    setName(t.name);
    const qs = (t.questions as { text: string }[]).map(q => q.text);
    setQuestions(qs.length > 0 ? qs : [""]);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "Template name required" }); return; }
    const qs = questions.filter(q => q.trim()).map((text, i) => ({ id: String(i + 1), text }));
    const payload = { name: name.trim(), questions: qs };
    const invalidate = () => queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() });

    if (editingId !== null) {
      updateTemplate.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { invalidate(); resetForm(); toast({ title: "Checklist updated" }); },
        onError: (e: unknown) => toast({ variant: "destructive", title: "Failed", description: (e as Error).message }),
      });
    } else {
      createTemplate.mutate({ data: payload }, {
        onSuccess: () => { invalidate(); resetForm(); toast({ title: "Checklist created" }); },
        onError: (e: unknown) => toast({ variant: "destructive", title: "Failed", description: (e as Error).message }),
      });
    }
  };

  const handleDelete = (id: number, tName: string) => {
    if (!confirm(`Delete "${tName}"? This will also remove all checklist responses for this template.`)) return;
    deleteTemplate.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() }); toast({ title: "Checklist deleted" }); },
    });
  };

  const updateQuestion = (i: number, val: string) => setQuestions(prev => prev.map((q, idx) => idx === i ? val : q));
  const addQuestion = () => {
    if (questions.length >= 10) return;
    setQuestions(prev => [...prev, ""]);
  };
  const removeQuestion = (i: number) => setQuestions(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Create pre/post-trade checklists to enforce your trading rules.</p>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />New Checklist
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editingId !== null ? "Edit Checklist" : "New Checklist"}</CardTitle>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Checklist Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-Trade Checklist" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Questions</Label>
              {questions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder={`Question ${i + 1}…`}
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } }}
                  />
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(i)} className="text-muted-foreground hover:text-red-400">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={addQuestion} className="text-muted-foreground" disabled={questions.length >= 10}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add question
                </Button>
                {questions.length >= 10 && <span className="text-xs text-muted-foreground">Maximum 10 questions</span>}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending} size="sm">
                {createTemplate.isPending || updateTemplate.isPending ? "Saving..." : editingId !== null ? "Update" : "Create Checklist"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No checklists yet. Create one to start enforcing your trading rules.</p>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />Create your first checklist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const qs = t.questions as { id: string; text: string }[];
            return (
              <Card key={t.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <ListChecks className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{qs.length} question{qs.length !== 1 ? "s" : ""}</p>
                      {qs.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {qs.slice(0, 3).map((q) => (
                            <li key={q.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="mt-0.5 text-muted-foreground/50">•</span>
                              <span className="truncate">{q.text}</span>
                            </li>
                          ))}
                          {qs.length > 3 && <li className="text-xs text-muted-foreground/60">+{qs.length - 3} more…</li>}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => handleDelete(t.id, t.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BrokerSyncTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    accountNumber: "",
    serverName: "",
    investorPassword: "",
    brokerType: "mt5" as "mt4" | "mt5",
  });
  const [showPassword, setShowPassword] = useState(false);

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useGetBrokerStatus();
  const connection = statusData?.connection ?? null;

  useEffect(() => {
    if (connection?.status !== "pending") return;
    const id = setInterval(() => { refetchStatus(); }, 5000);
    return () => clearInterval(id);
  }, [connection?.status, refetchStatus]);

  const connectBroker = useConnectBroker();
  const disconnectBroker = useDisconnectBroker();

  const BROKER_COMING_SOON_MESSAGE = "Broker sync coming soon! Use CSV import for now.";

  const handleConnect = () => {
    toast({ title: "Coming Soon", description: BROKER_COMING_SOON_MESSAGE });
    return;
  };

  const handleDisconnect = () => {
    if (!confirm("Disconnect your broker? Your synced trades will remain, but no new trades will be imported.")) return;
    disconnectBroker.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBrokerStatusQueryKey() });
        toast({ title: "Broker disconnected" });
      },
      onError: (e: unknown) => {
        toast({ variant: "destructive", title: "Failed to disconnect", description: (e as Error).message });
      },
    });
  };

  const handleSyncNow = () => {
    toast({ title: "Coming Soon", description: BROKER_COMING_SOON_MESSAGE });
    return;
  };

  const metaapiState = (connection as (typeof connection & { metaapiState?: string | null }) | null)?.metaapiState;
  const isDeploying = metaapiState === "DEPLOYING" || metaapiState === "CREATED";

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: {
      icon: <RefreshCw className="h-4 w-4 animate-spin" />,
      label: isDeploying ? "Setting up…" : "Connecting…",
      color: "text-yellow-400",
    },
    connected: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Connected",
      color: "text-emerald-400",
    },
    error: {
      icon: <AlertCircle className="h-4 w-4" />,
      label: "Connection Error",
      color: "text-red-400",
    },
    disconnecting: {
      icon: <Clock className="h-4 w-4" />,
      label: "Disconnecting…",
      color: "text-muted-foreground",
    },
  };

  return (
    <div className="space-y-5">
      {/* Coming soon banner */}
      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardContent className="py-3 flex items-start gap-3">
          <Clock className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-semibold text-amber-300">Broker sync coming soon!</span>{" "}
            Live MT4/MT5 syncing is still in development. Use CSV import to bring in your trade history for now.
          </p>
        </CardContent>
      </Card>

      {/* Security notice */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="py-3 flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-200/80 leading-relaxed">
            <span className="font-semibold text-yellow-300">Investor password only.</span>{" "}
            Use your <span className="font-medium">read-only investor password</span> — not your master trading password. Your password is sent directly to MetaApi to register your account and is <span className="font-medium">never stored</span> in our database.
          </p>
        </CardContent>
      </Card>

      {statusLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : connection ? (
        /* Active connection card */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Connected Broker
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                onClick={handleDisconnect}
                disabled={disconnectBroker.isPending}
              >
                <Link2Off className="h-3.5 w-3.5 mr-1.5" />
                {disconnectBroker.isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Account Number</p>
                <p className="font-mono font-medium">{connection.accountNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Platform</p>
                <p className="font-medium uppercase">{connection.brokerType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Server</p>
                <p className="font-medium">{connection.serverName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Last Sync</p>
                <p className="text-sm">
                  {connection.lastSyncAt
                    ? new Date(connection.lastSyncAt).toLocaleString()
                    : "Not yet synced"}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-2 pt-1 ${statusConfig[connection.status]?.color ?? "text-muted-foreground"}`}>
              {statusConfig[connection.status]?.icon}
              <span className="text-sm font-medium">{statusConfig[connection.status]?.label ?? connection.status}</span>
            </div>

            {connection.errorMessage && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
                {connection.errorMessage}
              </p>
            )}

            {connection.status === "pending" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {isDeploying
                    ? "MetaApi is provisioning a cloud instance for your broker. This takes 2–5 minutes."
                    : "MetaApi is establishing a connection to your broker. This can take 5–15 minutes for the first connection."}
                </p>
                <p className="text-xs text-muted-foreground">
                  You can close this page — trades will sync automatically once connected.
                </p>
              </div>
            )}

            {connection.status === "connected" && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Trades sync automatically every 3 minutes.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2 opacity-60"
                  onClick={handleSyncNow}
                  title="Coming Soon"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />Sync Now
                  <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-400 border-amber-500/30">
                    Soon
                  </Badge>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Connect form (greyed out — coming soon) */
        <Card className="opacity-60 pointer-events-none select-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Connect Your Broker
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                Coming Soon
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Platform</Label>
              <Select
                value={form.brokerType}
                onValueChange={(v) => setForm((f) => ({ ...f, brokerType: v as "mt4" | "mt5" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mt5">MetaTrader 5</SelectItem>
                  <SelectItem value="mt4">MetaTrader 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Account Number</Label>
              <Input
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                placeholder="e.g. 50194988"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Server Name</Label>
              <Input
                value={form.serverName}
                onChange={(e) => setForm((f) => ({ ...f, serverName: e.target.value }))}
                placeholder="e.g. ICMarkets-Live01"
              />
              <p className="text-[11px] text-muted-foreground/70">
                Find this in your MT4/MT5 terminal under File → Open an Account
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Investor (Read-Only) Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.investorPassword}
                  onChange={(e) => setForm((f) => ({ ...f, investorPassword: e.target.value }))}
                  placeholder="Investor password"
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                This is the investor/read-only password, not your master password. It is forwarded to MetaApi and never stored.
              </p>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connectBroker.isPending}
              className="w-full"
            >
              {connectBroker.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Connecting…</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" />Connect Broker</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
  "Asia/Hong_Kong", "Australia/Sydney",
];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF"];
const PLATFORMS = [
  { value: "manual", label: "Manual" },
  { value: "mt4", label: "MetaTrader 4" },
  { value: "mt5", label: "MetaTrader 5" },
];

type AccountForm = {
  name: string;
  broker: string;
  platform: "manual" | "mt4" | "mt5";
  startingBalance: string;
  currency: string;
  isDefault: boolean;
};

const emptyAccountForm = (): AccountForm => ({
  name: "",
  broker: "",
  platform: "manual",
  startingBalance: "10000",
  currency: "USD",
  isDefault: false,
});

type TabId = "general" | "accounts" | "checklists" | "broker";

export default function Settings() {
  const { user } = useAuth();
  const { accounts, isLoading: accountsLoading, refetchAccounts } = useAccount();
  const queryClient = useQueryClient();
  const updateSettings = useUpdateSettings();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const { toast } = useToast();
  const [location] = useLocation();
  const [saved, setSaved] = useState(false);

  const defaultTab: TabId = location.includes("tab=checklists") ? "checklists" : location.includes("tab=accounts") ? "accounts" : "general";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  // General settings
  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [currency, setCurrency] = useState(user?.currency ?? "USD");
  const [defaultLotSize, setDefaultLotSize] = useState(
    user?.defaultLotSize != null ? String(user.defaultLotSize) : ""
  );

  // Account form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm());

  useEffect(() => {
    if (location.includes("tab=checklists")) setActiveTab("checklists");
    else if (location.includes("tab=accounts")) setActiveTab("accounts");
  }, [location]);

  const handleSave = () => {
    updateSettings.mutate(
      { data: { name: name || undefined, timezone, currency, defaultLotSize: defaultLotSize ? parseFloat(defaultLotSize) : undefined } },
      {
        onSuccess: (updatedUser) => {
          queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  const handleCreateAccount = () => {
    if (!accountForm.name.trim()) { toast({ variant: "destructive", title: "Account name is required" }); return; }
    createAccount.mutate(
      {
        data: {
          name: accountForm.name,
          broker: accountForm.broker || null,
          platform: accountForm.platform,
          startingBalance: parseFloat(accountForm.startingBalance) || 0,
          currency: accountForm.currency,
          isDefault: accountForm.isDefault,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          refetchAccounts();
          setShowAddForm(false);
          setAccountForm(emptyAccountForm());
          toast({ title: "Account created" });
        },
        onError: (e: any) => toast({ variant: "destructive", title: "Failed to create account", description: e.message }),
      }
    );
  };

  const handleUpdateAccount = (id: number) => {
    updateAccount.mutate(
      {
        id,
        data: {
          name: accountForm.name,
          broker: accountForm.broker || null,
          platform: accountForm.platform,
          startingBalance: parseFloat(accountForm.startingBalance) || 0,
          currency: accountForm.currency,
          isDefault: accountForm.isDefault,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          refetchAccounts();
          setEditingId(null);
          setAccountForm(emptyAccountForm());
          toast({ title: "Account updated" });
        },
        onError: (e: any) => toast({ variant: "destructive", title: "Failed to update account", description: e.message }),
      }
    );
  };

  const handleDeleteAccount = (id: number, accName: string) => {
    if (!confirm(`Delete "${accName}"? Trades linked to this account will remain but lose their account association.`)) return;
    deleteAccount.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          refetchAccounts();
          toast({ title: "Account deleted" });
        },
        onError: (e: any) => toast({ variant: "destructive", title: "Failed to delete account", description: e.message }),
      }
    );
  };

  const startEdit = (acc: typeof accounts[0]) => {
    setEditingId(acc.id);
    setAccountForm({
      name: acc.name,
      broker: acc.broker ?? "",
      platform: acc.platform,
      startingBalance: String(acc.startingBalance),
      currency: acc.currency,
      isDefault: acc.isDefault,
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => { setEditingId(null); setShowAddForm(false); setAccountForm(emptyAccountForm()); };

  const AccountFormFields = () => (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Account Name *</Label>
        <Input value={accountForm.name} onChange={(e) => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Prop Firm Account" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Broker</Label>
        <Input value={accountForm.broker} onChange={(e) => setAccountForm(f => ({ ...f, broker: e.target.value }))} placeholder="e.g. FTMO" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Platform</Label>
        <Select value={accountForm.platform} onValueChange={(v) => setAccountForm(f => ({ ...f, platform: v as "manual" | "mt4" | "mt5" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Starting Balance</Label>
        <Input type="number" value={accountForm.startingBalance} onChange={(e) => setAccountForm(f => ({ ...f, startingBalance: e.target.value }))} placeholder="10000" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Currency</Label>
        <Select value={accountForm.currency} onValueChange={(v) => setAccountForm(f => ({ ...f, currency: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={accountForm.isDefault}
          onChange={(e) => setAccountForm(f => ({ ...f, isDefault: e.target.checked }))}
          className="rounded"
        />
        <Label htmlFor="isDefault" className="text-sm cursor-pointer">Set as default account</Label>
      </div>
    </div>
  );

  const tabs: { id: TabId; label: string; comingSoon?: boolean }[] = [
    { id: "general", label: "General" },
    { id: "accounts", label: "Trading Accounts" },
    { id: "checklists", label: "Checklists" },
    { id: "broker", label: "Broker Sync", comingSoon: true },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.comingSoon && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                Coming Soon
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* GENERAL TAB */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={user?.email ?? ""} disabled className="text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Display Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Plan:</span>
                <Badge variant="secondary" className="capitalize">{user?.plan ?? "free"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Trading Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Base Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Default Lot Size</Label>
                <Input type="number" value={defaultLotSize} onChange={(e) => setDefaultLotSize(e.target.value)} placeholder="0.10" step="0.01" min="0.01" />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
            {saved ? <><Check className="h-4 w-4 mr-2" />Saved</> : updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}

      {/* CHECKLISTS TAB */}
      {activeTab === "checklists" && <ChecklistsTab />}

      {/* BROKER SYNC TAB */}
      {activeTab === "broker" && <BrokerSyncTab />}

      {/* ACCOUNTS TAB */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Manage your trading accounts. Switch between them from the sidebar.</p>
            {!showAddForm && editingId === null && (
              <Button size="sm" onClick={() => { setShowAddForm(true); setEditingId(null); setAccountForm(emptyAccountForm()); }}>
                <Plus className="h-4 w-4 mr-2" />Add Account
              </Button>
            )}
          </div>

          {/* Add form */}
          {showAddForm && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">New Account</CardTitle>
                  <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <AccountFormFields />
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleCreateAccount} disabled={createAccount.isPending} size="sm">
                    {createAccount.isPending ? "Creating..." : "Create Account"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account list */}
          {accountsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : accounts.length === 0 && !showAddForm ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No trading accounts yet. Add one to start tracking performance per account.</p>
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />Add your first account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <Card key={acc.id} className={editingId === acc.id ? "border-primary/40" : ""}>
                  {editingId === acc.id ? (
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Edit Account</span>
                        <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                      <AccountFormFields />
                      <div className="flex gap-2 pt-1">
                        <Button onClick={() => handleUpdateAccount(acc.id)} disabled={updateAccount.isPending} size="sm">
                          {updateAccount.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                      </div>
                    </CardContent>
                  ) : (
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{acc.name}</span>
                            {acc.isDefault && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-400 border-yellow-400/30">
                                <Star className="h-2.5 w-2.5 mr-0.5" />default
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {PLATFORMS.find(p => p.value === acc.platform)?.label}
                              {acc.broker ? ` · ${acc.broker}` : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Balance: {acc.currency} {Number(acc.startingBalance).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={`text-xs font-mono ${(acc.totalPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              P&L: {(acc.totalPnl ?? 0) >= 0 ? "+" : ""}{Number(acc.totalPnl ?? 0).toFixed(2)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {acc.tradeCount ?? 0} trades
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEdit(acc)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => handleDeleteAccount(acc.id, acc.name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
