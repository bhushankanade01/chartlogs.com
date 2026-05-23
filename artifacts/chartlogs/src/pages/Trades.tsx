import { useState } from "react";
import { useListTrades, getListTradesQueryKey, Trade } from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney, formatDate, cnClass } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Search, Plus, Upload, ImageIcon, X, ChevronDown } from "lucide-react";
import { AddTradeDrawer } from "@/components/trades/AddTradeDrawer";
import { ImportTradesModal } from "@/components/trades/ImportTradesModal";

function getStorageUrl(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

function ScreenshotPreviewCell({ screenshots }: { screenshots?: string[] | null }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (!screenshots || screenshots.length === 0) return <td className="py-3 px-4 text-right text-muted-foreground/40">—</td>;

  return (
    <td className="py-3 px-4 text-right">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setLightboxIndex(0)}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        {screenshots.length}
      </button>
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] px-12" onClick={(e) => e.stopPropagation()}>
            <img
              src={getStorageUrl(screenshots[lightboxIndex])}
              alt=""
              className="max-h-[85vh] max-w-full object-contain rounded-md"
            />
            <button
              type="button"
              className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/40 rounded-full p-1"
              onClick={() => setLightboxIndex(null)}
            >
              <X className="h-5 w-5" />
            </button>
            {screenshots.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
                  onClick={() => setLightboxIndex((i) => ((i ?? 0) - 1 + screenshots.length) % screenshots.length)}
                >
                  <ChevronDown className="h-5 w-5 rotate-90" />
                </button>
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
                  onClick={() => setLightboxIndex((i) => ((i ?? 0) + 1) % screenshots.length)}
                >
                  <ChevronDown className="h-5 w-5 -rotate-90" />
                </button>
              </>
            )}
            <div className="flex justify-center gap-1.5 mt-3">
              {screenshots.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIndex ? "bg-white" : "bg-white/30"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </td>
  );
}

export default function Trades() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { activeAccountId } = useAccount();

  const params = { symbol: searchTerm || undefined, accountId: activeAccountId ?? undefined };
  const { data, isLoading } = useListTrades(
    params,
    { query: { queryKey: getListTradesQueryKey(params) } }
  );

  const trades = data?.trades || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Trades</h1>
        <div className="flex gap-2">
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
                    <th className="py-3 px-4 text-right font-medium">Tags</th>
                    <th className="py-3 px-4 text-right font-medium">Shots</th>
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
