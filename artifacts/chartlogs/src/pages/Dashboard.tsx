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
  GetDashboardStatsPeriod
} from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney, formatPips, formatDate, cnClass } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [period, setPeriod] = useState<GetDashboardStatsPeriod>("1m");
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-muted/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-1/2 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-3/4 bg-muted rounded mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard title="Total P&L" value={formatMoney(stats.totalPnl)} trend={stats.totalPnl >= 0 ? "positive" : "negative"} />
          <StatCard title="Win Rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
          <StatCard title="Realized P&L" value={formatMoney(stats.realizedPnl)} trend={stats.realizedPnl >= 0 ? "positive" : "negative"} />
          <StatCard title="Open Trades" value={stats.openTrades.toString()} />
          <StatCard title="Best Trade" value={formatMoney(stats.bestTrade)} trend="positive" />
          <StatCard title="Avg R:R" value={`${stats.avgRR.toFixed(2)}`} />
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            {equityLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Spinner />
              </div>
            ) : equityCurve && equityCurve.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6B7280" 
                      fontSize={12} 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getMonth()+1}/${d.getDate()}`;
                      }} 
                    />
                    <YAxis 
                      stroke="#6B7280" 
                      fontSize={12} 
                      tickFormatter={(val) => `$${val}`} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1F2937', color: '#F9FAFB' }}
                      formatter={(value: number) => [formatMoney(value), 'Equity']}
                      labelFormatter={(label) => formatDate(label as string)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: "#3B82F6", stroke: "#0A0D14", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>P&L Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            {calendarLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Spinner />
              </div>
            ) : calendar ? (
              <div className="grid grid-cols-7 gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">{day}</div>
                ))}
                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square bg-transparent rounded-sm" />
                ))}
                {calendar.map((day) => (
                  <div 
                    key={day.date} 
                    className={cnClass(
                      "aspect-square rounded-sm flex items-center justify-center text-[10px] font-mono cursor-pointer transition-colors relative group",
                      day.pnl > 0 ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : 
                      day.pnl < 0 ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : 
                      day.tradeCount > 0 ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : 
                      "bg-muted/30 text-muted-foreground hover:bg-muted/50"
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          {tradesLoading ? (
            <div className="py-8 flex justify-center"><Spinner /></div>
          ) : recentTrades && recentTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 text-left font-medium">Date</th>
                    <th className="py-3 text-left font-medium">Symbol</th>
                    <th className="py-3 text-left font-medium">Type</th>
                    <th className="py-3 text-right font-medium">Size</th>
                    <th className="py-3 text-right font-medium">Entry</th>
                    <th className="py-3 text-right font-medium">Exit</th>
                    <th className="py-3 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="py-3 whitespace-nowrap">{formatDate(trade.openTime)}</td>
                      <td className="py-3 font-medium">{trade.symbol}</td>
                      <td className="py-3">
                        <Badge variant="outline" className={trade.type === 'long' ? 'text-emerald-400 border-emerald-400/20' : 'text-red-400 border-red-400/20'}>
                          {trade.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-mono">{trade.positionSize}</td>
                      <td className="py-3 text-right font-mono">{trade.entryPrice}</td>
                      <td className="py-3 text-right font-mono">{trade.exitPrice || '-'}</td>
                      <td className={cnClass(
                        "py-3 text-right font-mono",
                        trade.pnl && trade.pnl > 0 ? "text-emerald-400" : trade.pnl && trade.pnl < 0 ? "text-red-400" : ""
                      )}>
                        {trade.pnl ? formatMoney(trade.pnl) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent trades found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, trend }: { title: string; value: string; trend?: "positive" | "negative" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cnClass(
          "text-2xl font-bold font-mono tracking-tight",
          trend === "positive" ? "text-emerald-400" : trend === "negative" ? "text-red-400" : ""
        )}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
