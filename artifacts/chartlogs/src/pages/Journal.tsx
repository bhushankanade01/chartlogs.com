import { useState } from "react";
import {
  useListJournalEntries,
  getListJournalEntriesQueryKey,
  JournalEntry,
} from "@workspace/api-client-react";
import { useAccount } from "@/contexts/AccountContext";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

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

function EntryCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);
  const moodKey = entry.mood ? String(entry.mood) : null;

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
          {entry.notes && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground flex-shrink-0"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {entry.trade && (
          <div className="flex gap-4 text-xs font-mono text-muted-foreground mt-2">
            {entry.trade.pnl != null && (
              <span className={entry.trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {entry.trade.pnl >= 0 ? "+" : ""}${entry.trade.pnl.toFixed(2)}
              </span>
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
      </CardHeader>

      {expanded && entry.notes && (
        <CardContent className="pt-0">
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{entry.notes}</p>
          </div>
        </CardContent>
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
