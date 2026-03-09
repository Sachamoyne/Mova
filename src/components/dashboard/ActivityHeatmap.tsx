import { useActivityHeatmap } from "@/hooks/useActivities";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function ActivityHeatmap() {
  const { data: counts = {} } = useActivityHeatmap();

  // Build 52 weeks x 7 days grid
  const today = new Date();
  const weeks: { date: string; count: number }[][] = [];

  for (let w = 52; w >= 0; w--) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      const key = date.toISOString().split("T")[0];
      week.push({ date: key, count: counts[key] || 0 });
    }
    weeks.push(week);
  }

  const getColor = (count: number) => {
    if (count === 0) return "bg-secondary";
    if (count === 1) return "bg-primary/30";
    if (count === 2) return "bg-primary/60";
    return "bg-primary";
  };

  return (
    <div className="glass-card p-4">
      <h3 className="font-display font-semibold text-sm mb-3 text-foreground">
        Activité d'entraînement
      </h3>
      <div className="flex gap-[3px] overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => (
              <div
                key={di}
                className={`w-[11px] h-[11px] rounded-sm ${getColor(day.count)}`}
                title={`${day.date}: ${day.count} activité(s)`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <span>Moins</span>
        <div className="w-[11px] h-[11px] rounded-sm bg-secondary" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/30" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/60" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary" />
        <span>Plus</span>
      </div>
    </div>
  );
}
