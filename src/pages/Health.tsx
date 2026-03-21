import { useHealthMetrics } from "@/hooks/useHealthData";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export default function Health() {
  const { data: metrics = [] } = useHealthMetrics(30);

  // Group by date
  const byDate: Record<string, Record<string, number>> = {};
  metrics.forEach((m) => {
    if (!byDate[m.date]) byDate[m.date] = {};
    byDate[m.date][m.metric_type] = m.value;
  });

  const chartData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: format(parseLocalDate(date), "dd/MM"),
      hrv: vals.hrv,
      sleep_score: vals.sleep_score,
      rhr: vals.rhr,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Santé</h1>

      <div className="glass-card p-6">
        <h3 className="font-display font-semibold mb-4 text-foreground">HRV & Sommeil — 30 derniers jours</h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 10%)",
                  border: "1px solid hsl(220, 14%, 22%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="hrv" name="HRV" stroke="hsl(152, 60%, 48%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sleep_score" name="Sommeil" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rhr" name="FC Repos" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-4 overflow-x-auto">
        <h3 className="font-display font-semibold mb-3 text-foreground">Historique</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 px-3">Date</th>
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-right py-2 px-3">Valeur</th>
              <th className="text-right py-2 px-3">Unité</th>
            </tr>
          </thead>
          <tbody>
            {metrics.slice(0, 50).map((m) => (
              <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="py-2 px-3 text-foreground">{format(parseLocalDate(m.date), "dd/MM/yyyy")}</td>
                <td className="py-2 px-3 text-foreground uppercase text-xs font-medium">{m.metric_type}</td>
                <td className="py-2 px-3 text-right text-foreground">{m.value.toFixed(1)}</td>
                <td className="py-2 px-3 text-right text-muted-foreground">{m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
