import { useState } from "react";
import {
  useListJournalEntries,
  useUpsertJournalEntry,
  getListJournalEntriesQueryKey,
  JournalEntry,
  useGetChecklistResponses,
  useListChecklistTemplates,
} from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ScreenshotUploader } from "@/components/ui/ScreenshotUploader";
import { BookOpen, ChevronDown, ChevronUp, Edit2, Check, X, Star } from "lucide-react";

const SESSION_COLORS: Record<string, string> = {
  London: "text-blue-400 border-blue-400/20",
  NewYork: "text-purple-400 border-purple-400/20",
  Asian: "text-yellow-400 border-yellow-400/20",
  Sydney: "text-emerald-400 border-emerald-400/20",
  OffHours: "text-muted-foreground border-border",
};

function StarDisplay({ rating }: { rating?: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-3 w-3 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

function ChecklistResponseView({ tradeId }: { tradeId: number }) {
  const { data: templates } = useListChecklistTemplates();
  const { data: responses } = useGetChecklistResponses(tradeId);

  if (!templates || templates.length === 0 || !responses || responses.length === 0) return null;

  const responsesByTemplate = new Map(responses.map(r => [r.templateId, r.answers as { questionId: string; checked: boolean }[]]));

  const relevantTemplates = templates.filter(t => responsesByTemplate.has(t.id));
  if (relevantTemplates.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      <p className="text-xs text-muted-foreground font-medium">Checklists</p>
      {relevantTemplates.map(t => {
        const answers = responsesByTemplate.get(t.id) ?? [];
        const questions = t.questions as { id: string; text: string }[];
        const checked = answers.filter(a => a.checked).length;
        return (
          <div key={t.id} className="text-xs border border-border/50 rounded-md p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground/80">{t.name}</span>
              <span className={`font-mono ${checked === questions.length ? "text-emerald-400" : "text-muted-foreground"}`}>{checked}/{questions.length}</span>
            </div>
            <div className="space-y-1">
              {questions.map(q => {
                const ans = answers.find(a => a.questionId === q.id);
                return (
                  <div key={q.id} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${ans?.checked ? "bg-emerald-500/20 border-emerald-500/40" : "border-border/60"}`}>
                      {ans?.checked && <Check className="w-2 h-2 text-emerald-400" />}
                    </span>
                    <span className={ans?.checked ? "line-through opacity-60" : ""}>{q.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MOOD_LABELS: Record<string, string> = {
  "1": "😊 Great",
  "2": "😐 Neutral",
  "3": "😰 Anxious",
  "4": "😤 Frustrated",
  "5": "😎 Confident",
};

const MOOD_COLORS: Record<string, string> = {
  "1": "text-emerald-400",
  "2": "text-blue-400",
  "3": "text-yellow-400",
  "4": "text-red-400",
  "5": "text-purple-400",
};

function getStorageUrl(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

function ThumbnailStrip({ screenshots, onOpen }: { screenshots: string[]; onOpen: (i: number) => void }) {
  if (!screenshots || screenshots.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {screenshots.map((p, i) => (
        <button
          key={p}
          type="button"
          onClick={() => onOpen(i)}
          className="w-14 h-14 rounded border border-border overflow-hidden hover:border-border/60 transition-colors"
        >
          <img src={getStorageUrl(p)} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

function Lightbox({ urls, initialIndex, onClose }: { urls: string[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const prev = () => setIndex((i) => (i - 1 + urls.length) % urls.length);
  const next = () => setIndex((i) => (i + 1) % urls.length);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative max-w-5xl max-h-[90vh] px-12" onClick={(e) => e.stopPropagation()}>
        <img src={urls[index]} alt="" className="max-h-[85vh] max-w-full object-contain rounded-md" />
        <button type="button" className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/40 rounded-full p-1" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
        {urls.length > 1 && (
          <>
            <button type="button" className="absolute left-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5" onClick={prev}>
              <ChevronDown className="h-5 w-5 rotate-90" />
            </button>
            <button type="button" className="absolute right-0 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5" onClick={next}>
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: JournalEntry }) {
  const queryClient = useQueryClient();
  const upsert = useUpsertJournalEntry();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");
  const [editScreenshots, setEditScreenshots] = useState<string[]>(entry.screenshots ?? []);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const moodKey = entry.mood ? String(entry.mood) : null;
  const hasContent = entry.notes || (entry.screenshots && entry.screenshots.length > 0);

  const handleSave = () => {
    upsert.mutate(
      {
        tradeId: entry.tradeId,
        data: {
          notes: editNotes || undefined,
          mood: entry.mood ?? undefined,
          screenshots: editScreenshots.length > 0 ? editScreenshots : undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          setEditing(false);
          setExpanded(true);
        },
      }
    );
  };

  const handleCancel = () => {
    setEditNotes(entry.notes ?? "");
    setEditScreenshots(entry.screenshots ?? []);
    setEditing(false);
  };

  return (
    <Card className="transition-colors hover:border-border/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-base font-semibold">
                {entry.trade?.symbol ? `${entry.trade.symbol} — ${entry.trade.type?.toUpperCase()}` : `Trade #${entry.tradeId}`}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <span>{formatDate(entry.createdAt)}</span>
                {moodKey && MOOD_LABELS[moodKey] && (
                  <span className={MOOD_COLORS[moodKey]}>· {MOOD_LABELS[moodKey]}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => { setEditing(true); setExpanded(true); }}
              title="Edit entry"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {hasContent && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
        {entry.trade && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2 items-center">
            {entry.trade.pnl != null && (
              <span className={`font-mono font-medium ${entry.trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {entry.trade.pnl >= 0 ? "+" : ""}${entry.trade.pnl.toFixed(2)}
              </span>
            )}
            {entry.trade.strategy && (
              <span className="text-foreground/70 font-medium">{entry.trade.strategy}</span>
            )}
            {entry.trade.session && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SESSION_COLORS[entry.trade.session] ?? ""}`}>
                {entry.trade.session}
              </Badge>
            )}
            {entry.trade.rating && (
              <StarDisplay rating={entry.trade.rating} />
            )}
            {entry.trade.rMultiple != null && (
              <span className="font-mono">R: {entry.trade.rMultiple.toFixed(1)}</span>
            )}
            {entry.trade.tags && entry.trade.tags.length > 0 && (
              <span className="flex gap-1 flex-wrap">
                {entry.trade.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </span>
            )}
          </div>
        )}

        {!editing && !expanded && entry.screenshots && entry.screenshots.length > 0 && (
          <ThumbnailStrip
            screenshots={entry.screenshots}
            onOpen={(i) => { setLightboxIndex(i); }}
          />
        )}
      </CardHeader>

      {(expanded || editing) && (
        <CardContent className="pt-0">
          <div className="border-t border-border pt-4 space-y-4">
            {editing ? (
              <>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Notes</p>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Trade reflections, lessons learned…"
                    rows={3}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Screenshots</p>
                  <ScreenshotUploader value={editScreenshots} onChange={setEditScreenshots} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {upsert.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel} disabled={upsert.isPending}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <ChecklistResponseView tradeId={entry.tradeId} />
                {entry.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{entry.notes}</p>
                  </div>
                )}
                {entry.screenshots && entry.screenshots.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-2">Screenshots</p>
                    <ThumbnailStrip screenshots={entry.screenshots} onOpen={setLightboxIndex} />
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}

      {lightboxIndex !== null && entry.screenshots && (
        <Lightbox
          urls={entry.screenshots.map(getStorageUrl)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </Card>
  );
}

export default function Journal() {
  const { activeAccountId } = useAccount();
  const acctParam = activeAccountId ?? undefined;

  const { data: entries, isLoading } = useListJournalEntries(
    { accountId: acctParam },
    { query: { queryKey: getListJournalEntriesQueryKey({ accountId: acctParam }) } }
  );

  const list = entries ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trade-level notes and reflections
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : list.length > 0 ? (
        <div className="space-y-4">
          {list.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No journal entries yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add notes to your trades to see them here. Open any trade and add a journal entry.
          </p>
        </div>
      )}
    </div>
  );
}
