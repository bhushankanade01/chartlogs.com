import { useState, useEffect, useRef } from "react";
import {
  useCreateTrade, getListTradesQueryKey,
  useListChecklistTemplates, useGetChecklistResponses, useUpsertChecklistResponse,
  useListTrades,
} from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScreenshotUploader } from "@/components/ui/ScreenshotUploader";
import { Star, X, ChevronDown, ChevronUp } from "lucide-react";

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

const SESSIONS = [
  { value: "London", label: "London (07:00–12:00 UTC)" },
  { value: "NewYork", label: "New York (12:00–21:00 UTC)" },
  { value: "Asian", label: "Asian (00:00–07:00 UTC)" },
  { value: "Sydney", label: "Sydney (21:00–00:00 UTC)" },
  { value: "OffHours", label: "Off Hours" },
];

function detectSessionFromTime(isoTime: string): string {
  const date = new Date(isoTime);
  const hour = date.getUTCHours();
  if (hour >= 7 && hour < 12) return "London";
  if (hour >= 12 && hour < 21) return "NewYork";
  if (hour >= 0 && hour < 7) return "Asian";
  return "Sydney";
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? null : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          className="focus:outline-none"
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              star <= (hover ?? value ?? 0)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
      {value !== null && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-foreground ml-1">
          clear
        </button>
      )}
    </div>
  );
}

