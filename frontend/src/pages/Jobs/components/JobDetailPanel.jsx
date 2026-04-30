import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Eye, UserPlus, Users, ChevronRight, Edit2, Trash2, BookOpen, Download, Upload, ChevronDown } from 'lucide-react';
import { jobsApi } from '../services/jobsApi';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes/constants';
import { useAuth } from '../../../lib/authContext';
import { PageLoader } from '../../../components/LoadingDots';
import StatusBadge from './StatusBadge';
import InfoRow from './InfoRow';

const EMPLOYMENT_TYPE_LABELS = { permanent: 'Permanent', contract: 'Contract', internship: 'Internship' };
const WORK_MODE_LABELS        = { hybrid: 'Hybrid', remote: 'Remote', office: 'Office' };
const REQUISITION_TYPE_LABELS = { new: 'New', backfill: 'Backfill' };
const PRIORITY_LABELS         = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

function SectionHeader({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4 pb-1 border-b border-slate-100 mb-1">
      {children}
    </p>
  );
}

export default function JobDetailPanel({
  viewingJob,
  jobDetail,
  jobDetailLoading,
  allCandidates,
  allCandidatesLoading,
  getStatCount,
  setPipelineTab,
  openEdit,
  setIsDeleteJobOpen,
  openCollabModal,
  onUploadResume,
  onApplyFromPool,
  canUploadResume,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addDropdownRef = useRef(null);

  useEffect(() => {
    if (!addDropdownOpen) return;
    const handler = (e) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target)) setAddDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addDropdownOpen]);

  const canSeeBudget = user?.role === 'admin' || user?.role === 'recruiter';

  // Helper: only render if value is truthy (non-empty string, non-zero number, non-null)
  const has = (v) => v !== null && v !== undefined && v !== '' && v !== 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(ROUTES.JOBS.ROOT)} className="text-slate-500 hover:text-slate-800 text-sm transition-colors shrink-0">
            ← Back
          </button>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 shrink-0">Manage Jobs</span>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">View Job</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={openEdit} disabled={!jobDetail}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => setIsDeleteJobOpen(true)} disabled={!jobDetail}
            className="flex items-center gap-1.5 bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-rose-50 disabled:opacity-40 transition-colors shadow-sm">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => viewingJob && openCollabModal(viewingJob)} disabled={!viewingJob}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm">
            <Users className="w-3.5 h-3.5" /> Collaborators
          </button>
          <button disabled={!viewingJob}
            onClick={async () => {
              if (!viewingJob) return;
              const url = jobsApi.reportExcelUrl(viewingJob.id);
              const token = localStorage.getItem('access');
              const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
              const blob = await res.blob();
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `${viewingJob.job_code}_${viewingJob.title}_Report.xlsx`;
              link.click();
              URL.revokeObjectURL(link.href);
            }}
            className="flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-40 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" /> Report
          </button>
          <div className="relative" ref={addDropdownRef}>
            <button onClick={() => setAddDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <UserPlus className="w-3.5 h-3.5" /> Add Candidate
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
            {addDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-[400] overflow-hidden">
                {canUploadResume && onUploadResume && (
                  <button onClick={() => { setAddDropdownOpen(false); onUploadResume(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left">
                    <Upload className="w-4 h-4 shrink-0" />
                    <div><p className="font-medium">Upload Resume</p><p className="text-xs text-slate-400">Parse & add new candidate</p></div>
                  </button>
                )}
                {onApplyFromPool && (
                  <button onClick={() => { setAddDropdownOpen(false); onApplyFromPool(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left border-t border-slate-100">
                    <Users className="w-4 h-4 shrink-0" />
                    <div><p className="font-medium">From Talent Pool</p><p className="text-xs text-slate-400">Apply existing candidate</p></div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column content area */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* LEFT: Job info card */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-2 pb-4">
          {jobDetailLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse space-y-3">
              <div className="h-6 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded" />)}
            </div>
          ) : jobDetail ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
              {/* Card header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-800">
                      #{jobDetail.job_code} | {jobDetail.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {jobDetail.location && (
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <MapPin className="w-3.5 h-3.5" /> {jobDetail.location}
                        </span>
                      )}
                      <StatusBadge status={jobDetail.status} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Details — grouped sections */}
              <div className="px-6 py-4 space-y-0">

                {/* ── Basic Info ── */}
                <SectionHeader>Basic Info</SectionHeader>
                <InfoRow label="Department">{jobDetail.department_name || '—'}</InfoRow>
                {has(jobDetail.sub_vertical_1_name) && <InfoRow label="Sub Vertical 1">{jobDetail.sub_vertical_1_name}</InfoRow>}
                {has(jobDetail.sub_vertical_2_name) && <InfoRow label="Sub Vertical 2">{jobDetail.sub_vertical_2_name}</InfoRow>}
                {has(jobDetail.designation) && <InfoRow label="Designation">{jobDetail.designation}</InfoRow>}
                {has(jobDetail.project_name) && <InfoRow label="Project">{jobDetail.project_name}</InfoRow>}
                {has(jobDetail.client_name) && <InfoRow label="Client">{jobDetail.client_name}</InfoRow>}
                {/* {has(jobDetail.purpose) && (
                  <InfoRow label="Purpose">
                    <span className="capitalize">{jobDetail.purpose}</span>
                    {has(jobDetail.purpose_code) && <span className="ml-2 text-xs text-slate-400">({jobDetail.purpose_code})</span>}
                  </InfoRow>
                )} */}

                {/* ── Requirements ── */}
                <SectionHeader>Requirements</SectionHeader>
                <InfoRow label="Experience">
                  {(jobDetail.experience_min > 0 || jobDetail.experience_max > 0)
                    ? `${jobDetail.experience_min} – ${jobDetail.experience_max} years`
                    : '—'}
                </InfoRow>
                {has(jobDetail.min_qualification) && <InfoRow label="Min Qualification">{jobDetail.min_qualification}</InfoRow>}

                {jobDetail.skills_required?.length > 0 && (
                  <div className="py-3 border-b border-slate-100">
                    <span className="block text-sm text-slate-500 font-medium mb-2">Mandatory Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {jobDetail.skills_required.map((s, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {jobDetail.skills_desirable?.length > 0 && (
                  <div className="py-3 border-b border-slate-100">
                    <span className="block text-sm text-slate-500 font-medium mb-2">Desirable Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {jobDetail.skills_desirable.map((s, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Job Details ── */}
                <SectionHeader>Job Details</SectionHeader>
                {has(jobDetail.employment_type) && (
                  <InfoRow label="Employment Type">{EMPLOYMENT_TYPE_LABELS[jobDetail.employment_type] || jobDetail.employment_type}</InfoRow>
                )}
                {has(jobDetail.requisition_type) && (
                  <InfoRow label="Requisition Type">{REQUISITION_TYPE_LABELS[jobDetail.requisition_type] || jobDetail.requisition_type}</InfoRow>
                )}
                {has(jobDetail.work_mode) && (
                  <InfoRow label="Work Mode">{WORK_MODE_LABELS[jobDetail.work_mode] || jobDetail.work_mode}</InfoRow>
                )}

                {/* ── Hiring Info ── */}
                <SectionHeader>Hiring Info</SectionHeader>
                <InfoRow label="Hiring Manager">{jobDetail.hiring_manager_name || '—'}</InfoRow>
                {has(jobDetail.priority) && (
                  <InfoRow label="Priority"><span className="capitalize">{PRIORITY_LABELS[jobDetail.priority] || jobDetail.priority}</span></InfoRow>
                )}
                {/* Recruiter — always visible */}
                <InfoRow label="Recruiter">
                  {jobDetail.recruiters_working?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {jobDetail.recruiters_working.map((r) => (
                        <span key={r.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                          {r.name}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-slate-400 text-sm">Not assigned</span>}
                </InfoRow>

                {/* ── Planning ── */}
                <SectionHeader>Planning</SectionHeader>
                {has(jobDetail.positions_count) && <InfoRow label="Open Positions">{jobDetail.positions_count}</InfoRow>}
                {has(jobDetail.expected_start_date) && (
                  <InfoRow label="Expected Start">
                    {new Date(jobDetail.expected_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </InfoRow>
                )}
                {has(jobDetail.tat_days) && <InfoRow label="TAT">{jobDetail.tat_days} days</InfoRow>}
                {canSeeBudget && (has(jobDetail.budget_min) || has(jobDetail.budget_max)) && (
                  <InfoRow label="Budget (₹ Lakhs)">
                    {jobDetail.budget_min && jobDetail.budget_max
                      ? `₹${jobDetail.budget_min} – ₹${jobDetail.budget_max} L`
                      : jobDetail.budget_min
                        ? `From ₹${jobDetail.budget_min} L`
                        : `Up to ₹${jobDetail.budget_max} L`}
                  </InfoRow>
                )}

                {/* ── Additional ── */}
                {jobDetail.candidate_signals?.length > 0 && (
                  <>
                    <SectionHeader>Candidate Signals</SectionHeader>
                    <div className="py-3 border-b border-slate-100">
                      <div className="flex flex-wrap gap-1.5">
                        {jobDetail.candidate_signals.map((s, i) => (
                          <span key={i} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Job Description ── */}
                {jobDetail.job_description && (
                  <>
                    <SectionHeader>Job Description</SectionHeader>
                    <div className="py-3">
                      <div
                        className="text-sm text-slate-700 leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: jobDetail.job_description }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* RIGHT: Stats + Collaborators + History */}
        <div className="w-72 shrink-0 min-h-0 overflow-y-auto flex flex-col gap-4 pb-4">

          {/* Pipeline overview tiles */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline Overview</p>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Eye className="w-3 h-3" /> {jobDetail?.view_count || 0} views
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Applied',     tab: 'Applied',     stage: 'applied' },
                { label: 'Shortlisted', tab: 'Shortlisted', stage: 'shortlisted' },
                { label: 'Interview',   tab: 'Interview',   stage: 'interview' },
                { label: 'Offered',     tab: 'Offered',     stage: 'offered' },
                { label: 'Joined',      tab: 'Joined',      stage: 'offered' },
                { label: 'Dropped',     tab: 'Dropped',     stage: 'offered' },
              ].map(({ label, tab, stage }) => (
                <button key={tab}
                  onClick={() => navigate(ROUTES.JOBS.PIPELINE(viewingJob.id, stage))}
                  className="flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer">
                  <span className="text-2xl font-bold text-slate-700">{getStatCount(tab)}</span>
                  <span className="text-xs font-medium text-blue-600">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Collaborators list */}
          {jobDetail?.collaborators?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Collaborators ({jobDetail.collaborators.length})
              </p>
              <div className="flex flex-col gap-2.5">
                {jobDetail.collaborators.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.user_name ? c.user_name.slice(0, 2).toUpperCase() : '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.user_name}</p>
                      <p className="text-xs text-slate-500 truncate">{c.user_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Log */}
          {jobDetail && (() => {
            const creationEntry = {
              id: '__created__',
              event_type: 'job_created',
              description: 'Job Created',
              changed_by_name: jobDetail.created_by_name || null,
              created_at: jobDetail.created_at,
            };
            const changeEntries = (jobDetail.history || [])
              .filter((e) => e.event_type !== 'job_created')
              .slice()
              .reverse();
            const allEntries = [creationEntry, ...changeEntries];
            return (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Activity Log
                </p>
                <div className="flex flex-col">
                  {allEntries.map((entry, idx) => (
                    <div key={entry.id} className="flex gap-2.5 relative pb-3 last:pb-0">
                      {idx < allEntries.length - 1 && (
                        <div className="absolute left-[4px] top-2.5 bottom-0 w-px bg-slate-200" />
                      )}
                      <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 z-10 ${entry.event_type === 'job_created' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 leading-snug">{entry.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {entry.changed_by_name && <span className="font-medium text-slate-500">{entry.changed_by_name} · </span>}
                          {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
