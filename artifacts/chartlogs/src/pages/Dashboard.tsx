import { useState } from "react";
import {
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
  useGetEquityCurve,
  getGetEquityCurveQueryKey,
  useGetDashboardCalendar,
  getGetDashboardCalendarQueryKey,
  useGetRecentTrades,
  getGetRecentTradesQueryKey,
  GetDashboardStatsPeriod,
} from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney, formatDate, cnClass } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AiReportsCard } from "@/components/AiReportsCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Activity,
  Zap,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-9 w-9 rounded-lg bg-muted" />
      </div>
      <div className="h-8 w-28 bg-muted rounded mb-2" />
      <div className="h-3 w-16 bg-muted rounded" />
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  iconColor,
  iconBg,
  sub,
}: {
  title: string;
  value: string;
  trend?: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  sub?: string;
}) {
  const valueColor =
    trend === "positive"
      ? "text-emerald-400"
      : trend === "negative"
      ? "text-red-400"
      : "text-foreground";

  return (
    <div className="group relative rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/10 hover:border-primary/20">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight ${valueColor}`}>{value}</div>
      {sub && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          {trend === "positive" ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
          ) : trend === "negative" ? (
            <ArrowDownRight className="h-3 w-3 text-red-400" />
          ) : null}
          {sub}
        </div>
      )}
      {trend !== undefined && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${
            trend === "positive"
              ? "bg-emerald-400"
              : trend === "negative"
              ? "bg-red-400"
              : "bg-primary"
          }`}
        />
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
        <p className="text-muted-foreground mb-0.5">{label ? formatDate(label as string) : ""}</p>
        <p className="font-mono font-semibold text-foreground">{formatMoney(payload[0]?.value as number)}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [period, setPeriod] = useState<GetDashboardStatsPeriod>("all");
  const { activeAccountId } = useAccount();
  const acctParam = activeAccountId ?? undefined;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(
    { period, accountId: acctParam },
    { query: { queryKey: getGetDashboardStatsQueryKey({ period, accountId: acctParam }) } }
  );

  const { data: equityCurve, isLoading: equityLoading } = useGetEquityCurve(
    { period, accountId: acctParam },
    { query: { queryKey: getGetEquityCurveQueryKey({ period, accountId: acctParam }) } }
  );

  const { data: calendar, isLoading: calendarLoading } = useGetDashboardCalendar(
    { accountId: acctParam },
    { query: { queryKey: getGetDashboardCalendarQueryKey({ accountId: acctParam }) } }
  );

  const { data: recentTrades, isLoading: tradesLoading } = useGetRecentTrades(
    { accountId: acctParam },
    { query: { queryKey: getGetRecentTradesQueryKey({ accountId: acctParam }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your trading performance at a glance</p>
        </div>
        <Select value={period} onValueChange={(v: GetDashboardStatsPeriod) => setPeriod(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Today</SelectItem>
            <SelectItem value="1w">Past Week</SelectItem>
            <SelectItem value="1m">Past Month</SelectItem>
            <SelectItem value="3m">Past 3 Months</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            title="Total P&L"
            value={formatMoney(stats.totalPnl)}
            trend={stats.totalPnl >= 0 ? "positive" : "negative"}
            icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
            iconColor={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
            iconBg={stats.totalPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          />
          <StatCard
            title="Win Rate"
            value={`${(stats.winRate * 100).toFixed(1)}%`}
            trend="neutral"
            icon={Target}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10"
          />
          <StatCard
            title="Realized P&L"
            value={formatMoney(stats.realizedPnl)}
            trend={stats.realizedPnl >= 0 ? "positive" : "negative"}
            icon={DollarSign}
            iconColor={stats.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}
            iconBg={stats.realizedPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          />
          <StatCard
            title="Open Trades"
            value={stats.openTrades.toString()}
            trend="neutral"
            icon={Activity}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/10"
          />
          <StatCard
            title="Best Trade"
            value={formatMoney(stats.bestTrade)}
            trend="positive"
            icon={Zap}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
          />
          <StatCard
            title="Avg R:R"
            value={`${stats.avgRR.toFixed(2)}`}
            trend="neutral"
            icon={BarChart2}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10"
          />
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            {equityLoading ? (
              <div className="h-[280px] animate-pulse bg-muted/30 rounded-lg" />
            ) : equityCurve && equityCurve.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="url(#equityGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#3B82F6", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart2 className="h-10 w-10 opacity-30" />
                <p className="text-sm">No data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">P&L Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            {calendarLoading ? (
              <div className="h-[280px] animate-pulse bg-muted/30 rounded-lg" />
            ) : calendar ? (
              <div className="grid grid-cols-7 gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div key={`${day}-${i}`} className="text-center text-[10px] text-muted-foreground font-medium py-1">
                    {day}
                  </div>
                ))}
                {Array.from({
                  length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay(),
                }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {calendar.map((day) => (
                  <div
                    key={day.date}
                    className={cnClass(
                      "aspect-square rounded-md flex items-center justify-center text-[10px] font-mono cursor-pointer transition-all duration-200 hover:scale-110",
                      day.pnl > 0
                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/35"
                        : day.pnl < 0
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/35"
                        : day.tradeCount > 0
                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/35"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                    title={`${formatDate(day.date)}: ${formatMoney(day.pnl)} (${day.tradeCount} trades)`}
                  >
                    {new Date(day.date).getDate()}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AiReportsCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tradesLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentTrades && recentTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Symbol</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Size</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Entry</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Exit</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade, i) => (
                    <tr
                      key={trade.id}
                      className={cnClass(
                        "border-b border-border/40 last:border-0 transition-colors duration-150 hover:bg-primary/5 cursor-default",
                        i % 2 === 0 ? "" : "bg-muted/10"
                      )}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(trade.openTime)}
                      </td>
                      <td className="py-3 px-4 font-semibold font-mono">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span
                          className={cnClass(
                            "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md",
                            trade.type === "long"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {trade.type === "long" ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {trade.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{trade.positionSize}</td>
                      <td className="py-3 px-4 text-right font-mono">{trade.entryPrice}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {trade.exitPrice || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {trade.pnl != null ? (
                          <span
                            className={cnClass(
                              "inline-block font-mono font-medium text-sm px-2 py-0.5 rounded",
                              trade.pnl > 0
                                ? "text-emerald-400 bg-emerald-500/10"
                                : trade.pnl < 0
                                ? "text-red-400 bg-red-500/10"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatMoney(trade.pnl)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                <Activity className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No trades yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Connect your broker or add trades manually to see them here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
