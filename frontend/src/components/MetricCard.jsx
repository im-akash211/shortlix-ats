import React from 'react';
import { ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function MetricCard({ title, value, trend, trendUp, type, data, valueColor = "text-slate-900", barColor = "#3b82f6", onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-[280px] ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${valueColor}`}>{value}</span>
          <span className="text-slate-900 text-lg font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold tracking-wide">
          {trendUp === true && <ArrowUp className="w-4 h-4 text-emerald-500" strokeWidth={3} />}
          {trendUp === false && <ArrowDown className="w-4 h-4 text-rose-500" strokeWidth={3} />}
          {trendUp === null && <HelpCircle className="w-4 h-4 text-slate-400" />}
          <span className="text-slate-600 uppercase">
            {trend}
          </span>
        </div>
      </div>

      <div className="flex-1 mt-6 min-h-0 relative">
        {type === 'empty' ? (
          <div className="w-full h-full flex items-center justify-center">
            {/* Empty state */}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={24}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColor} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Line type="linear" dataKey="value" stroke={barColor} strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
