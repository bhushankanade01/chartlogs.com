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
  Check, Plus, Pencil, Trash2, Wallet, X, Star,
} from "lucide-react";

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

type TabId = "general" | "accounts";

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

  const defaultTab: TabId = location.includes("tab=accounts") ? "accounts" : "general";
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
    if (location.includes("tab=accounts")) setActiveTab("accounts");
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

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: "General" },
    { id: "accounts", label: "Trading Accounts" },
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
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
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
