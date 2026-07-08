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
  useGetAnalyticsByHour,
  useGetAnalyticsRMultiples,
  useGetAnalyticsStreaks,
  useGetAnalyticsProfitFactorTrend,
  getGetPerformanceQueryKey,
  getGetAnalyticsBySymbolQueryKey,
  getGetAnalyticsByDayQueryKey,
  getGetAnalyticsByTagQueryKey,
  getGetAnalyticsByEmotionQueryKey,
  getGetAnalyticsByStrategyQueryKey,
  getGetAnalyticsBySessionQueryKey,
  getGetChecklistComplianceQueryKey,
  getGetAnalyticsByHourQueryKey,
  getGetAnalyticsRMultiplesQueryKey,
  getGetAnalyticsStreaksQueryKey,
  getGetAnalyticsProfitFactorTrendQueryKey,
  GetPerformancePeriod,
  GetPerformanceFilter,
  GetAnalyticsByDayPeriod,
  GetAnalyticsBySymbolPeriod,
  useGetAiStatus,
  useGeneratePatternAnalysis,
  useGetPatternAnalysis,
  getListAiReportsQueryKey,
  getGetPatternAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Bot, TrendingUp, Lock, AlertTriangle, DollarSign, Activity, Target, Zap, ChevronRight } from "lucide-react";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PERIOD_OPTIONS: { value: GetPerformancePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const OUTCOME_OPTIONS: { value: GetPerformanceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "winners", label: "Winners" },
  { value: "losers", label: "Losers" },
];

