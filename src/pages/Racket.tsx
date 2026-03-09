import { useActivities } from "@/hooks/useActivities";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Timer, Heart } from "lucide-react";

type Filter = "all" | "tennis" | "padel";

export default function Racket() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: activities = [] } = useActivities(filter === "all" ? ["tennis", "padel"] : filter);

  const chartData = activities.map((a) => ({
    duration: Math.round(a.duration_sec / 60),
    hr: a.avg_hr || 0,
    sport: a.sport_type,
  }));

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "tennis", label: "Tennis" },
    { value: "padel", label: "Padel" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Sports de Raquette</h1>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-display font-semibold mb-4 text-foreground">Charge cardiaque : Durée vs FC Moyenne</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="duration" name="Durée" unit=" min" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis dataKey="hr" name="FC" unit=" bpm" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 22%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Scatter
                data={chartData.filter((d) => d.sport === "tennis")}
                fill="hsl(48, 96%, 53%)"
                name="Tennis"
              />
              <Scatter
                data={chartData.filter((d) => d.sport === "padel")}
                fill="hsl(340, 82%, 52%)"
                name="Padel"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activities.slice(0, 6).map((a) => (
          <div key={a.id} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span
                className={`sport-badge ${
                  a.sport_type === "tennis" ? "bg-tennis/20 text-tennis" : "bg-padel/20 text-padel"
                }`}
              >
                {a.sport_type === "tennis" ? "Tennis" : "Padel"}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(a.start_time), "d MMM yyyy", { locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-foreground">
              <span className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                {Math.round(a.duration_sec / 60)} min
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                {a.avg_hr ?? "—"} bpm
              </span>
              <span className="text-muted-foreground">{a.calories ?? "—"} kcal</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
