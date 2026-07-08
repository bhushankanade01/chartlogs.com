import { useEffect, useState } from "react";
import {
  useGetAiStatus,
  useGetAiQuota,
  useListAiReports,
  useGetPatternAnalysis,
  useGeneratePatternAnalysis,
  useGetPerformance,
  getGetAiQuotaQueryKey,
  getGetPatternAnalysisQueryKey,
  getListAiReportsQueryKey,
  getGetPerformanceQueryKey,
  AiReport as AiReportType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWeeklyReport } from "@/hooks/useAI";
import { useAccount } from "@/contexts/AccountContext";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles, Lock, FileText, TrendingUp, Clock, ArrowUpRight, ArrowDownRight, Target,
  Bot, AlertTriangle, DollarSign, Activity, Zap, ChevronRight, Infinity as InfinityIcon,
} from "lucide-react";

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
      className="text-left rounded-lg p-4 space-y-3 transition-colors hover-elevate bg-muted/30 border border-border"
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

interface PatternInsight {
  blindspots: {
    title: string;
    severity: "warning" | "critical";
    explanation: string;
    evidence: string;
    tip: string;
  }[];
  worstTrades: {
    symbol: string;
    direction: string;
    date: string;
    pnl: string;
    whatWentWrong: string;
    lesson: string;
  }[];
  actionPlan: {
    title: string;
    why: string;
    measure: string;
  }[];
}

function parseInsight(content: string): PatternInsight | null {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.blindspots)) return parsed as PatternInsight;
    return null;
  } catch {
    return null;
  }
}

function AiStatCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function PatternInsightsSection({
  aiAvailable,
  quotaExhausted,
  unlimited,
}: {
  aiAvailable: boolean;
  quotaExhausted: boolean;
  unlimited: boolean;
}) {
  const queryClient = useQueryClient();
  const { activeAccountId } = useAccount();
  const acctParam = activeAccountId ?? undefined;
  const { data: latestReport, isLoading } = useGetPatternAnalysis({
    query: { queryKey: getGetPatternAnalysisQueryKey() },
  });
  const { data: perf } = useGetPerformance(
    { period: "all" as const, accountId: acctParam },
    { query: { queryKey: getGetPerformanceQueryKey({ period: "all", accountId: acctParam }) } }
  );

  const patternMutation = useGeneratePatternAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPatternAnalysisQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAiReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAiQuotaQueryKey() });
      },
    },
  });

  const insight = latestReport ? parseInsight(latestReport.content) : null;
  const canAnalyze = aiAvailable && (unlimited || !quotaExhausted);

  const pnlColor = (perf?.totalPnl ?? 0) >= 0 ? "#22c55e" : "#ef4444";
  const pnlStr = perf
    ? `${perf.totalPnl >= 0 ? "+" : ""}${formatMoney(perf.totalPnl)}`
    : "—";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-blue-400" />
            AI Pattern Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            {!aiAvailable && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Add ANTHROPIC_API_KEY to enable
              </div>
            )}
            {!latestReport && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1.5"
                disabled={!canAnalyze || patternMutation.isPending}
                onClick={() => patternMutation.mutate()}
              >
                {patternMutation.isPending ? (
                  <><Spinner className="h-3 w-3" /> Analyzing…</>
                ) : (
                  <><TrendingUp className="h-3 w-3" /> Analyze Patterns</>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {aiAvailable && !unlimited && quotaExhausted && !latestReport && (
          <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            You've used your weekly AI report quota. Try again after it resets.
          </p>
        )}

        {patternMutation.isError && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {(patternMutation.error as Error | null)?.message ?? "Analysis failed"}
          </p>
        )}

        {perf && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AiStatCard icon={DollarSign} label="Total P&L" value={pnlStr} color={pnlColor} />
            <AiStatCard icon={Activity} label="Total Trades" value={String(perf.totalTrades)} color="#60a5fa" />
            <AiStatCard icon={Target} label="Win Rate" value={`${perf.winRate.toFixed(1)}%`}
              color={perf.winRate >= 50 ? "#22c55e" : "#ef4444"} />
            <AiStatCard icon={Zap} label="Profit Factor" value={perf.profitFactor.toFixed(2)}
              color={perf.profitFactor >= 1.5 ? "#22c55e" : perf.profitFactor >= 1 ? "#f59e0b" : "#ef4444"} />
          </div>
        )}

        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

        {!isLoading && insight ? (
          <div className="space-y-6">
            {insight.blindspots.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" /> Your Blindspots
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {insight.blindspots.map((b, i) => {
                    const isCrit = b.severity === "critical";
                    const borderColor = isCrit ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)";
                    const bgColor    = isCrit ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)";
                    const badgeColor = isCrit ? "#ef4444" : "#f59e0b";
                    const badgeBg    = isCrit ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)";
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-4 space-y-2.5"
                        style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground/95 leading-tight">{b.title}</p>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide"
                            style={{ color: badgeColor, backgroundColor: badgeBg }}
                          >
                            {isCrit ? "CRITICAL" : "WARNING"}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/70 leading-relaxed">{b.explanation}</p>
                        <p className="text-[11px] font-mono" style={{ color: badgeColor }}>{b.evidence}</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: "#34d399" }}>
                          <ChevronRight className="h-3 w-3 inline -mt-0.5 mr-0.5" />
                          {b.tip}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {insight.worstTrades.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your Worst Trades
                </p>
                <div className="space-y-2.5">
                  {insight.worstTrades.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-4 space-y-2 bg-muted/30 border border-border"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                        >
                          #{i + 1}
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground">{t.symbol}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                          style={{
                            backgroundColor: t.direction === "LONG" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                            color: t.direction === "LONG" ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {t.direction}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.date}</span>
                        <span className="ml-auto text-sm font-bold font-mono" style={{ color: "#ef4444" }}>{t.pnl}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">What went wrong</p>
                        <p className="text-xs text-foreground/75 leading-relaxed">{t.whatWentWrong}</p>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" style={{ color: "#34d399" }} />
                        <p className="text-[11px] leading-relaxed" style={{ color: "#34d399" }}>{t.lesson}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insight.actionPlan.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Your Action Plan
                </p>
                <div className="space-y-2.5">
                  {insight.actionPlan.map((a, i) => (
                    <div key={i} className="rounded-xl p-4 flex gap-4 bg-muted/30 border border-border">
                      <span
                        className="text-base font-black font-mono shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
                      >
                        {i + 1}
                      </span>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-bold text-foreground">{a.title}</p>
                        <p className="text-xs text-foreground/65 leading-relaxed">{a.why}</p>
                        <p className="text-[11px]" style={{ color: "#34d399" }}>
                          Measure: {a.measure}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latestReport && (
              <p className="text-[11px] text-muted-foreground/40 text-right">
                Last analyzed {new Date(latestReport.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : !isLoading && latestReport ? (
          <div className="space-y-3">
            <SafeMarkdown content={latestReport.content} className="text-xs text-muted-foreground leading-relaxed" />
            <p className="text-[11px] text-yellow-500/70">Future analyses will use the new visual format automatically.</p>
          </div>
        ) : !isLoading && (
          <div className="text-center py-10 space-y-3">
            <Bot className="h-10 w-10 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {aiAvailable
                ? "Run a pattern analysis to get personalized coaching based on your actual trade data."
                : "Configure your ANTHROPIC_API_KEY secret to unlock AI-powered pattern analysis."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
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

  const aiAvailable = aiStatus?.available ?? false;
  const unlimited = quota?.unlimited ?? false;
  const quotaExhausted = quota ? quota.used >= quota.limit : false;
  const isGenerating = weeklyReport.isGenerating;

  useEffect(() => {
    if (!quota) return;
    const interval = setInterval(() => forceRerender((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, [quota]);

  const handleGenerateWeekly = () => {
    weeklyReport.generate();
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
        <Card>
          <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  unlimited ? "bg-emerald-500/10" : quotaExhausted ? "bg-red-500/10" : "bg-blue-500/10"
                }`}
              >
                {unlimited ? (
                  <InfinityIcon className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Clock className={`h-4 w-4 ${quotaExhausted ? "text-red-400" : "text-blue-400"}`} />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {unlimited ? "Unlimited AI reports" : `${quota.used} / ${quota.limit} reports used this week`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {unlimited ? "Admin accounts have no weekly limit" : `Resets ${formatResetDate(quota.resetsAt)}`}
                </p>
              </div>
            </div>
            {!unlimited && (
              <Badge
                variant="outline"
                className={quotaExhausted ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-blue-300 border-blue-500/30 bg-blue-500/10"}
                data-testid="badge-next-report-countdown"
              >
                {quotaExhausted ? "Weekly limit reached — " : "Next report window: "}
                {formatCountdown(quota.resetsAt)}
              </Badge>
            )}
            {unlimited && (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                Admin — no limit
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
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
            disabled={!aiAvailable || (!unlimited && quotaExhausted) || isGenerating}
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
            <div className="rounded-lg p-3 mt-2 bg-muted/30 border border-border">
              <SafeMarkdown content={weeklyReport.report.content} className="text-xs text-muted-foreground leading-relaxed" />
            </div>
          )}
        </CardContent>
      </Card>

      <PatternInsightsSection aiAvailable={aiAvailable} quotaExhausted={quotaExhausted} unlimited={unlimited} />

      <Card>
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
              <div className="rounded-lg p-4 bg-muted/30 border border-border">
                <SafeMarkdown content={selectedReport.content} className="text-sm text-muted-foreground leading-relaxed" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
