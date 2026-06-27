import { useState, useMemo } from "react";
import {
  useGetMarketCalendar,
  getGetMarketCalendarQueryKey,
  GetMarketCalendarPeriod,
  EconomicEvent,
} from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  GB: "🇬🇧",
  JP: "🇯🇵",
  CA: "🇨🇦",
  AU: "🇦🇺",
  NZ: "🇳🇿",
  CH: "🇨🇭",
  CN: "🇨🇳",
  DE: "🇩🇪",
  FR: "🇫🇷",
};

const IMPACT_CONFIG: Record<string, { label: string; border: string; badge: string; dot: string }> = {
  high: {
    label: "High",
    border: "border-l-red-500",
    badge: "bg-red-500/15 text-red-400 border border-red-500/25",
    dot: "bg-red-500",
  },
  medium: {
    label: "Medium",
    border: "border-l-yellow-500",
    badge: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25",
    dot: "bg-yellow-500",
  },
  low: {
    label: "Low",
    border: "border-l-blue-500",
    badge: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    dot: "bg-blue-500",
  },
};

const PERIOD_LABELS: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  all: "All",
};

type ImpactFilter = "all" | "high" | "medium" | "low";

function formatIsoTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatDayHeader(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function getDateKey(iso: string) {
  try {
    return iso.slice(0, 10); // "2026-05-20"
  } catch {
    return iso;
  }
}

function EventCard({ ev }: { ev: EconomicEvent }) {
  const cfg = IMPACT_CONFIG[ev.impact] ?? IMPACT_CONFIG.low!;
  const flag = COUNTRY_FLAGS[ev.country] ?? "🌐";

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border-l-[3px] bg-card border border-border/60 hover:border-primary/20 hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-200 ${cfg.border}`}
    >
      <div className="text-xs font-mono text-muted-foreground w-12 flex-shrink-0 pt-0.5">
        {formatIsoTime(ev.time)}
      </div>

      <div className="text-lg flex-shrink-0 leading-none pt-0.5">{flag}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-foreground">{ev.event}</span>
          <span className="text-xs text-muted-foreground font-mono">{ev.currency}</span>
        </div>
        {(ev.forecast != null || ev.previous != null || ev.actual != null) && (
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {ev.forecast != null && (
              <span className="text-muted-foreground">
                Forecast: <span className="text-foreground">{ev.forecast}</span>
              </span>
            )}
            {ev.previous != null && (
              <span className="text-muted-foreground">
                Prev: <span className="text-foreground">{ev.previous}</span>
              </span>
            )}
            {ev.actual != null && (
              <span
                className={
                  parseFloat(ev.actual) > parseFloat(ev.forecast ?? "0")
                    ? "text-emerald-400 font-semibold"
                    : "text-red-400 font-semibold"
                }
              >
                Actual: {ev.actual}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 pt-0.5">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

export default function Market() {
  const [period, setPeriod] = useState<GetMarketCalendarPeriod>("this_week");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");

  const { data: events, isLoading } = useGetMarketCalendar(
    { period },
    { query: { queryKey: getGetMarketCalendarQueryKey({ period }) } }
  );

  const filtered = useMemo(() => {
    const list = events ?? [];
    if (impactFilter === "all") return list;
    return list.filter((ev) => ev.impact === impactFilter);
  }, [events, impactFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const ev of filtered) {
      const key = getDateKey(ev.time);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const impactButtons: { key: ImpactFilter; label: string; dot: string }[] = [
    { key: "all", label: "All Events", dot: "bg-muted-foreground" },
    { key: "high", label: "High", dot: "bg-red-500" },
    { key: "medium", label: "Medium", dot: "bg-yellow-500" },
    { key: "low", label: "Low", dot: "bg-blue-500" },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upcoming economic events and news releases
          </p>
        </div>
        <Select value={period} onValueChange={(v: GetMarketCalendarPeriod) => setPeriod(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="tomorrow">Tomorrow</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {impactButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setImpactFilter(btn.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              impactFilter === btn.key
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted/40 text-muted-foreground border border-border hover:bg-muted/70 hover:text-foreground"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${btn.dot}`} />
            {btn.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-40 bg-muted/40 rounded animate-pulse" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : grouped.length > 0 ? (
        <div className="space-y-8">
          {grouped.map(([dateKey, dayEvents]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
                <h2 className="text-sm font-semibold text-foreground">{formatDayHeader(dateKey)}</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {dayEvents.map((ev, i) => (
                  <div
                    key={`${ev.id}-${i}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="animate-fade-in"
                  >
                    <EventCard ev={ev} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center mb-4">
            <CalendarDays className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">
            No {impactFilter !== "all" ? impactFilter + " impact " : ""}events for {PERIOD_LABELS[period]}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Economic calendar events will appear here when available.
          </p>
        </div>
      )}
    </div>
  );
}
