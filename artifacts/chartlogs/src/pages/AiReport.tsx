import {
  useGetAiStatus,
  useGetAiQuota,
  useListAiReports,
  getGetAiQuotaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWeeklyReport, usePatternAnalysis } from "@/hooks/useAI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, FileText, TrendingUp, Clock } from "lucide-react";

function formatResetDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function AiReport() {
  const queryClient = useQueryClient();
  const { data: aiStatus } = useGetAiStatus();
  const { data: quota } = useGetAiQuota();
  const { data: reports, isLoading: reportsLoading } = useListAiReports({ limit: 10 });

  const weeklyReport = useWeeklyReport();
  const patternAnalysis = usePatternAnalysis();

  const aiAvailable = aiStatus?.available ?? false;
  const quotaExhausted = quota ? quota.used >= quota.limit : false;
  const isGenerating = weeklyReport.isGenerating || patternAnalysis.isGenerating;

  const handleGenerateWeekly = () => {
    weeklyReport.generate();
    queryClient.invalidateQueries({ queryKey: getGetAiQuotaQueryKey() });
  };

  const handleGeneratePatterns = () => {
    patternAnalysis.generate();
    queryClient.invalidateQueries({ queryKey: getGetAiQuotaQueryKey() });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-400" />
          AI Report
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate AI-powered weekly summaries and pattern analyses of your trading.
        </p>
      </div>

      {!aiAvailable && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="py-3 flex items-center gap-2 text-xs text-yellow-200/80">
            <Lock className="h-4 w-4 text-yellow-400 flex-shrink-0" />
            Add an ANTHROPIC_API_KEY secret to enable AI reports.
          </CardContent>
        </Card>
      )}

      {quota && (
        <Card style={{ backgroundColor: "#12161f", borderColor: "rgba(255,255,255,0.06)" }}>
          <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: quotaExhausted ? "rgba(239,68,68,0.12)" : "rgba(96,165,250,0.12)" }}
              >
                <Clock className={`h-4 w-4 ${quotaExhausted ? "text-red-400" : "text-blue-400"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {quota.used} / {quota.limit} reports used this week
                </p>
                <p className="text-xs text-muted-foreground">
                  Resets {formatResetDate(quota.resetsAt)}
                </p>
              </div>
            </div>
            {quotaExhausted && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10">
                Weekly limit reached
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card style={{ backgroundColor: "#12161f", borderColor: "rgba(255,255,255,0.06)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Weekly Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              A summary of your performance, wins, mistakes, and focus areas for the past week.
            </p>
            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={!aiAvailable || quotaExhausted || isGenerating}
              onClick={handleGenerateWeekly}
            >
              {weeklyReport.isGenerating ? (
                <><Spinner className="h-3 w-3" /> Generating…</>
              ) : (
                <><FileText className="h-3 w-3" /> Generate Weekly Report</>
              )}
            </Button>
            {weeklyReport.error && (
              <p className="text-xs text-red-400">{weeklyReport.error.message}</p>
            )}
            {weeklyReport.report && (
              <div className="rounded-lg p-3 mt-2" style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}>
                <SafeMarkdown content={weeklyReport.report.content} className="text-xs text-muted-foreground leading-relaxed" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: "#12161f", borderColor: "rgba(255,255,255,0.06)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              Pattern Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Personalized coaching based on blindspots, worst trades, and an actionable plan.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              disabled={!aiAvailable || quotaExhausted || isGenerating}
              onClick={handleGeneratePatterns}
            >
              {patternAnalysis.isGenerating ? (
                <><Spinner className="h-3 w-3" /> Analyzing…</>
              ) : (
                <><TrendingUp className="h-3 w-3" /> Generate Pattern Analysis</>
              )}
            </Button>
            {patternAnalysis.error && (
              <p className="text-xs text-red-400">{patternAnalysis.error.message}</p>
            )}
            {patternAnalysis.report && (
              <div className="rounded-lg p-3 mt-2" style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}>
                <SafeMarkdown content={patternAnalysis.report.content} className="text-xs text-muted-foreground leading-relaxed" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card style={{ backgroundColor: "#12161f", borderColor: "rgba(255,255,255,0.06)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reportsLoading && <div className="flex justify-center py-6"><Spinner /></div>}
          {!reportsLoading && (!reports || reports.length === 0) && (
            <div className="text-center py-8 space-y-2">
              <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto" />
              <p className="text-sm text-muted-foreground">No AI reports generated yet.</p>
            </div>
          )}
          {reports?.map((report) => (
            <details key={report.id} className="rounded-lg" style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}>
              <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {report.reportType === "weekly_report" ? (
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                  )}
                  {report.reportType === "weekly_report" ? "Weekly Report" : "Pattern Analysis"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </summary>
              <div className="px-4 pb-4">
                <SafeMarkdown content={report.content} className="text-xs text-muted-foreground leading-relaxed" />
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
