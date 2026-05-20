import { useState } from "react";
import { useCreateTrade, getListTradesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const COMMON_SYMBOLS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "USDCHF", "GBPJPY", "EURJPY", "XAUUSD", "XAGUSD",
  "US30", "NAS100", "SPX500",
];

const EMOTIONS = [
  "Confident", "Neutral", "Hesitant", "FOMO", "Anxious", "Excited", "Frustrated", "Revenge Trade",
];

const COMMON_TAGS = [
  "Breakout", "Reversal", "Trend Follow", "Swing", "Scalp",
  "News Trade", "Support/Resistance", "FOMO", "Momentum",
];

interface AddTradeDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AddTradeDrawer({ open, onClose }: AddTradeDrawerProps) {
  const queryClient = useQueryClient();
  const createTrade = useCreateTrade();

  const [symbol, setSymbol] = useState("EURUSD");
  const [customSymbol, setCustomSymbol] = useState("");
  const [type, setType] = useState<"long" | "short">("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [positionSize, setPositionSize] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [openTime, setOpenTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [closeTime, setCloseTime] = useState("");
  const [fees, setFees] = useState("0");
  const [emotion, setEmotion] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const resolvedSymbol = symbol === "__custom__" ? customSymbol.toUpperCase().trim() : symbol;

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    if (!resolvedSymbol || !entryPrice || !positionSize || !openTime) return;

    createTrade.mutate(
      {
        data: {
          symbol: resolvedSymbol,
          type,
          entryPrice: parseFloat(entryPrice),
          exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
          positionSize: parseFloat(positionSize),
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          openTime: new Date(openTime).toISOString(),
          closeTime: closeTime ? new Date(closeTime).toISOString() : undefined,
          fees: fees ? parseFloat(fees) : 0,
          emotion: emotion || undefined,
          notes: notes || undefined,
          tags: tags.length > 0 ? tags : undefined,
          source: "manual",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          onClose();
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setSymbol("EURUSD");
    setCustomSymbol("");
    setType("long");
    setEntryPrice("");
    setExitPrice("");
    setPositionSize("");
    setStopLoss("");
    setTakeProfit("");
    setOpenTime(new Date().toISOString().slice(0, 16));
    setCloseTime("");
    setFees("0");
    setEmotion("");
    setNotes("");
    setTags([]);
  };

  const isValid = resolvedSymbol && entryPrice && positionSize && openTime;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Add Trade</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {symbol === "__custom__" && (
                <Input
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. BTCUSD"
                  className="mt-1"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === "long" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setType("long")}
                >
                  Long
                </Button>
                <Button
                  type="button"
                  variant={type === "short" ? "default" : "outline"}
                  className={`flex-1 ${type === "short" ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
                  onClick={() => setType("short")}
                >
                  Short
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Entry Price *</Label>
              <Input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="0.00000"
                step="0.00001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Exit Price</Label>
              <Input
                type="number"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="Optional"
                step="0.00001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Position Size (lots) *</Label>
              <Input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                placeholder="0.10"
                step="0.01"
                min="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fees</Label>
              <Input
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stop Loss</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Optional"
                step="0.00001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Take Profit</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="Optional"
                step="0.00001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Open Time *</Label>
              <Input
                type="datetime-local"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Close Time</Label>
              <Input
                type="datetime-local"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Emotion</Label>
            <Select value={emotion} onValueChange={setEmotion}>
              <SelectTrigger>
                <SelectValue placeholder="How were you feeling?" />
              </SelectTrigger>
              <SelectContent>
                {EMOTIONS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {COMMON_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTag(t)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    tags.includes(t)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Custom tag…"
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={() => addTag(tagInput)}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trade rationale, observations…"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!isValid || createTrade.isPending}
            >
              {createTrade.isPending ? "Saving…" : "Add Trade"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
