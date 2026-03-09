import { useActivities } from "@/hooks/useActivities";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dumbbell, Timer, Flame } from "lucide-react";

export default function Strength() {
  const { data: sessions = [] } = useActivities("strength");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Musculation</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-3xl font-display font-bold text-strength">{sessions.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Séances</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-3xl font-display font-bold text-foreground">
            {Math.round(sessions.reduce((s, a) => s + a.duration_sec, 0) / 3600)}h
          </p>
          <p className="text-xs text-muted-foreground mt-1">Temps total</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-3xl font-display font-bold text-running">
            {sessions.reduce((s, a) => s + (a.calories || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Calories brûlées</p>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.slice(0, 15).map((s) => (
          <div key={s.id} className="glass-card p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-strength/20 flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-strength" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {format(new Date(s.start_time), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" />
                {Math.round(s.duration_sec / 60)} min
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                {s.calories ?? "—"} kcal
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
