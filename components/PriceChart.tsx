import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PricePoint = {
  timestamp: number;
  totalCents: number;
};

type PriceChartProps = {
  data: PricePoint[];
  mean90?: number;
  min90?: number;
};

const formatCurrency = (value: number) =>
  `$${(value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function PriceChart({ data, mean90, min90 }: PriceChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No price history yet. Add the item to start tracking.
        </p>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString(),
    total: point.totalCents,
    mean: mean90 ?? null,
    min: min90 ?? null,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9333EA" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelClassName="text-sm font-medium text-slate-600 dark:text-slate-300"
            contentStyle={{
              borderRadius: "0.75rem",
              borderColor: "#E2E8F0",
              background: "#FFF",
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="url(#colorTotal)"
          />
          {mean90 && (
            <Area
              type="monotone"
              dataKey="mean"
              stroke="#94a3b8"
              strokeDasharray="4 4"
              fillOpacity={0}
            />
          )}
          {min90 && (
            <Area
              type="monotone"
              dataKey="min"
              stroke="#10b981"
              strokeDasharray="6 6"
              fillOpacity={0}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
