import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { RiskDistribution } from '../../types/api';

interface RiskDistributionChartProps {
  distribution: RiskDistribution;
}

export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({ distribution }) => {
  const data = [
    { name: 'Critical', value: distribution.critical, color: '#e11d48' },
    { name: 'High', value: distribution.high, color: '#ea580c' },
    { name: 'Medium', value: distribution.medium, color: '#d97706' },
    { name: 'Low', value: distribution.low, color: '#16a34a' },
  ].filter((item) => item.value > 0);

  const total = distribution.critical + distribution.high + distribution.medium + distribution.low;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
      <div className="h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={32}
              outerRadius={48}
              paddingAngle={3}
              dataKey="value"
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#1e293b',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                color: '#ffffff',
                padding: '4px 8px',
              }}
              formatter={(val: any) => [`${val} Units`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Clean Minimal Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 font-sans">{item.name}:</span>
            <span className="font-bold text-slate-900">{item.value}</span>
            <span className="text-[10px] text-slate-400">
              ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
