import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList,
} from 'recharts';
import { ChevronsRight } from 'lucide-react';

const SOURCES = ['Referral', 'Recruiter Sourced', 'Inbound', 'Partner'];
const SOURCE_COLORS = {
  'Referral':          '#1e3a8a',
  'Recruiter Sourced': '#2563eb',
  'Inbound':           '#60a5fa',
  'Partner':           '#93c5fd',
};

const MultiLineTick = ({ x, y, payload }) => {
  const words = payload.value.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-6} y={-8} textAnchor="end" fontSize={12} fontWeight={600} fill="#1f2937">{line1}</text>
      <text x={-6} y={8}  textAnchor="end" fontSize={12} fontWeight={600} fill="#1f2937">{line2}</text>
    </g>
  );
};

export default function RecruitmentProgress({ progress }) {
  if (!progress) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="bg-slate-100 h-56 rounded animate-pulse" />
      </div>
    );
  }

  const leftData = [
    { name: 'All Candidates',        ...progress.all_breakdown },
    { name: 'Progressed Candidates', ...progress.progressed_breakdown },
    { name: 'Offered Candidates',    ...progress.offered_breakdown },
    { name: 'Joined Candidates',     ...progress.joined_breakdown },
  ];

  const rightData = progress.pipeline_stages || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-slate-800 text-lg font-semibold mb-4 text-center">Recruitment Progress</h3>

      <div className="flex items-center gap-2">
        {/* Left: stacked bars by source */}
        <div className="flex-1" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={leftData}
              margin={{ top: 8, right: 8, left: 100, bottom: 8 }}
              barSize={28}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={<MultiLineTick />}
                axisLine={false}
                tickLine={false}
              />
              {SOURCES.map((source) => (
                <Bar key={source} dataKey={source} stackId="a" fill={SOURCE_COLORS[source]} isAnimationActive={false}>
                  <LabelList
                    dataKey={source}
                    position="inside"
                    style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}
                    formatter={(v) => (v > 0 ? v : '')}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Arrow separator */}
        <div className="flex items-center self-center text-blue-500 shrink-0">
          <ChevronsRight className="w-6 h-6" strokeWidth={2.5} />
        </div>

        {/* Right: pipeline stage horizontal bars */}
        <div style={{ width: 260, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={rightData}
              margin={{ top: 8, right: 48, left: 64, bottom: 8 }}
              barSize={20}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={64}
                tick={{ fontSize: 12, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="value"
                  position="right"
                  style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        {SOURCES.map((source) => (
          <div key={source} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SOURCE_COLORS[source] }} />
            <span className="text-xs text-slate-600">{source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
