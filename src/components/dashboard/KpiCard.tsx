import { LineChart, Line, ResponsiveContainer } from "recharts";

interface KpiCardProps {
  label: string;
  value: number | string;
  unit: string;
  trend: number[];
  color: string;
  icon: React.ReactNode;
}

export function KpiCard({ label, value, unit, trend, color, icon }: KpiCardProps) {
  const chartData = trend.map((v, i) => ({ v, i }));

  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {icon}
          {label}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-display font-bold" style={{ color }}>
            {typeof value === "number" ? Math.round(value) : value}
          </span>
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </div>
        <div className="w-20 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
