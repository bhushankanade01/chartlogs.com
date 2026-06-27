import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateWeeklyReport,
  useGeneratePatternAnalysis,
  getListAiReportsQueryKey,
  AiReport,
} from "@workspace/api-client-react";

// ── useWeeklyReport ────────────────────────────────────────────────────────────

export interface UseWeeklyReportResult {
  generate: () => void;
  isGenerating: boolean;
  report: AiReport | undefined;
  error: Error | null;
  reset: () => void;
}

/**
 * Wraps the weekly report mutation. On success, invalidates the reports list
 * so the AiReportsCard refreshes automatically.
 */
export function useWeeklyReport(): UseWeeklyReportResult {
  const queryClient = useQueryClient();

  const mutation = useGenerateWeeklyReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
      },
    },
  });

  return {
    generate: () => mutation.mutate(),
    isGenerating: mutation.isPending,
    report: mutation.data,
    error: mutation.error as Error | null,
    reset: () => mutation.reset(),
  };
}

// ── usePatternAnalysis ─────────────────────────────────────────────────────────

export interface UsePatternAnalysisResult {
  generate: () => void;
  isGenerating: boolean;
  report: AiReport | undefined;
  error: Error | null;
  reset: () => void;
}

/**
 * Wraps the pattern analysis mutation. On success, invalidates the reports list.
 */
export function usePatternAnalysis(): UsePatternAnalysisResult {
  const queryClient = useQueryClient();

  const mutation = useGeneratePatternAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
      },
    },
  });

  return {
    generate: () => mutation.mutate(),
    isGenerating: mutation.isPending,
    report: mutation.data,
    error: mutation.error as Error | null,
    reset: () => mutation.reset(),
  };
}

// ── useTradeFeedback ───────────────────────────────────────────────────────────

export interface UseTradeFeedbackResult {
  analyze: () => void;
  content: string;
  isStreaming: boolean;
  isDone: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Streams real-time AI feedback for a specific trade via SSE.
 * The server at POST /api/ai/trade-review/:tradeId streams back SSE chunks.
 * Auth is handled automatically via the session cookie.
 */
export function useTradeFeedback(tradeId: number): UseTradeFeedbackResult {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setContent("");
    setIsStreaming(false);
    setIsDone(false);
    setError(null);
  }, []);

  const analyze = useCallback(() => {
    reset();
    setIsStreaming(true);

    fetch(`/api/ai/trade-review/${tradeId}`, {
      method: "POST",
      credentials: "include", // session cookie
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Request failed" }));
          setError((body as { error?: string }).error ?? "AI request failed");
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("Streaming not supported");
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE messages are separated by double newlines
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as {
                content?: string;
                done?: boolean;
                error?: string;
              };
              if (payload.content) {
                setContent((prev) => prev + payload.content);
              }
              if (payload.done) {
                setIsDone(true);
                setIsStreaming(false);
              }
              if (payload.error) {
                setError(payload.error);
                setIsStreaming(false);
              }
            } catch {
              // malformed SSE chunk — skip
            }
          }
        }

        // Ensure we mark done even if the server closes without sending done:true
        setIsStreaming(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Network error");
        setIsStreaming(false);
      });
  }, [tradeId, reset]);

  return { analyze, content, isStreaming, isDone, error, reset };
}
