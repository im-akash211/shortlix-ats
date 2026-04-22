import React from 'react';
import { Mail, Phone, MapPin, Briefcase, User, Clock, FileText } from 'lucide-react';
import { PageLoader } from '../../../components/LoadingDots';
import Modal from './Modal';
import { SOURCE_LABELS, STAGE_COLORS, STAGE_LABELS } from '../constants';

export default function CandidateProfileModal({
  candidateProfile,
  candidateProfileLoading,
  setCandidateProfile,
  setCandidateProfileLoading,
  openResume,
}) {
  return (
    <Modal
      isOpen={candidateProfile !== null || candidateProfileLoading}
      onClose={() => { setCandidateProfile(null); setCandidateProfileLoading(false); }}
      title="Candidate Profile"
      maxWidth="max-w-3xl"
    >
      {candidateProfileLoading ? (
        <PageLoader label="Loading profile…" />
      ) : candidateProfile ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold shrink-0">
              {candidateProfile.full_name?.slice(0, 2).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-slate-800 truncate">{candidateProfile.full_name}</h3>
              {candidateProfile.designation && <p className="text-sm text-slate-600 mt-0.5">{candidateProfile.designation}</p>}
              {candidateProfile.current_employer && <p className="text-xs text-slate-500 mt-0.5">{candidateProfile.current_employer}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {candidateProfile.source && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    {SOURCE_LABELS[candidateProfile.source] || candidateProfile.source}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Added {new Date(candidateProfile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <button
              onClick={() => openResume(candidateProfile)}
              className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Resume
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
            {[
              { icon: <Mail className="w-4 h-4" />,     label: 'Email',      value: candidateProfile.email || '—' },
              { icon: <Phone className="w-4 h-4" />,    label: 'Phone',      value: candidateProfile.phone || '—' },
              { icon: <MapPin className="w-4 h-4" />,   label: 'Location',   value: candidateProfile.location || '—' },
              { icon: <Briefcase className="w-4 h-4" />,label: 'Experience', value: candidateProfile.total_experience_years ? `${candidateProfile.total_experience_years} years` : '—' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
          {candidateProfile.skills?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {candidateProfile.skills.map((s, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}
          {candidateProfile.job_mappings?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Job Applications ({candidateProfile.job_mappings.length})</p>
              <div className="flex flex-col gap-2">
                {candidateProfile.job_mappings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.job_title}</p>
                      <p className="text-xs text-slate-500">{m.job_code}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3 ${STAGE_COLORS[m.macro_stage] || 'bg-slate-100 text-slate-600'}`}>
                      {STAGE_LABELS[m.macro_stage] || m.macro_stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {candidateProfile.notes?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Notes ({candidateProfile.notes.length})</p>
              <div className="flex flex-col gap-2">
                {candidateProfile.notes.map((n) => (
                  <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-slate-700 leading-relaxed">{n.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <User className="w-3 h-3" />
                      <span>{n.user_name}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
