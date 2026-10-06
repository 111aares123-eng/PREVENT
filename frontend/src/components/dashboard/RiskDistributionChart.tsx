import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { RiskDistribution } from '../../types/api';

interface RiskDistributionChartProps {
  distribution: RiskDistribution;
}

export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({ distribution }) => {
  const data = [
    { name: 'Critical Risk', value: distribution.critical, color: '#dc2626' },
    { name: 'High Risk', value: distribution.high, color: '#ea580c' },
    { name: 'Medium Risk', value: distribution.medium, color: '#d97706' },
    { name: 'Low Risk', value: distribution.low, color: '#16a34a' },
  ].filter((item) => item.value > 0);

  const total = distribution.critical + distribution.high + distribution.medium + distribution.low;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4.5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          FLEET RISK PROFILE
        </h3>
        <span className="text-xs font-mono text-slate-500">{total} assets</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 my-auto">
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={36}
                outerRadius={56}
                paddingAngle={4}
                dataKey="value"
                stroke="#0b0f19"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderColor: '#374151',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: '#fff',
                }}
                formatter={(val: any) => [`${val} Assets`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between py-0.5">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
              High Risk
            </span>
            <span className="font-mono font-semibold text-orange-400">{distribution.high}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              Medium Risk
            </span>
            <span className="font-mono font-semibold text-amber-400">{distribution.medium}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              Low Risk
            </span>
            <span className="font-mono font-semibold text-emerald-400">{distribution.low}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
