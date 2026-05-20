import { useState } from "react";
import {
  useGetMarketCalendar,
  getGetMarketCalendarQueryKey,
  GetMarketCalendarPeriod,
  EconomicEvent,
} from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

const IMPACT_COLOR: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const IMPACT_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

const PERIOD_LABELS: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  all: "All",
};

function formatEventTime(timeStr: string) {
  return timeStr;
}

export default function Market() {
  const [period, setPeriod] = useState<GetMarketCalendarPeriod>("this_week");

  const { data: events, isLoading } = useGetMarketCalendar(
    { period },
    { query: { queryKey: getGetMarketCalendarQueryKey({ period }) } }
  );

  const list = events ?? [];

  const grouped = list.reduce<Record<string, EconomicEvent[]>>((acc, ev) => {
    const key = ev.country || ev.currency;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
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

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> High Impact
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Low
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : list.length > 0 ? (
        <div className="space-y-3">
          {list.map((ev, i) => (
            <Card key={`${ev.id}-${i}`} className="border-border/60">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  <div className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">
                    {formatEventTime(ev.time)}
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${IMPACT_DOT[ev.impact] ?? "bg-gray-500"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ev.event}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {ev.currency}
                      </Badge>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                        {ev.country}
                      </Badge>
                    </div>
                    {(ev.forecast != null || ev.previous != null) && (
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground font-mono">
                        {ev.forecast != null && <span>Forecast: {ev.forecast}</span>}
                        {ev.previous != null && <span>Previous: {ev.previous}</span>}
                        {ev.actual != null && (
                          <span className={parseFloat(ev.actual) > parseFloat(ev.forecast ?? "0") ? "text-emerald-400" : "text-red-400"}>
                            Actual: {ev.actual}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs flex-shrink-0 capitalize ${IMPACT_COLOR[ev.impact] ?? ""}`}
                  >
                    {ev.impact}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No events for {PERIOD_LABELS[period]}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Economic calendar events will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
