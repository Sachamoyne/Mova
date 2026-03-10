import { useWeeklySportSummary } from "@/hooks/useHealthData";
import { Timer } from "lucide-react";

const sportColors: Record<string, string> = {
  running: "bg-running/20 text-running",
  cycling: "bg-cycling/20 text-cycling",
  swimming: "bg-swimming/20 text-swimming",
  tennis: "bg-tennis/20 text-tennis",
  padel: "bg-padel/20 text-padel",
  strength: "bg-strength/20 text-strength",
};

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
}

export function WeeklySummary() {
  const { data: summary, isLoading } = useWeeklySportSummary();

  const totalMinutes = summary.reduce((s, item) => s + item.totalMinutes, 0);
  const totalSessions = summary.reduce((s, item) => s + item.sessions, 0);

  if (isLoading) return null;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-foreground">
          Ma semaine sportive
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" />
          {formatMinutes(totalMinutes)} · {totalSessions} séances
        </div>
      </div>

      {summary.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">
          Aucune activité cette semaine
        </p>
      ) : (
        <div className="space-y-2">
          {summary.map((item) => {
            const pct = totalMinutes > 0 ? (item.totalMinutes / totalMinutes) * 100 : 0;
            return (
              <div key={item.sport} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={`sport-badge ${sportColors[item.sport] || ""}`}>
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMinutes(item.totalMinutes)} · {item.sessions}x
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
