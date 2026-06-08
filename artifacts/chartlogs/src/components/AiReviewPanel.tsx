import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAiReportsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Bot, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface AiReviewPanelProps {
  tradeId: number;
  existingReview?: string | null;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-base font-bold text-foreground mt-3 mb-1">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export function AiReviewPanel({ tradeId, existingReview }: AiReviewPanelProps) {
  const [streaming, setStreaming] = useState(false);
  const [content, setContent] = useState<string>(existingReview ?? "");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!!existingReview);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const hasContent = content.length > 0;

  const startReview = async () => {
    if (streaming) return;
    setStreaming(true);
    setError(null);
    setContent("");
    setExpanded(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/api/ai/trade-review/${tradeId}`, {
        method: "POST",
        credentials: "include",
        signal: abortRef.current.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        if (response.status === 503) {
          setError("AI not configured. Add your ANTHROPIC_API_KEY in Secrets to enable this feature.");
        } else {
          setError((json as { error?: string }).error ?? "Request failed");
        }
        setStreaming(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.done) break;
          if (data.error) { setError(data.error); break; }
          if (data.content) setContent(prev => prev + data.content);
        }
      }

      queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Connection failed. Try again.");
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={hasContent ? "outline" : "default"}
          className="h-7 text-xs gap-1.5"
          onClick={hasContent ? () => setExpanded(e => !e) : startReview}
          disabled={streaming}
        >
          {streaming ? (
            <><Spinner className="h-3 w-3" /> Analyzing…</>
          ) : hasContent ? (
            <><Bot className="h-3 w-3" />{expanded ? "Hide" : "Show"} AI Review {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</>
          ) : (
            <><Bot className="h-3 w-3" /> AI Review</>
          )}
        </Button>
        {hasContent && !streaming && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={startReview} title="Re-generate review">
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
      )}

      {expanded && hasContent && (
        <div
          className="text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-md px-3 py-2.5 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}

      {streaming && content && (
        <div
          className="text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-md px-3 py-2.5 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </div>
  );
}
