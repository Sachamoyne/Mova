import { useActivities } from "@/hooks/useHealthData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfWeek, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MapPin, Mountain, Timer, Heart } from "lucide-react";

export default function Running() {
  const { data: runs = [] } = useActivities("running");

  const totalDist = runs.reduce((s, r) => s + (r.distance_meters || 0), 0);
  const totalElev = runs.reduce((s, r) => s + (r.total_elevation_gain || 0), 0);

  // Weekly distances
  const weeklyMap: Record<string, number> = {};
  runs.forEach((r) => {
    const week = format(startOfWeek(parseISO(r.start_time), { weekStartsOn: 1 }), "dd/MM");
    weeklyMap[week] = (weeklyMap[week] || 0) + (r.distance_meters || 0) / 1000;
  });
  const weeklyData = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, km]) => ({ week, km: Math.round(km * 10) / 10 }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Running</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-running" />
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{(totalDist / 1000).toFixed(0)} km</p>
            <p className="text-xs text-muted-foreground">Distance totale</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <Mountain className="h-5 w-5 text-running" />
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{totalElev.toFixed(0)} m</p>
            <p className="text-xs text-muted-foreground">Dénivelé total</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-display font-semibold mb-4 text-foreground">Distance par semaine</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="week" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} unit=" km" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 22%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Bar dataKey="km" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-4 overflow-x-auto">
        <h3 className="font-display font-semibold mb-3 text-foreground">Sorties</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 px-3">Date</th>
              <th className="text-right py-2 px-3">Distance</th>
              <th className="text-right py-2 px-3">Allure</th>
              <th className="text-right py-2 px-3">FC Moy.</th>
              <th className="text-right py-2 px-3">Durée</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 20).map((r) => {
              const distKm = (r.distance_meters || 0) / 1000;
              const paceMin = distKm > 0 ? r.duration_sec / 60 / distKm : 0;
              const paceMinutes = Math.floor(paceMin);
              const paceSec = Math.round((paceMin - paceMinutes) * 60);

              return (
                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="py-2 px-3 text-foreground">
                    {format(new Date(r.start_time), "d MMM yyyy", { locale: fr })}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">{distKm.toFixed(1)} km</td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {paceMinutes}:{paceSec.toString().padStart(2, "0")} /km
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">{r.avg_hr ?? "—"} bpm</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">
                    {Math.round(r.duration_sec / 60)} min
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
