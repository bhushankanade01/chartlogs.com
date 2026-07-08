import { useMemo, useState } from "react";
import { useListTrades, getListTradesQueryKey, Trade } from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney, formatPips, formatDate, cnClass } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Search, ArrowUpRight, ArrowDownRight, Clock, Star } from "lucide-react";

const SESSION_COLORS: Record<string, string> = {
  London: "text-blue-400 border-blue-400/20",
  NewYork: "text-purple-400 border-purple-400/20",
  Asian: "text-yellow-400 border-yellow-400/20",
  Sydney: "text-emerald-400 border-emerald-400/20",
  OffHours: "text-muted-foreground border-border",
};

const OUTCOME_COLORS: Record<string, string> = {
  win: "text-emerald-400 border-emerald-400/20",
  loss: "text-red-400 border-red-400/20",
  breakeven: "text-muted-foreground border-border",
};

function formatDuration(openTime: string, closeTime: string | null | undefined): string {
  if (!closeTime) return "Open";
  const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
  if (ms < 0) return "-";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remMinutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

function StatCard({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</p>
        <p className={cnClass("text-lg font-bold font-mono mt-1", valueClassName)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TradeDetailPanel({ trade }: { trade: Trade }) {
  const pnlColor = trade.pnl && trade.pnl > 0 ? "text-emerald-400" : trade.pnl && trade.pnl < 0 ? "text-red-400" : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{trade.symbol}</h2>
            <Badge
              variant="outline"
              className={trade.type === "long" ? "text-emerald-400 border-emerald-400/20" : "text-red-400 border-red-400/20"}
            >
              {trade.type === "long" ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {trade.type.toUpperCase()}
            </Badge>
            {trade.outcome && (
              <Badge variant="outline" className={OUTCOME_COLORS[trade.outcome] ?? ""}>
                {trade.outcome.toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Opened {formatDate(trade.openTime)}
            {trade.closeTime && <> &middot; Closed {formatDate(trade.closeTime)}</>}
          </p>
        </div>
        <p className={cnClass("text-3xl font-bold font-mono", pnlColor)}>
          {trade.pnl != null ? formatMoney(trade.pnl) : "Open"}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Entry Price" value={trade.entryPrice} />
        <StatCard label="Exit Price" value={trade.exitPrice ?? "-"} />
        <StatCard label="Position Size" value={trade.positionSize} />
        <StatCard label="Stop Loss" value={trade.stopLoss ?? "-"} />
        <StatCard label="Take Profit" value={trade.takeProfit ?? "-"} />
        <StatCard label="Pips" value={formatPips(trade.pips)} valueClassName={trade.pips && trade.pips > 0 ? "text-emerald-400" : trade.pips && trade.pips < 0 ? "text-red-400" : ""} />
        <StatCard label="R-Multiple" value={trade.rMultiple != null ? `${trade.rMultiple.toFixed(2)}R` : "-"} />
        <StatCard label="Risk:Reward" value={trade.rrRatio != null ? `1:${trade.rrRatio.toFixed(2)}` : "-"} />
        <StatCard
          label="Duration"
          value={
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDuration(trade.openTime, trade.closeTime)}
            </span>
          }
        />
        <StatCard
          label="Session"
          value={
            trade.session ? (
              <Badge variant="outline" className={cnClass("text-xs", SESSION_COLORS[trade.session] ?? "text-muted-foreground")}>
                {trade.session}
              </Badge>
            ) : (
              "-"
            )
          }
        />
        <StatCard label="Strategy" value={trade.strategy ?? "-"} />
        <StatCard
          label="Rating"
          value={
            trade.rating ? (
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={cnClass("h-4 w-4", s <= trade.rating! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20")} />
                ))}
              </span>
            ) : (
              "-"
            )
          }
        />
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-1.5">Emotion</p>
            {trade.emotion ? (
              <Badge variant="secondary">{trade.emotion}</Badge>
            ) : (
              <span className="text-sm text-muted-foreground/50">Not recorded</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-1.5">Tags</p>
            {trade.tags && trade.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {trade.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground/50">No tags</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-1.5">Notes</p>
            {trade.notes ? (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{trade.notes}</p>
            ) : (
              <span className="text-sm text-muted-foreground/50">No notes for this trade</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TradeAnalysis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const { activeAccountId } = useAccount();

  const params = { accountId: activeAccountId ?? undefined, limit: 500 };
  const { data, isLoading } = useListTrades(params, { query: { queryKey: getListTradesQueryKey(params) } });

  const trades = useMemo(() => {
    const all = data?.trades ?? [];
    if (!searchTerm) return all;
    const term = searchTerm.toLowerCase();
    return all.filter((t) => t.symbol.toLowerCase().includes(term));
  }, [data, searchTerm]);

  const selectedTrade = trades.find((t) => t.id === selectedTradeId) ?? trades[0] ?? null;
  const effectiveSelectedId = selectedTradeId != null && trades.some((t) => t.id === selectedTradeId) ? selectedTradeId : selectedTrade?.id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trade Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">Select a trade to inspect its full detail breakdown.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        <Card className="lg:sticky lg:top-4">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Spinner />
              </div>
            ) : trades.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground px-4">
                No trades found.
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-border/50">
                {trades.map((trade) => {
                  const isSelected = trade.id === effectiveSelectedId;
                  return (
                    <button
                      key={trade.id}
                      type="button"
                      onClick={() => setSelectedTradeId(trade.id)}
                      className={cnClass(
                        "w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3",
                        isSelected ? "bg-primary/10" : "hover:bg-muted/30"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm">{trade.symbol}</span>
                          {trade.type === "long" ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{formatDate(trade.openTime)}</p>
                      </div>
                      <span
                        className={cnClass(
                          "text-sm font-mono font-medium flex-shrink-0",
                          trade.pnl && trade.pnl > 0 ? "text-emerald-400" : trade.pnl && trade.pnl < 0 ? "text-red-400" : "text-muted-foreground"
                        )}
                      >
                        {trade.pnl != null ? formatMoney(trade.pnl) : "-"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          {isLoading ? (
            <div className="py-24 flex justify-center">
              <Spinner />
            </div>
          ) : selectedTrade ? (
            <TradeDetailPanel trade={selectedTrade} />
          ) : (
            <div className="py-24 text-center text-sm text-muted-foreground">
              No trade selected. Pick a trade from the list to view its details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
