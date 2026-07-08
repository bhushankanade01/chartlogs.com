import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListTrades, getListTradesQueryKey, useGetChecklistResponses, useListChecklistTemplates, useDeleteTrade, useClearAllTrades } from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney, formatDate, cnClass } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Upload, Star, Trash2 } from "lucide-react";
import { AddTradeDrawer } from "@/components/trades/AddTradeDrawer";
import { ImportTradesModal } from "@/components/trades/ImportTradesModal";
import { getStorageUrl, Lightbox } from "@/components/ui/ScreenshotUploader";

const SESSION_COLORS: Record<string, string> = {
  London: "text-blue-400 border-blue-400/20",
  NewYork: "text-purple-400 border-purple-400/20",
  Asian: "text-yellow-400 border-yellow-400/20",
  Sydney: "text-emerald-400 border-emerald-400/20",
  OffHours: "text-muted-foreground border-border",
};

function StarDisplay({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-muted-foreground/40">—</span>;
  return (
    <div className="flex gap-0.5 justify-end">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-3 w-3 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

function TradeChecklistBadge({ tradeId }: { tradeId: number }) {
  const { data: templates } = useListChecklistTemplates();
  const { data: responses } = useGetChecklistResponses(tradeId);

  if (!templates || !responses || responses.length === 0) return <span className="text-muted-foreground/40">—</span>;

  let totalQ = 0;
  let totalC = 0;
  for (const r of responses) {
    const t = templates.find(t => t.id === r.templateId);
    if (!t) continue;
    const questions = t.questions as { id: string }[];
    const answers = r.answers as { questionId: string; checked: boolean }[];
    totalQ += questions.length;
    totalC += answers.filter(a => a.checked).length;
  }
  if (totalQ === 0) return <span className="text-muted-foreground/40">—</span>;
  const complete = totalC === totalQ;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${complete ? "text-emerald-400" : "text-muted-foreground"}`}>
      ✓ {totalC}/{totalQ}
    </span>
  );
}

function ScreenshotPreviewCell({ screenshots }: { screenshots?: string[] | null }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!screenshots || screenshots.length === 0) {
    return <td className="py-3 px-4 text-right text-muted-foreground/40">—</td>;
  }

  const previewUrls = screenshots.slice(0, 3).map(getStorageUrl);
  const overflow = screenshots.length - previewUrls.length;

  return (
    <td className="py-3 px-4 text-right">
      <button
        type="button"
        className="inline-flex items-center gap-1 group"
        onClick={() => setLightboxIndex(0)}
        title={`${screenshots.length} screenshot${screenshots.length !== 1 ? "s" : ""} — click to view`}
      >
        {/* Stacked thumbnail strip — up to 3 images */}
        <div className="flex -space-x-1.5">
          {previewUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Shot ${i + 1}`}
              className="w-7 h-7 rounded object-cover border border-border group-hover:border-primary/50 transition-colors"
              style={{ zIndex: previewUrls.length - i }}
            />
          ))}
        </div>
        {overflow > 0 && (
          <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
            +{overflow}
          </span>
        )}
      </button>

      {lightboxIndex !== null && (
        <Lightbox
          urls={screenshots.map(getStorageUrl)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </td>
  );
}

export default function Trades() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { activeAccountId } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { symbol: searchTerm || undefined, accountId: activeAccountId ?? undefined };
  const queryKey = getListTradesQueryKey(params);
  const { data, isLoading } = useListTrades(
    params,
    { query: { queryKey } }
  );

  const deleteTrade = useDeleteTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
        toast({ title: "Trade deleted" });
      },
      onError: (e: any) => {
        toast({ variant: "destructive", title: "Delete failed", description: e?.message ?? "Please try again." });
      },
    },
  });

  const handleDelete = (id: number, symbol: string) => {
    if (!confirm(`Delete this ${symbol} trade? This cannot be undone.`)) return;
    deleteTrade.mutate({ id });
  };

  const clearAllTrades = useClearAllTrades({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
        toast({ title: `${res.deletedCount} trade${res.deletedCount === 1 ? "" : "s"} deleted` });
      },
      onError: (e: any) => {
        toast({ variant: "destructive", title: "Clear all failed", description: e?.message ?? "Please try again." });
      },
    },
  });

  const trades = data?.trades || [];

  const handleClearAll = () => {
    if (trades.length === 0) return;
    if (!confirm(`Delete all ${trades.length} trade${trades.length === 1 ? "" : "s"}${activeAccountId ? " for this account" : ""}? This cannot be undone.`)) return;
    clearAllTrades.mutate({ params: { accountId: activeAccountId ?? undefined } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Trades</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-red-400 border-red-400/30 hover:bg-red-400/10 hover:text-red-400"
            onClick={handleClearAll}
            disabled={clearAllTrades.isPending || trades.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setIsDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Trade
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
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
            <div className="py-12 flex justify-center"><Spinner /></div>
          ) : trades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/10">
                    <th className="py-3 px-4 text-left font-medium">Date</th>
                    <th className="py-3 px-4 text-left font-medium">Symbol</th>
                    <th className="py-3 px-4 text-left font-medium">Type</th>
                    <th className="py-3 px-4 text-right font-medium">Size</th>
                    <th className="py-3 px-4 text-right font-medium">Entry</th>
                    <th className="py-3 px-4 text-right font-medium">Exit</th>
                    <th className="py-3 px-4 text-right font-medium">P&L</th>
                    <th className="py-3 px-4 text-left font-medium">Strategy</th>
                    <th className="py-3 px-4 text-left font-medium">Session</th>
                    <th className="py-3 px-4 text-right font-medium">Rating</th>
                    <th className="py-3 px-4 text-right font-medium">Checklist</th>
                    <th className="py-3 px-4 text-right font-medium">Tags</th>
                    <th className="py-3 px-4 text-right font-medium">Charts</th>
                    <th className="py-3 px-4 text-right font-medium sticky right-0 bg-muted/10 backdrop-blur-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="py-3 px-4 whitespace-nowrap">{formatDate(trade.openTime)}</td>
                      <td className="py-3 px-4 font-bold">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={trade.type === 'long' ? 'text-emerald-400 border-emerald-400/20' : 'text-red-400 border-red-400/20'}>
                          {trade.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{trade.positionSize}</td>
                      <td className="py-3 px-4 text-right font-mono">{trade.entryPrice}</td>
                      <td className="py-3 px-4 text-right font-mono">{trade.exitPrice || '-'}</td>
                      <td className={cnClass(
                        "py-3 px-4 text-right font-mono font-medium",
                        trade.pnl && trade.pnl > 0 ? "text-emerald-400" : trade.pnl && trade.pnl < 0 ? "text-red-400" : ""
                      )}>
                        {trade.pnl ? formatMoney(trade.pnl) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {trade.strategy
                          ? <span className="text-foreground/80 truncate max-w-[100px] block">{trade.strategy}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {trade.session
                          ? <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SESSION_COLORS[trade.session] ?? "text-muted-foreground"}`}>{trade.session}</Badge>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <StarDisplay rating={trade.rating} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <TradeChecklistBadge tradeId={trade.id} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {trade.tags?.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {trade.tags && trade.tags.length > 2 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              +{trade.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <ScreenshotPreviewCell screenshots={trade.screenshots} />
                      <td className="py-3 px-4 text-right sticky right-0 bg-card">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => handleDelete(trade.id, trade.symbol)}
                          disabled={deleteTrade.isPending}
                          aria-label={`Delete ${trade.symbol} trade`}
                          title="Delete trade"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-foreground mb-2">No trades found</h3>
              <p className="text-muted-foreground mb-6">You haven't recorded any trades matching your filters.</p>
              <Button onClick={() => setIsDrawerOpen(true)}>Add your first trade</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddTradeDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <ImportTradesModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
