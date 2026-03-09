import { useActivities } from "@/hooks/useActivities";
import { Timer, MapPin, Heart } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const sportLabels: Record<string, string> = {
  running: "Course", cycling: "Vélo", swimming: "Natation",
  tennis: "Tennis", padel: "Padel", strength: "Musculation",
};
const sportColors: Record<string, string> = {
  running: "bg-running/20 text-running",
  cycling: "bg-cycling/20 text-cycling",
  swimming: "bg-swimming/20 text-swimming",
  tennis: "bg-tennis/20 text-tennis",
  padel: "bg-padel/20 text-padel",
  strength: "bg-strength/20 text-strength",
};

export function RecentActivities() {
  const { data: activities = [] } = useActivities(undefined, 3);

  return (
    <div className="glass-card p-4">
      <h3 className="font-display font-semibold text-sm mb-3 text-foreground">Activités récentes</h3>
      <div className="space-y-3">
        {activities.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
            <span className={`sport-badge ${sportColors[a.sport_type] || ""}`}>
              {sportLabels[a.sport_type] || a.sport_type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {format(new Date(a.start_time), "d MMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {Math.round(a.duration_sec / 60)}min
              </span>
              {a.distance_meters && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {(a.distance_meters / 1000).toFixed(1)}km
                </span>
              )}
              {a.avg_hr && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {a.avg_hr}bpm
                </span>
              )}
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune activité. Ajoutez des données de test.
          </p>
        )}
      </div>
    </div>
  );
}
