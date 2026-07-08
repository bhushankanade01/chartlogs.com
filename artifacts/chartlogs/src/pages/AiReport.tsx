import { useEffect, useState } from "react";
import {
  useGetAiStatus,
  useGetAiQuota,
  useListAiReports,
  getGetAiQuotaQueryKey,
  AiReport as AiReportType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWeeklyReport, usePatternAnalysis } from "@/hooks/useAI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Lock, FileText, TrendingUp, Clock, ArrowUpRight, ArrowDownRight, Target } from "lucide-react";

function formatResetDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatCountdown(resetsAt: string): string {
  const diffMs = new Date(resetsAt).getTime() - Date.now();
  if (diffMs <= 0) return "Resetting now";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h until reset`;
  if (hours > 0) return `${hours}h ${minutes}m until reset`;
  return `${minutes}m until reset`;
}

function formatDateRange(report: AiReportType): string {
  if (report.periodStart && report.periodEnd) {
    const start = new Date(report.periodStart);
    const end = new Date(report.periodEnd);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startFmt = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
    const endFmt = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${startFmt} – ${endFmt}`;
  }
  return new Date(report.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function reportTypeMeta(reportType: AiReportType["reportType"]) {
  if (reportType === "weekly_report") {
    return { label: "Weekly Report", icon: FileText };
  }
  if (reportType === "pattern_analysis") {
    return { label: "Pattern Analysis", icon: TrendingUp };
  }
  return { label: "Trade Review", icon: Target };
}

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

function ReportCard({ report, onOpen }: { report: AiReportType; onOpen: (report: AiReportType) => void }) {
  const { label, icon: Icon } = reportTypeMeta(report.reportType);
  const pnl = report.totalPnl;
  const pnlPositive = pnl != null && pnl >= 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="text-left rounded-lg p-4 space-y-3 transition-colors hover-elevate"
      style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid={`card-report-${report.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-blue-400" />
          {label}
        </span>
        {isNew(report.createdAt) && (
          <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-[10px]">New</Badge>
        )}
      </div>

      <h3 className="text-sm font-semibold leading-snug line-clamp-2">
        {report.title ?? label}
      </h3>

      <p className="text-xs text-muted-foreground">{formatDateRange(report)}</p>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">P&L</p>
          {pnl != null ? (
            <p className={`text-sm font-semibold flex items-center gap-0.5 ${pnlPositive ? "text-emerald-400" : "text-red-400"}`}>
              {pnlPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              ${Math.abs(pnl).toFixed(0)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Win Rate</p>
          <p className="text-sm font-semibold">{report.winRate != null ? `${report.winRate.toFixed(0)}%` : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trades</p>
          <p className="text-sm font-semibold">{report.tradeCount ?? "—"}</p>
        </div>
      </div>
    </button>
  );
}

export default function AiReport() {
  const queryClient = useQueryClient();
  const { data: aiStatus } = useGetAiStatus();
  const { data: quota } = useGetAiQuota();
  const { data: reports, isLoading: reportsLoading } = useListAiReports({ limit: 10 });
  const [selectedReport, setSelectedReport] = useState<AiReportType | null>(null);
  const [, forceRerender] = useState(0);

  const weeklyReport = useWeeklyReport();
  const patternAnalysis = usePatternAnalysis();

  const aiAvailable = aiStatus?.available ?? false;
  const quotaExhausted = quota ? quota.used >= quota.limit : false;
  const isGenerating = weeklyReport.isGenerating || patternAnalysis.isGenerating;

  useEffect(() => {
    if (!quota) return;
    const interval = setInterval(() => forceRerender((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, [quota]);

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
            <Badge
              variant="outline"
              className={quotaExhausted ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-blue-300 border-blue-500/30 bg-blue-500/10"}
              data-testid="badge-next-report-countdown"
            >
              {quotaExhausted ? "Weekly limit reached — " : "Next report window: "}
              {formatCountdown(quota.resetsAt)}
            </Badge>
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
          {reports && reports.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {reports.map((report) => (
                <ReportCard key={report.id} report={report} onOpen={setSelectedReport} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedReport !== null} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-report-detail">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  {(() => {
                    const Icon = reportTypeMeta(selectedReport.reportType).icon;
                    return <Icon className="h-4 w-4 text-blue-400 flex-shrink-0" />;
                  })()}
                  <span>{selectedReport.title ?? reportTypeMeta(selectedReport.reportType).label}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground -mt-2">
                <span>{formatDateRange(selectedReport)}</span>
                {selectedReport.totalPnl != null && (
                  <span className={selectedReport.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    P&L: {selectedReport.totalPnl >= 0 ? "+" : ""}${selectedReport.totalPnl.toFixed(2)}
                  </span>
                )}
                {selectedReport.winRate != null && <span>Win Rate: {selectedReport.winRate.toFixed(1)}%</span>}
                {selectedReport.tradeCount != null && <span>{selectedReport.tradeCount} trades</span>}
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}>
                <SafeMarkdown content={selectedReport.content} className="text-sm text-muted-foreground leading-relaxed" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
