import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Users, BarChart3, Activity, Search, Trash2, Ban, CheckCircle, Shield,
  TrendingUp, UserCheck, UserX, Crown, RefreshCw, LogIn, LogOut, AlertTriangle
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const BASE = "/api";

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("chartlogs_token");
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  });
}

type AdminUser = {
  id: number; email: string; name: string; plan: string; role: string;
  isActive: boolean; emailVerified: boolean; lastLogin: string | null;
  subscriptionExpiresAt: string | null; stripeCustomerId: string | null; createdAt: string;
};

type AdminStats = {
  totalUsers: number; activeUsers: number; inactiveUsers: number;
  freeUsers: number; proUsers: number; eliteUsers: number;
  newUsersToday: number; newUsersThisMonth: number;
  dau: number; wau: number; mau: number; totalTrades: number;
  newUsersByDay: Array<{ date: string; count: number }>;
};

type LoginEntry = {
  id: number; userId: number | null; email: string; success: boolean;
  ipAddress: string | null; failReason: string | null; createdAt: string;
};

const PLAN_COLORS: Record<string, string> = {
  free: "text-muted-foreground border-muted",
  pro: "text-blue-400 border-blue-400/30",
  elite: "text-yellow-400 border-yellow-400/30",
};

type Tab = "users" | "analytics" | "activity";