function ChecklistSection({ tradeId }: { tradeId: number }) {
  const { data: templates } = useListChecklistTemplates();
  const { data: existingResponses } = useGetChecklistResponses(tradeId);
  const upsertResponse = useUpsertChecklistResponse();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, Record<string, boolean>>>({});

  useEffect(() => {
    if (existingResponses) {
      const newAnswers: Record<number, Record<string, boolean>> = {};
      for (const r of existingResponses) {
        const ans: Record<string, boolean> = {};
        for (const a of (r.answers as { questionId: string; checked: boolean }[])) {
          ans[a.questionId] = a.checked;
        }
        newAnswers[r.templateId] = ans;
      }
      setAnswers(newAnswers);
    }
  }, [existingResponses]);

  if (!templates || templates.length === 0) return null;

  const handleCheck = (templateId: number, questionId: string, checked: boolean) => {
    const updatedAnswers = { ...(answers[templateId] ?? {}), [questionId]: checked };
    setAnswers(prev => ({ ...prev, [templateId]: updatedAnswers }));
    upsertResponse.mutate({
      tradeId,
      data: {
        templateId,
        answers: Object.entries(updatedAnswers).map(([qId, c]) => ({ questionId: qId, checked: c })),
      },
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium">Checklists</p>
      {templates.map((template) => {
        const isOpen = expanded[template.id] ?? true;
        const templateAnswers = answers[template.id] ?? {};
        const questions = template.questions as { id: string; text: string }[];
        const checkedCount = questions.filter(q => templateAnswers[q.id]).length;
        return (
          <div key={template.id} className="border border-border rounded-md">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded(prev => ({ ...prev, [template.id]: !isOpen }))}
            >
              <span className="font-medium">{template.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{checkedCount}/{questions.length}</span>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>
            {isOpen && questions.length > 0 && (
              <div className="px-3 pb-3 space-y-1.5 border-t border-border pt-2">
                {questions.map((q) => (
                  <label key={q.id} className="flex items-start gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={templateAnswers[q.id] ?? false}
                      onChange={(e) => handleCheck(template.id, q.id, e.target.checked)}
                      className="mt-0.5 rounded"
                    />
                    <span>{q.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface AddTradeDrawerProps {
  open: boolean;
  onClose: () => void;
}

function StrategyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useListTrades();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const pastStrategies = [...new Set(
    (data?.trades ?? [])
      .map(t => (t as unknown as Record<string, unknown>)["strategy"] as string | null)
      .filter((s): s is string => !!s)
  )].slice(0, 10);

  const filtered = pastStrategies.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="e.g. VWAP Retest"
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
              onMouseDown={() => { onChange(s); setShowSuggestions(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddTradeDrawer({ open, onClose }: AddTradeDrawerProps) {
  const queryClient = useQueryClient();
  const createTrade = useCreateTrade();
  const { activeAccountId } = useAccount();

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
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [strategy, setStrategy] = useState("");
  const [session, setSession] = useState(() => detectSessionFromTime(new Date().toISOString()));
  const [rating, setRating] = useState<number | null>(null);
  const [rMultiple, setRMultiple] = useState("");
  const [createdTradeId, setCreatedTradeId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (openTime) setSession(detectSessionFromTime(new Date(openTime).toISOString()));
  }, [openTime]);

  const resolvedSymbol = symbol === "__custom__" ? customSymbol.toUpperCase().trim() : symbol;

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

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
          screenshots: screenshots.length > 0 ? screenshots : undefined,
          source: "manual",
          accountId: activeAccountId ?? undefined,
          strategy: strategy || undefined,
          session: session as "London" | "NewYork" | "Asian" | "Sydney" | "OffHours",
          rating: rating ?? undefined,
          rMultiple: rMultiple ? parseFloat(rMultiple) : undefined,
        },
      },
      {
        onSuccess: (trade) => {
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          setCreatedTradeId(trade.id);
        },
      }
    );
  };

  const handleClose = () => { onClose(); resetForm(); };

  const resetForm = () => {
    setSymbol("EURUSD"); setCustomSymbol(""); setType("long"); setEntryPrice(""); setExitPrice("");
    setPositionSize(""); setStopLoss(""); setTakeProfit(""); setOpenTime(new Date().toISOString().slice(0, 16));
    setCloseTime(""); setFees("0"); setEmotion(""); setNotes(""); setTags([]); setScreenshots([]);
    setStrategy(""); setSession(detectSessionFromTime(new Date().toISOString())); setRating(null);
    setRMultiple(""); setCreatedTradeId(undefined);
  };

  const isValid = resolvedSymbol && entryPrice && positionSize && openTime;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{createdTradeId ? "Trade Added — Checklists" : "Add Trade"}</SheetTitle>
        </SheetHeader>

        {createdTradeId ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">Trade saved. Complete your pre/post-trade checklists (optional).</p>
            <ChecklistSection tradeId={createdTradeId} />
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Symbol</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_SYMBOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {symbol === "__custom__" && (
                  <Input value={customSymbol} onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())} placeholder="e.g. BTCUSD" className="mt-1" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Direction</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={type === "long" ? "default" : "outline"} className="flex-1" onClick={() => setType("long")}>Long</Button>
                  <Button type="button" variant={type === "short" ? "default" : "outline"} className={`flex-1 ${type === "short" ? "bg-red-500 hover:bg-red-600 text-white" : ""}`} onClick={() => setType("short")}>Short</Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Entry Price *</Label>
                <Input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00000" step="0.00001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Exit Price</Label>
                <Input type="number" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="Optional" step="0.00001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Position Size (lots) *</Label>
                <Input type="number" value={positionSize} onChange={(e) => setPositionSize(e.target.value)} placeholder="0.10" step="0.01" min="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fees</Label>
                <Input type="number" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" step="0.01" min="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stop Loss</Label>
                <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="Optional" step="0.00001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Take Profit</Label>
                <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="Optional" step="0.00001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Open Time *</Label>
                <Input type="datetime-local" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Close Time</Label>
                <Input type="datetime-local" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Strategy / Setup</Label>
                <StrategyInput value={strategy} onChange={setStrategy} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Session</Label>
                <Select value={session} onValueChange={setSession}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SESSIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Trade Quality</Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">R-Multiple</Label>
                <Input type="number" value={rMultiple} onChange={(e) => setRMultiple(e.target.value)} placeholder="e.g. 2.5" step="0.1" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Emotion</Label>
              <Select value={emotion} onValueChange={setEmotion}>
                <SelectTrigger><SelectValue placeholder="How were you feeling?" /></SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {COMMON_TAGS.map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${tags.includes(t) ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>{t}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} placeholder="Custom tag…" className="flex-1" />
                <Button type="button" variant="outline" onClick={() => addTag(tagInput)}>Add</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">{t}<button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trade rationale, observations…" rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Screenshots</Label>
              <ScreenshotUploader value={screenshots} onChange={setScreenshots} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={!isValid || createTrade.isPending}>
                {createTrade.isPending ? "Saving…" : "Add Trade"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
