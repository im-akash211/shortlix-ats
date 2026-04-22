import React from 'react';
import { Mail, Phone, MapPin, Briefcase, Clock, FileText, MessageSquarePlus, Edit, Trash2, User } from 'lucide-react';
import Modal from './Modal';
import { PageLoader } from '../../../components/LoadingDots';
import { SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS } from '../constants';

export default function ViewProfileModal({ isOpen, onClose, profileLoading, profileDetail, user, openResume, openModal, openDeleteConfirm }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Candidate Profile" maxWidth="max-w-3xl">
      {profileLoading ? (
        <PageLoader label="Loading profile…" />
      ) : profileDetail ? (
        <div className="flex flex-col gap-6">

          {/* Hero header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold shrink-0">
              {profileDetail.full_name?.slice(0, 2).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-slate-800 truncate">{profileDetail.full_name}</h3>
              {profileDetail.designation && (
                <p className="text-sm text-slate-600 mt-0.5">{profileDetail.designation}</p>
              )}
              {profileDetail.current_employer && (
                <p className="text-xs text-slate-500 mt-0.5">{profileDetail.current_employer}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {profileDetail.source && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                    {SOURCE_LABELS[profileDetail.source] || profileDetail.source}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Added {new Date(profileDetail.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <button
              onClick={() => openResume(profileDetail)}
              className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Resume
            </button>
          </div>

          {/* Contact + Professional info grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
            {[
              { icon: <Mail className="w-4 h-4" />,     label: 'Email',      value: profileDetail.email || '—' },
              { icon: <Phone className="w-4 h-4" />,    label: 'Phone',      value: profileDetail.phone || '—' },
              { icon: <MapPin className="w-4 h-4" />,   label: 'Location',   value: profileDetail.location || '—' },
              { icon: <Briefcase className="w-4 h-4" />,label: 'Experience', value: profileDetail.total_experience_years ? `${profileDetail.total_experience_years} years` : '—' },
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

          {/* CTC + Notice Period (admin/recruiter only) */}
          {(user?.role === 'admin' || user?.role === 'recruiter') && (profileDetail?.current_ctc_lakhs != null || profileDetail?.notice_period_days != null) && (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl px-4 py-3">
              {profileDetail?.current_ctc_lakhs != null && (
                <div className="flex items-start gap-2.5">
                  <span className="text-slate-400 mt-0.5 shrink-0"><Briefcase className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Current CTC</p>
                    <p className="text-sm font-medium text-slate-800">₹{profileDetail.current_ctc_lakhs} L</p>
                  </div>
                </div>
              )}
              {profileDetail?.notice_period_days != null && (
                <div className="flex items-start gap-2.5">
                  <span className="text-slate-400 mt-0.5 shrink-0"><Clock className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Notice Period</p>
                    <p className="text-sm font-medium text-slate-800">{profileDetail.notice_period_days} days</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skills */}
          {profileDetail.skills?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {profileDetail.skills.map((s, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job Applications */}
          {profileDetail.job_mappings?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Job Applications ({profileDetail.job_mappings.length})
              </p>
              <div className="flex flex-col gap-2">
                {profileDetail.job_mappings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.job_title}</p>
                      <p className="text-xs text-slate-500">{m.job_code}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3 ${STAGE_COLORS[m.stage] || 'bg-slate-100 text-slate-600'}`}>
                      {STAGE_LABELS[m.stage] || m.stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {profileDetail.notes?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Notes ({profileDetail.notes.length})
              </p>
              <div className="flex flex-col gap-2">
                {profileDetail.notes.map((n) => (
                  <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-slate-700 leading-relaxed">{n.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <User className="w-3 h-3" />
                      <span>{n.user_name}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => { onClose(); openModal('note', profileDetail); }}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" /> Add Note
            </button>
            <button
              onClick={() => { onClose(); openModal('edit', profileDetail); }}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Edit className="w-4 h-4" /> Edit Profile
            </button>
            <button
              onClick={() => { onClose(); openDeleteConfirm(profileDetail); }}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