export default function Admin() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("users");

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);

  // Analytics state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Activity state
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") setLocation("/dashboard");
    if (!isLoading && !user) setLocation("/login");
  }, [user, isLoading, setLocation]);

  const loadUsers = useCallback(async (q = "") => {
    setUsersLoading(true);
    try {
      const data = await apiFetch(`/admin/users?search=${encodeURIComponent(q)}&limit=100`);
      setUsers(data.users);
      setTotalUsers(data.total);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error loading users", description: e.message });
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await apiFetch("/admin/stats");
      setStats(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error loading stats", description: e.message });
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await apiFetch("/admin/login-history?limit=100");
      setLoginHistory(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error loading activity", description: e.message });
    } finally {
      setActivityLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    if (tab === "users") loadUsers(search);
    if (tab === "analytics") loadStats();
    if (tab === "activity") loadActivity();
  }, [tab, user]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const timer = setTimeout(() => loadUsers(search), 400);
    return () => clearTimeout(timer);
  }, [search, user]);

  const updateUser = async (id: number, updates: Partial<Pick<AdminUser, "isActive" | "plan" | "role">>) => {
    try {
      const updated = await apiFetch(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      toast({ title: "User updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    }
  };

  const deleteUser = async (id: number, email: string) => {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setTotalUsers((n) => n - 1);
      toast({ title: "User deleted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner />
    </div>
  );

  if (!user || user.role !== "admin") return null;

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card flex items-center px-6 gap-4">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-bold font-mono tracking-tighter text-primary text-lg">CHARTLOGS ADMIN</span>
        <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">Admin Panel</Badge>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard")}>
            Back to App
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-52 border-r border-border bg-card min-h-[calc(100vh-4rem)] p-3 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 overflow-auto">

          {/* USERS TAB */}
          {tab === "users" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">User Management</h1>
                  <p className="text-muted-foreground text-sm mt-0.5">{totalUsers} total users</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadUsers(search)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="rounded-lg border border-border overflow-hidden bg-card">
                {usersLoading ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No users found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground bg-muted/10 text-xs uppercase tracking-wide">
                          <th className="py-3 px-4 text-left">User</th>
                          <th className="py-3 px-4 text-left">Registered</th>
                          <th className="py-3 px-4 text-left">Last Login</th>
                          <th className="py-3 px-4 text-left">Plan</th>
                          <th className="py-3 px-4 text-left">Status</th>
                          <th className="py-3 px-4 text-left">Role</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                            <td className="py-3 px-4">
                              <div className="font-medium">{u.name}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                              {!u.emailVerified && (
                                <div className="text-xs text-yellow-400 mt-0.5">Email not verified</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : <span className="text-muted-foreground/40">Never</span>}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={u.plan}
                                onChange={(e) => updateUser(u.id, { plan: e.target.value as AdminUser["plan"] })}
                                className={`text-xs bg-transparent border rounded px-1.5 py-0.5 ${PLAN_COLORS[u.plan]} focus:outline-none cursor-pointer`}
                                disabled={u.id === user.id}
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="elite">Elite</option>
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              {u.isActive ? (
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-xs">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-400 border-red-400/30 text-xs">Disabled</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {u.role === "admin" ? (
                                <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">Admin</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs">User</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1 justify-end">
                                {u.id !== user.id && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-7 px-2 ${u.isActive ? "text-yellow-400 hover:text-yellow-300" : "text-emerald-400 hover:text-emerald-300"}`}
                                      onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                                      title={u.isActive ? "Disable user" : "Enable user"}
                                    >
                                      {u.isActive ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-red-400 hover:text-red-300"
                                      onClick={() => deleteUser(u.id, u.email)}
                                      title="Delete user"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                                {u.id === user.id && (
                                  <span className="text-xs text-muted-foreground px-2">You</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {tab === "analytics" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Platform Analytics</h1>
                <Button variant="outline" size="sm" onClick={loadStats}>
                  <RefreshCw className="h-4 w-4 mr-2" />Refresh
                </Button>
              </div>
              {statsLoading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : stats ? (
                <>
                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
                      { label: "Daily Active", value: stats.dau, icon: UserCheck, color: "text-emerald-400" },
                      { label: "Monthly Active", value: stats.mau, icon: TrendingUp, color: "text-purple-400" },
                      { label: "New This Month", value: stats.newUsersThisMonth, icon: Users, color: "text-yellow-400" },
                      { label: "Active Accounts", value: stats.activeUsers, icon: CheckCircle, color: "text-emerald-400" },
                      { label: "Disabled Accounts", value: stats.inactiveUsers, icon: UserX, color: "text-red-400" },
                      { label: "Total Trades", value: stats.totalTrades, icon: BarChart3, color: "text-blue-400" },
                      { label: "New Today", value: stats.newUsersToday, icon: TrendingUp, color: "text-yellow-400" },
                    ].map((kpi) => (
                      <Card key={kpi.label} className="bg-card border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                          </div>
                          <div className="text-2xl font-bold font-mono">{kpi.value.toLocaleString()}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Plan Distribution */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Plan Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-6">
                        {[
                          { label: "Free", count: stats.freeUsers, total: stats.totalUsers, color: "bg-muted" },
                          { label: "Pro", count: stats.proUsers, total: stats.totalUsers, color: "bg-blue-500" },
                          { label: "Elite", count: stats.eliteUsers, total: stats.totalUsers, color: "bg-yellow-500" },
                        ].map((plan) => (
                          <div key={plan.label} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{plan.label}</span>
                              <span className="font-mono">{plan.count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${plan.color} rounded-full transition-all`}
                                style={{ width: plan.total > 0 ? `${(plan.count / plan.total) * 100}%` : "0%" }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {plan.total > 0 ? Math.round((plan.count / plan.total) * 100) : 0}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* New Users Chart */}
                  {stats.newUsersByDay.length > 0 && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">New Users — Last 30 Days</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.newUsersByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ background: "#1e2130", border: "1px solid #374151", borderRadius: 6, fontSize: 12 }}
                                formatter={(v: number) => [v, "New Users"]}
                              />
                              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#usersGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <div className="text-center py-16 text-muted-foreground">No data available</div>
              )}
            </div>
          )}

          {/* ACTIVITY TAB */}
          {tab === "activity" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Login Activity</h1>
                  <p className="text-muted-foreground text-sm mt-0.5">Last 100 login attempts</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadActivity}>
                  <RefreshCw className="h-4 w-4 mr-2" />Refresh
                </Button>
              </div>

              <div className="rounded-lg border border-border overflow-hidden bg-card">
                {activityLoading ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : loginHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No login activity yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground bg-muted/10 text-xs uppercase tracking-wide">
                          <th className="py-3 px-4 text-left">Status</th>
                          <th className="py-3 px-4 text-left">Email</th>
                          <th className="py-3 px-4 text-left">Time</th>
                          <th className="py-3 px-4 text-left">IP Address</th>
                          <th className="py-3 px-4 text-left">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginHistory.map((h) => (
                          <tr key={h.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                            <td className="py-3 px-4">
                              {h.success ? (
                                <div className="flex items-center gap-1.5 text-emerald-400">
                                  <LogIn className="h-3.5 w-3.5" />
                                  <span className="text-xs">Success</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-red-400">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span className="text-xs">Failed</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{h.email}</td>
                            <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                              {new Date(h.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                              {h.ipAddress ?? "—"}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-xs">
                              {h.failReason ? (
                                <Badge variant="outline" className="text-red-400 border-red-400/20 text-xs">
                                  {h.failReason.replace(/_/g, " ")}
                                </Badge>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