function MetricCard({ label, value, sub, prominent }: { label: string; value: string; sub?: string; prominent?: boolean }) {
  return (
    <Card>
      <CardContent className={prominent ? "pt-6" : "pt-4 pb-4"}>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</p>
        <p className={prominent ? "text-3xl font-bold font-mono mt-1.5" : "text-xl font-bold font-mono mt-1"}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function EquityDrawdownChart({
  equityCurve, drawdown,
}: {
  equityCurve: { date: string; equity: number; pnl: number }[];
  drawdown: { date: string; drawdown: number }[];
}) {
  const [view, setView] = useState<"equity" | "drawdown">("equity");
  const hasData = view === "equity" ? equityCurve.length > 0 : drawdown.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>{view === "equity" ? "Equity Curve" : "Drawdown"}</CardTitle>
          <Tabs value={view} onValueChange={(v) => setView(v as "equity" | "drawdown")}>
            <TabsList className="h-8">
              <TabsTrigger value="equity" className="text-xs px-3 py-1">Equity Curve</TabsTrigger>
              <TabsTrigger value="drawdown" className="text-xs px-3 py-1">Drawdown</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
            No data for this selection
          </div>
        ) : view === "equity" ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={equityCurve} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                formatter={(v: number) => [formatMoney(v), "Equity"]}
              />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="equity" stroke="#3B82F6" strokeWidth={2} fill="url(#equityGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={drawdown} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
              />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} fill="url(#drawdownGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<GetPerformancePeriod>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<GetPerformanceFilter>("all");
  const [dayPeriod] = useState<GetAnalyticsByDayPeriod>("all");
  const [symPeriod] = useState<GetAnalyticsBySymbolPeriod>("all");
  const [strategyFilter, setStrategyFilter] = useState("");
  const { activeAccountId } = useAccount();
  const acctParam = activeAccountId ?? undefined;

  const { data: perf, isLoading: perfLoading } = useGetPerformance(
    { period, filter: outcomeFilter, accountId: acctParam },
    { query: { queryKey: getGetPerformanceQueryKey({ period, filter: outcomeFilter, accountId: acctParam }) } }
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

  const hourPeriod = period === "today" ? "7d" : period as "7d" | "30d" | "3m" | "1y" | "all";

  const { data: bySession } = useGetAnalyticsBySession(
    { period: hourPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsBySessionQueryKey({ period: hourPeriod, accountId: acctParam }) } }
  );
  const { data: compliance } = useGetChecklistCompliance(
    { accountId: acctParam },
    { query: { queryKey: getGetChecklistComplianceQueryKey({ accountId: acctParam }) } }
  );
  const { data: byHour } = useGetAnalyticsByHour(
    { period: hourPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsByHourQueryKey({ period: hourPeriod, accountId: acctParam }) } }
  );
  const { data: rMultiples } = useGetAnalyticsRMultiples(
    { period: hourPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsRMultiplesQueryKey({ period: hourPeriod, accountId: acctParam }) } }
  );
  const { data: streaks } = useGetAnalyticsStreaks(
    { period: hourPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsStreaksQueryKey({ period: hourPeriod, accountId: acctParam }) } }
  );
  const { data: pfTrend } = useGetAnalyticsProfitFactorTrend(
    { period: hourPeriod, accountId: acctParam },
    { query: { queryKey: getGetAnalyticsProfitFactorTrendQueryKey({ period: hourPeriod, accountId: acctParam }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep insights into your trading performance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={outcomeFilter} onValueChange={(v) => setOutcomeFilter(v as GetPerformanceFilter)}>
            <TabsList>
              {OUTCOME_OPTIONS.map((o) => (
                <TabsTrigger key={o.value} value={o.value} className="text-xs px-3">{o.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as GetPerformancePeriod)}>
            <TabsList>
              {PERIOD_OPTIONS.map((o) => (
                <TabsTrigger key={o.value} value={o.value} className="text-xs px-3">{o.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {perfLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : perf ? (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <MetricCard prominent label="Total P&L" value={formatMoney(perf.totalPnl)} />
            <MetricCard prominent label="Win Rate" value={`${perf.winRate.toFixed(1)}%`} />
            <MetricCard prominent label="Profit Factor" value={perf.profitFactor?.toFixed(2) ?? "—"} />
            <MetricCard prominent label="Expectancy" value={formatMoney(perf.expectancy)} sub="avg P&L per trade" />
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <MetricCard label="Winners" value={String(perf.winners)} sub="closed profitable" />
            <MetricCard label="Losers" value={String(perf.losers)} sub="closed at loss" />
            <MetricCard label="Breakeven" value={String(perf.breakeven ?? 0)} sub="no gain/loss" />
            <MetricCard label="Total Trades" value={String(perf.totalTrades)} />
            <MetricCard label="Long Trades" value={String(perf.longTrades)} sub={perf.longWinRate != null ? `${perf.longWinRate.toFixed(0)}% WR` : undefined} />
            <MetricCard label="Short Trades" value={String(perf.shortTrades)} sub={perf.shortWinRate != null ? `${perf.shortWinRate.toFixed(0)}% WR` : undefined} />
            <MetricCard label="Max Drawdown" value={perf.drawdown?.length > 0 ? formatMoney(Math.min(...perf.drawdown.map(d => d.drawdown))) : "—"} />
            <MetricCard label="Max Consec. Losses" value={String(perf.maxConsecutiveLosses ?? 0)} sub="in a row" />
            <MetricCard label="Max DD Duration" value={perf.maxDrawdownDuration ? `${perf.maxDrawdownDuration}d` : "—"} sub="calendar days" />
          </div>

          <EquityDrawdownChart equityCurve={perf.equityCurve ?? []} drawdown={perf.drawdown ?? []} />
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
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Performance by Strategy</CardTitle>
                <Input
                  placeholder="Filter strategies…"
                  value={strategyFilter}
                  onChange={(e) => setStrategyFilter(e.target.value)}
                  className="h-7 w-44 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const filtered = strategyFilter
                  ? byStrategy.filter(s => s.strategy.toLowerCase().includes(strategyFilter.toLowerCase()))
                  : byStrategy;
                return (
                  <>
                    <div className="space-y-2">
                      {filtered.map((s, i) => (
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
                    {filtered.length > 0 && (
                      <ResponsiveContainer width="100%" height={180} className="mt-4">
                        <BarChart data={filtered} layout="vertical" margin={{ top: 4, right: 8, left: 80, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                          <YAxis type="category" dataKey="strategy" tick={{ fill: '#9CA3AF', fontSize: 10 }} tickLine={false} axisLine={false} width={76} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                            formatter={(v: number) => [`$${v.toFixed(2)}`, "P&L"]}
                          />
                          <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                            {filtered.map((s, i) => (
                              <Cell key={i} fill={s.pnl >= 0 ? "#10B981" : "#EF4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </>
                );
              })()}
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

        {/* Win / Loss / BE donut */}
        {perf && perf.totalTrades > 0 && (
          <Card>
            <CardHeader><CardTitle>Win / Loss / Breakeven</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Win", value: perf.winners },
                        { name: "Loss", value: perf.losers },
                        { name: "Breakeven", value: perf.breakeven ?? 0 },
                      ].filter(d => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                    >
                      <Cell fill="#10B981" />
                      <Cell fill="#EF4444" />
                      <Cell fill="#6B7280" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {[
                    { label: "Win", value: perf.winners, color: "#10B981" },
                    { label: "Loss", value: perf.losers, color: "#EF4444" },
                    { label: "Breakeven", value: perf.breakeven ?? 0, color: "#6B7280" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-muted-foreground">{item.value} trades</span>
                        <span className="text-foreground font-medium">
                          {perf.totalTrades > 0 ? ((item.value / perf.totalTrades) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* R-multiple distribution */}
        {rMultiples && rMultiples.totalTrades > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>R-Multiple Distribution</CardTitle>
                <span className="text-xs text-muted-foreground font-mono">
                  Avg: {rMultiples.avgRMultiple != null ? `${rMultiples.avgRMultiple > 0 ? "+" : ""}${rMultiples.avgRMultiple}R` : "—"}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rMultiples.buckets} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 9 }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                    formatter={(v: number, _: string, props: { payload?: { label?: string } }) => [v + " trades", props?.payload?.label ?? ""]}
                  />
                  {rMultiples.avgRMultiple != null && (
                    <ReferenceLine x={rMultiples.avgRMultiple >= 0 ? "0R to 1R" : "-1R to 0R"} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Avg", fill: '#F59E0B', fontSize: 9 }} />
                  )}
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {rMultiples.buckets.map((b) => (
                      <Cell key={b.label} fill={b.label.startsWith("<") || b.label.startsWith("-") ? "#EF4444" : "#10B981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Profit factor trend */}
        {pfTrend && pfTrend.length > 1 && (
          <Card>
            <CardHeader><CardTitle>Monthly Profit Factor Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pfTrend} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2937', color: '#F9FAFB', borderRadius: 8 }}
                    formatter={(v: number, name: string) => [name === "profitFactor" ? v.toFixed(2) : v, name === "profitFactor" ? "Profit Factor" : "Trades"]}
                  />
                  <Legend formatter={(v) => v === "profitFactor" ? "Profit Factor" : "Trades"} wrapperStyle={{ fontSize: 10, color: '#9CA3AF' }} />
                  <ReferenceLine y={1} stroke="#6B7280" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="profitFactor" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Streak tracker */}
        {streaks && streaks.timeline.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Streak Tracker</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Current Streak</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${streaks.currentType === "win" ? "text-emerald-400" : streaks.currentType === "loss" ? "text-red-400" : "text-muted-foreground"}`}>
                    {streaks.currentType === "win" ? "+" : streaks.currentType === "loss" ? "-" : ""}{streaks.currentStreak}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{streaks.currentType ?? "none"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Best Win Streak</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-emerald-400">+{streaks.bestWinStreak}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">consecutive wins</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Worst Loss Streak</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-red-400">-{streaks.worstLossStreak}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">consecutive losses</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Last {streaks.timeline.length} trades</p>
                <div className="flex gap-0.5 flex-wrap">
                  {streaks.timeline.map((t, i) => (
                    <div
                      key={i}
                      title={t.outcome}
                      className={`w-4 h-4 rounded-sm flex-shrink-0 ${t.outcome === "win" ? "bg-emerald-500" : t.outcome === "loss" ? "bg-red-500" : "bg-gray-600"}`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hour-of-day heatmap — full width */}
      {byHour && byHour.length > 0 && (() => {
        const heatmapMap = new Map<string, { avgPnl: number; trades: number }>();
        for (const p of byHour) heatmapMap.set(`${p.day}:${p.hour}`, { avgPnl: p.avgPnl, trades: p.trades });
        const allPnls = byHour.map(p => p.avgPnl);
        const maxAbs = Math.max(...allPnls.map(Math.abs), 0.01);
        return (
          <Card>
            <CardHeader>
              <CardTitle>Hour-of-Day Heatmap</CardTitle>
              <p className="text-xs text-muted-foreground">Average P&L by UTC hour and day of week — green = profitable, red = losing</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Hour labels */}
                <div className="flex mb-1 pl-10">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground/60">{h}</div>
                  ))}
                </div>
                {/* Day rows */}
                {[1, 2, 3, 4, 5, 0, 6].map(day => (
                  <div key={day} className="flex items-center mb-0.5">
                    <div className="w-10 text-[10px] text-muted-foreground flex-shrink-0">{DAY_SHORT[day]}</div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = heatmapMap.get(`${day}:${hour}`);
                      const intensity = cell ? Math.min(Math.abs(cell.avgPnl) / maxAbs, 1) : 0;
                      const isPos = cell ? cell.avgPnl >= 0 : true;
                      const alpha = cell ? Math.max(0.1 + intensity * 0.85, 0.1) : 0;
                      const bg = cell
                        ? `rgba(${isPos ? "16,185,129" : "239,68,68"},${alpha.toFixed(2)})`
                        : "rgba(255,255,255,0.03)";
                      return (
                        <div
                          key={hour}
                          title={cell ? `${DAY_SHORT[day]} ${hour}:00 UTC — avg $${cell.avgPnl.toFixed(2)} (${cell.trades} trades)` : "No trades"}
                          className="flex-1 h-6 rounded-sm mx-px cursor-default transition-opacity hover:opacity-80"
                          style={{ backgroundColor: bg }}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-3 justify-end">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(239,68,68,0.7)' }} /> Loss
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-white/5 rounded-sm" /> No data
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(16,185,129,0.7)' }} /> Profit
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <AiInsightsSection />
    </div>
  );
}


interface PatternInsight {
  blindspots: {
    title: string;
    severity: "warning" | "critical";
    explanation: string;
    evidence: string;
    tip: string;
  }[];
  worstTrades: {
    symbol: string;
    direction: string;
    date: string;
    pnl: string;
    whatWentWrong: string;
    lesson: string;
  }[];
  actionPlan: {
    title: string;
    why: string;
    measure: string;
  }[];
}

function parseInsight(content: string): PatternInsight | null {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.blindspots)) return parsed as PatternInsight;
    return null;
  } catch {
    return null;
  }
}

// ── Stat card used in the top row ─────────────────────────────────────────────
function AiStatCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ backgroundColor: "#1a1f2e", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function AiInsightsSection() {
  const queryClient = useQueryClient();
  const { activeAccountId } = useAccount();
  const acctParam = activeAccountId ?? undefined;
  const { data: aiStatus } = useGetAiStatus();
  const { data: latestReport, isLoading } = useGetPatternAnalysis({
    query: { queryKey: getGetPatternAnalysisQueryKey() },
  });
  const { data: perf } = useGetPerformance(
    { period: "all" as const, accountId: acctParam },
    { query: { queryKey: getGetPerformanceQueryKey({ period: "all", accountId: acctParam }) } }
  );

  const patternMutation = useGeneratePatternAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPatternAnalysisQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
      },
    },
  });

  const aiAvailable = aiStatus?.available ?? false;
  const insight = latestReport ? parseInsight(latestReport.content) : null;

  const pnlColor = (perf?.totalPnl ?? 0) >= 0 ? "#22c55e" : "#ef4444";
  const pnlStr = perf
    ? `${perf.totalPnl >= 0 ? "+" : ""}${formatMoney(perf.totalPnl)}`
    : "—";

  return (
    <Card style={{ backgroundColor: "#12161f", borderColor: "rgba(255,255,255,0.06)" }}>
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-blue-400" />
            AI Pattern Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            {!aiAvailable && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Add ANTHROPIC_API_KEY to enable
              </div>
            )}
            {!latestReport && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1.5"
                disabled={!aiAvailable || patternMutation.isPending}
                onClick={() => patternMutation.mutate()}
              >
                {patternMutation.isPending ? (
                  <><Spinner className="h-3 w-3" /> Analyzing…</>
                ) : (
                  <><TrendingUp className="h-3 w-3" /> Analyze Patterns</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {patternMutation.isError && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {(patternMutation.error as Error | null)?.message ?? "Analysis failed"}
          </p>
        )}

        {/* ── Section 1: Stat Cards (always shown when perf data available) ── */}
        {perf && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AiStatCard icon={DollarSign} label="Total P&L" value={pnlStr} color={pnlColor} />
            <AiStatCard icon={Activity} label="Total Trades" value={String(perf.totalTrades)} color="#60a5fa" />
            <AiStatCard icon={Target} label="Win Rate" value={`${perf.winRate.toFixed(1)}%`}
              color={perf.winRate >= 50 ? "#22c55e" : "#ef4444"} />
            <AiStatCard icon={Zap} label="Profit Factor" value={perf.profitFactor.toFixed(2)}
              color={perf.profitFactor >= 1.5 ? "#22c55e" : perf.profitFactor >= 1 ? "#f59e0b" : "#ef4444"} />
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

        {/* ── AI content ── */}
        {!isLoading && insight ? (
          <div className="space-y-6">

            {/* Section 2: Blindspots */}
            {insight.blindspots.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" /> Your Blindspots
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {insight.blindspots.map((b, i) => {
                    const isCrit = b.severity === "critical";
                    const borderColor = isCrit ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)";
                    const bgColor    = isCrit ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)";
                    const badgeColor = isCrit ? "#ef4444" : "#f59e0b";
                    const badgeBg    = isCrit ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)";
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-4 space-y-2.5"
                        style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground/95 leading-tight">{b.title}</p>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide"
                            style={{ color: badgeColor, backgroundColor: badgeBg }}
                          >
                            {isCrit ? "CRITICAL" : "WARNING"}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/70 leading-relaxed">{b.explanation}</p>
                        <p className="text-[11px] font-mono" style={{ color: badgeColor }}>{b.evidence}</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: "#34d399" }}>
                          <ChevronRight className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                          {b.tip}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Worst Trades */}
            {insight.worstTrades.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your Worst Trades
                </p>
                <div className="space-y-2.5">
                  {insight.worstTrades.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-4 space-y-2"
                      style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                        >
                          #{i + 1}
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground">{t.symbol}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                          style={{
                            backgroundColor: t.direction === "LONG" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                            color: t.direction === "LONG" ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {t.direction}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.date}</span>
                        <span className="ml-auto text-sm font-bold font-mono" style={{ color: "#ef4444" }}>{t.pnl}</span>
                      </div>
                      {/* What went wrong */}
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">What went wrong</p>
                        <p className="text-xs text-foreground/75 leading-relaxed">{t.whatWentWrong}</p>
                      </div>
                      {/* Lesson */}
                      <div className="flex items-start gap-1.5">
                        <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "#34d399" }} />
                        <p className="text-[11px] leading-relaxed" style={{ color: "#34d399" }}>{t.lesson}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: Action Plan */}
            {insight.actionPlan.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your Action Plan
                </p>
                <div className="space-y-2.5">
                  {insight.actionPlan.map((a, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-4 flex gap-4"
                      style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <span
                        className="text-base font-black font-mono shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
                      >
                        {i + 1}
                      </span>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-bold text-foreground">{a.title}</p>
                        <p className="text-xs text-foreground/65 leading-relaxed">{a.why}</p>
                        <p className="text-[11px]" style={{ color: "#34d399" }}>
                          Measure: {a.measure}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latestReport && (
              <p className="text-[11px] text-muted-foreground/40 text-right">
                Last analyzed {new Date(latestReport.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>

        ) : !isLoading && latestReport ? (
          /* Fallback: old-format report — prompt user to re-analyze */
          <div className="space-y-3">
            <SafeMarkdown content={latestReport.content} className="text-xs text-muted-foreground leading-relaxed" />
            <p className="text-[11px] text-yellow-500/70">Future analyses will use the new visual format automatically.</p>
          </div>

        ) : !isLoading && (
          <div className="text-center py-10 space-y-3">
            <Bot className="h-10 w-10 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {aiAvailable
                ? "Run a pattern analysis to get personalized coaching based on your actual trade data."
                : "Configure your ANTHROPIC_API_KEY secret to unlock AI-powered pattern analysis."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
