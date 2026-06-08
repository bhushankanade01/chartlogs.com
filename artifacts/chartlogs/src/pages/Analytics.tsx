import { useState } from "react";
import {
  useGetPerformance,
  useGetAnalyticsBySymbol,
  useGetAnalyticsByDay,
  useGetAnalyticsByTag,
  useGetAnalyticsByEmotion,
  useGetAnalyticsByStrategy,
  useGetAnalyticsBySession,
  useGetChecklistCompliance,
  getGetPerformanceQueryKey,
  getGetAnalyticsBySymbolQueryKey,
  getGetAnalyticsByDayQueryKey,
  getGetAnalyticsByTagQueryKey,
  getGetAnalyticsByEmotionQueryKey,
  getGetAnalyticsByStrategyQueryKey,
  getGetAnalyticsBySessionQueryKey,
  getGetChecklistComplianceQueryKey,
  GetPerformancePeriod,
  GetAnalyticsByDayPeriod,
  GetAnalyticsBySymbolPeriod,
} from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold font-mono mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<GetPerformancePeriod>("30d");
  const [dayPeriod] = useState<GetAnalyticsByDayPeriod>("30d");
  const [symPeriod] = useState<GetAnalyticsBySymbolPeriod>("30d");
  const { activeAccountId } = useAccount();
  const acctParam = activeAccountId ?? undefined;

  const { data: perf, isLoading: perfLoading } = useGetPerformance(
    { period, accountId: acctParam },
    { query: { queryKey: getGetPerformanceQueryKey({ period, accountId: acctParam }) } }
  );
  const { data: bySymbol } = useGetAnalyticsBySymbol(
    { period: symPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsBySymbolQueryKey({ period: symPeriod, accountId: acctParam }) } }
  );
  const { data: byDay } = useGetAnalyticsByDay(
    { period: dayPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsByDayQueryKey({ period: dayPeriod, accountId: acctParam }) } }
  );
  const { data: byTag } = useGetAnalyticsByTag(
    { accountId: acctParam },
    { query: { queryKey: getGetAnalyticsByTagQueryKey({ accountId: acctParam }) } }
  );
  const { data: byEmotion } = useGetAnalyticsByEmotion(
    { accountId: acctParam },
    { query: { queryKey: getGetAnalyticsByEmotionQueryKey({ accountId: acctParam }) } }
  );
  const { data: byStrategy } = useGetAnalyticsByStrategy(
    { accountId: acctParam },
    { query: { queryKey: getGetAnalyticsByStrategyQueryKey({ accountId: acctParam }) } }
  );
  const { data: bySession } = useGetAnalyticsBySession(
    { accountId: acctParam },
    { query: { queryKey: getGetAnalyticsBySessionQueryKey({ accountId: acctParam }) } }
  );
  const { data: compliance } = useGetChecklistCompliance(
    { accountId: acctParam },
    { query: { queryKey: getGetChecklistComplianceQueryKey({ accountId: acctParam }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep insights into your trading performance</p>
        </div>
        <Select value={period} onValueChange={(v: GetPerformancePeriod) => setPeriod(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Past 7 Days</SelectItem>
            <SelectItem value="30d">Past 30 Days</SelectItem>
            <SelectItem value="3m">Past 3 Months</SelectItem>
            <SelectItem value="1y">Past Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {perfLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : perf ? (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Total P&L" value={formatMoney(perf.totalPnl)} />
            <MetricCard label="Win Rate" value={`${perf.winRate.toFixed(1)}%`} />
            <MetricCard label="Profit Factor" value={perf.profitFactor?.toFixed(2) ?? "—"} />
            <MetricCard label="Expectancy" value={formatMoney(perf.expectancy)} />
            <MetricCard label="Winners" value={String(perf.winners)} sub="closed profitable" />
            <MetricCard label="Losers" value={String(perf.losers)} sub="closed at loss" />
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <MetricCard label="Total Trades" value={String(perf.totalTrades)} />
            <MetricCard label="Long Trades" value={String(perf.longTrades)} sub={perf.longWinRate != null ? `${perf.longWinRate.toFixed(0)}% WR` : undefined} />
            <MetricCard label="Short Trades" value={String(perf.shortTrades)} sub={perf.shortWinRate != null ? `${perf.shortWinRate.toFixed(0)}% WR` : undefined} />
            <MetricCard label="Max Drawdown" value={perf.drawdown?.length > 0 ? formatMoney(Math.min(...perf.drawdown.map(d => d.drawdown))) : "—"} />
          </div>
        </>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {bySymbol && bySymbol.length > 0 && (
          <Card>
            <CardHeader><CardTitle>P&L by Symbol</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySymbol} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="symbol" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                    formatter={(v: number) => [formatMoney(v), "P&L"]}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {bySymbol.map((s) => (
                      <Cell key={s.symbol} fill={s.pnl >= 0 ? "#10B981" : "#EF4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {byDay && byDay.length > 0 && (
          <Card>
            <CardHeader><CardTitle>P&L by Day of Week</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byDay} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="day" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                    formatter={(v: number) => [formatMoney(v), "P&L"]}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {byDay.map((d) => (
                      <Cell key={d.day} fill={d.pnl >= 0 ? "#10B981" : "#EF4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {byTag && byTag.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Performance by Tag</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {byTag.map((t, i) => (
                  <div key={t.tag} className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{t.tag}</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono text-xs flex-shrink-0">
                      <span className="text-muted-foreground">{t.trades} trades</span>
                      <span className="text-muted-foreground">{t.winRate.toFixed(0)}% WR</span>
                      <span className={t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {formatMoney(t.pnl)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {byEmotion && byEmotion.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Performance by Emotion</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={byEmotion}
                      dataKey="trades"
                      nameKey="emotion"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                    >
                      {byEmotion.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                      formatter={(v: number, name: string) => [v + " trades", name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {byEmotion.map((e, i) => (
                    <div key={e.emotion} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{e.emotion}</span>
                      </div>
                      <span className={`font-mono ${e.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatMoney(e.pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {byStrategy && byStrategy.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Performance by Strategy</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {byStrategy.map((s, i) => (
                  <div key={s.strategy} className="flex items-center justify-between gap-2 text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-muted-foreground font-medium">{s.strategy}</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono text-xs flex-shrink-0">
                      <span className="text-muted-foreground">{s.trades} trades</span>
                      <span className="text-muted-foreground">{s.winRate.toFixed(0)}% WR</span>
                      {s.avgRMultiple != null && (
                        <span className="text-muted-foreground">{s.avgRMultiple > 0 ? "+" : ""}{s.avgRMultiple}R avg</span>
                      )}
                      <span className={s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {formatMoney(s.pnl)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180} className="mt-4">
                <BarChart data={byStrategy} layout="vertical" margin={{ top: 4, right: 8, left: 80, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="strategy" tick={{ fill: '#9CA3AF', fontSize: 10 }} tickLine={false} axisLine={false} width={76} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "P&L"]}
                  />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {byStrategy.map((s, i) => (
                      <Cell key={i} fill={s.pnl >= 0 ? "#10B981" : "#EF4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {compliance && compliance.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Checklist Compliance</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {compliance.map((c) => (
                  <div key={c.templateId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">{c.templateName}</span>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-muted-foreground">{c.totalResponses} responses</span>
                        <span className={c.avgComplianceRate >= 80 ? "text-emerald-400" : c.avgComplianceRate >= 50 ? "text-yellow-400" : "text-red-400"}>
                          {c.avgComplianceRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${c.avgComplianceRate >= 80 ? "bg-emerald-500" : c.avgComplianceRate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${c.avgComplianceRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {bySession && bySession.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Performance by Session</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bySession} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis dataKey="session" tick={{ fill: '#9CA3AF', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, "P&L"]}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {bySession.map((s, i) => (
                        <Cell key={i} fill={s.pnl >= 0 ? "#10B981" : "#EF4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2 self-center">
                  {bySession.map((s, i) => (
                    <div key={s.session} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{s.session}</span>
                      </div>
                      <div className="flex gap-3 font-mono">
                        <span className="text-muted-foreground">{s.winRate.toFixed(0)}%</span>
                        <span className={s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{formatMoney(s.pnl)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
