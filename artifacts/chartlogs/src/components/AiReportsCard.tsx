import { useState } from "react";
import {
  useGetAiStatus,
  useListAiReports,
  useGenerateWeeklyReport,
  useGeneratePatternAnalysis,
  getListAiReportsQueryKey,
  AiReport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Bot, FileText, TrendingUp, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { formatDate } from "@/lib/format";

function ReportView({ report, onClose }: { report: AiReport; onClose: () => void }) {
  const label = report.reportType === "weekly_report" ? "Weekly Report" : "Pattern Analysis";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground/80">{label}</p>
          <p className="text-xs text-muted-foreground">{formatDate(report.createdAt)}</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>← Back</Button>
      </div>
      <SafeMarkdown
        content={report.content}
        className="text-xs text-muted-foreground leading-relaxed max-h-96 overflow-y-auto pr-1 space-y-0.5"
      />
    </div>
  );
}

export function AiReportsCard() {
  const queryClient = useQueryClient();
  const [activeReport, setActiveReport] = useState<AiReport | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: aiStatus } = useGetAiStatus();
  const { data: reports, isLoading } = useListAiReports(
    { reportType: undefined, limit: 10 },
    { query: { queryKey: getListAiReportsQueryKey({ limit: 10 }) } }
  );

  const weeklyMutation = useGenerateWeeklyReport({
    mutation: {
      onSuccess: (report) => {
        queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
        setActiveReport(report);
      },
    },
  });

  const patternMutation = useGeneratePatternAnalysis({
    mutation: {
      onSuccess: (report) => {
        queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
        setActiveReport(report);
      },
    },
  });

  const isGenerating = weeklyMutation.isPending || patternMutation.isPending;
  const aiAvailable = aiStatus?.available ?? false;
  const nonTradeReports = (reports ?? []).filter(r => r.reportType !== "trade_review");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-400" />
            AI Reports
          </CardTitle>
          {!aiAvailable && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Add ANTHROPIC_API_KEY to enable
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeReport ? (
          <ReportView report={activeReport} onClose={() => setActiveReport(null)} />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 flex-1"
                disabled={!aiAvailable || isGenerating}
                onClick={() => weeklyMutation.mutate()}
              >
                {weeklyMutation.isPending ? <Spinner className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                Weekly Report
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 flex-1"
                disabled={!aiAvailable || isGenerating}
                onClick={() => patternMutation.mutate()}
              >
                {patternMutation.isPending ? <Spinner className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                Pattern Analysis
              </Button>
            </div>

            {(weeklyMutation.isError || patternMutation.isError) && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                {(weeklyMutation.error as Error | null)?.message ?? (patternMutation.error as Error | null)?.message ?? "Generation failed"}
              </p>
            )}

            {isLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : nonTradeReports.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Previous Reports</p>
                <div className="space-y-1">
                  {nonTradeReports.map(r => (
                    <div key={r.id} className="border border-border/40 rounded-md overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {r.reportType === "weekly_report" ? (
                            <FileText className="h-3 w-3 text-blue-400 flex-shrink-0" />
                          ) : (
                            <TrendingUp className="h-3 w-3 text-purple-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">
                            {r.reportType === "weekly_report" ? "Weekly Report" : "Pattern Analysis"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                          {expandedId === r.id ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </button>
                      {expandedId === r.id && (
                        <div className="px-3 pb-3 pt-1 border-t border-border/40">
                          <SafeMarkdown
                            content={r.content}
                            className="text-xs text-muted-foreground leading-relaxed max-h-64 overflow-y-auto space-y-0.5"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                {aiAvailable ? "No reports yet — generate your first one above." : "Configure your API key to generate AI-powered reports."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
