import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Eye, Users, User, Building2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { ROUTES } from '../../../routes/constants';

export default function JobCard({ job, onView, onOpenPipeline, onCollaborators }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between shadow-sm hover:shadow-md transition-shadow gap-4">
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onView(job)}
            className="text-base font-bold text-slate-800 hover:text-blue-600 text-left transition-colors"
          >
            {job.title}
          </button>
          <StatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
          {job.department_name && (
            <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {job.department_name}</span>
          )}
          {job.hiring_manager_name && (
            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {job.hiring_manager_name}</span>
          )}
          {job.job_code && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${job.job_code.startsWith('SHT-CLT') ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
              {job.job_code}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-blue-600">
          <button onClick={() => onView(job)} className="flex items-center gap-1 hover:text-blue-800">
            <Eye className="w-3.5 h-3.5" /> View
          </button>
<button onClick={() => onCollaborators(job)} className="flex items-center gap-1 hover:text-blue-800">
            <Users className="w-3.5 h-3.5" /> Collaborators
          </button>
        </div>
      </div>

      {/* Stat tiles — clicking opens detail page + pipeline panel */}
      <div className="flex gap-1 items-center shrink-0">
        {[
          { label: 'Applied',     value: job.applies_count,     stage: 'applied' },
          { label: 'Shortlisted', value: job.shortlists_count,  stage: 'shortlisted' },
          { label: 'Interview',   value: job.interviews_count,  stage: 'interview' },
          { label: 'Offered',     value: job.offers_count,      stage: 'offered' },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => navigate(ROUTES.JOBS.PIPELINE(job.id, stat.stage))}
            className="flex flex-col items-center min-w-[60px] hover:bg-blue-50 p-2 rounded-lg transition-colors"
          >
            <span className="text-xl font-bold text-slate-700">{stat.value ?? 0}</span>
            <span className="text-xs text-blue-600 font-medium">{stat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
