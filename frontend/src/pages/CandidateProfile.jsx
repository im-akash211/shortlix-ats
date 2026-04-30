import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { candidates as candidatesApi, interviews as interviewsApi, users as usersApi } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { hasPermission } from '../lib/permissions';
import { PageLoader } from '../components/LoadingDots';
import NoteEditorModal, { stripHtml, Toolbar } from '../components/NoteEditorModal';
import SkillTagInput from './Candidates/components/SkillTagInput';
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Plus, Send,
  FileText, ExternalLink, Download, User, Clock, Calendar, X, ChevronDown, ChevronUp, Pencil, Check, Trash2, Tag, Sparkles, Loader,
} from 'lucide-react';

const STAGE_COLORS = {
  APPLIED:     'bg-slate-100 text-slate-600 border-slate-200',
  SHORTLISTED: 'bg-blue-50 text-blue-700 border-blue-200',
  INTERVIEW:   'bg-violet-50 text-violet-700 border-violet-200',
  OFFERED:     'bg-amber-50 text-amber-700 border-amber-200',
  JOINED:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  DROPPED:     'bg-rose-50 text-rose-600 border-rose-200',
};

const SOURCE_LABELS = {
  recruiter_upload: 'Recruiter Upload',
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  manual: 'Manual',
};

const SCHEDULE_FORM_DEFAULT = {
  round_number: 1, round_label: '', interviewer: '',
  scheduled_at: '', duration_minutes: 60, mode: 'virtual', meeting_link: '',
};

function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const sz = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sz} rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

function InfoChip({ icon, label }) {
  if (!label) return null;
  return (
    <span className="flex items-center gap-1.5 text-sm text-slate-600">
      <span className="text-slate-400">{icon}</span>
      {label}
    </span>
  );
}

function ProfileRow({ label, value }) {
  const display = (value !== null && value !== undefined && value !== '') ? value : '—';
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-400 shrink-0 w-44">{label}</span>
      <span className={display === '—' ? 'text-slate-300' : 'text-slate-700 font-medium'}>{display}</span>
    </div>
  );
}

function SkillsRow({ skills }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 6;
  const hasMore = skills.length > VISIBLE;
  const shown = expanded ? skills : skills.slice(0, VISIBLE);
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {shown.map((s, i) => (
        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium border border-blue-100 whitespace-nowrap">
          {s}
        </span>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-600 transition-colors ml-1"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Less</> : <><ChevronDown className="w-3.5 h-3.5" /> +{skills.length - VISIBLE} more</>}
        </button>
      )}
    </div>
  );
}

function ResumeUploadButton({ candidateId, onUploaded }) {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState(null); // { existingFilename }

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      alert('Only PDF or DOCX files are allowed.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      await candidatesApi.uploadResume(candidateId, file);
      onUploaded();
    } catch (err) {
      if (err.status === 409 && err.data?.duplicate) {
        setDuplicateModal({ existingFilename: err.data.existing_filename });
      } else {
        alert(err.data?.detail || 'Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleChange} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        {uploading ? 'Uploading…' : 'Upload New Resume'}
      </button>

      {duplicateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Duplicate Resume</h3>
                <p className="text-xs text-slate-500 mt-0.5">This file has already been uploaded.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-medium">{duplicateModal.existingFilename}</span> is already on file for this candidate.
              Please upload a different version.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setDuplicateModal(null)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TagsSection({ candidateId, initialTags = [], queryClient }) {
  const [tags, setTags] = useState(initialTags);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = React.useRef(null);

  // Sync only when the serialised tag list actually changes, not on every render
  const initialTagsKey = initialTags.join('\x00');
  React.useEffect(() => {
    setTags(initialTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTagsKey]);

  React.useEffect(() => {
    if (inputVisible) inputRef.current?.focus();
  }, [inputVisible]);

  const saveTags = async (next) => {
    setSaving(true);
    const prev = tags;
    setTags(next); // Optimistic update
    try {
      await candidatesApi.update(candidateId, { tags: next });
      // Keep the React Query cache in sync so other entry points see the same data
      queryClient.setQueryData(['candidate', candidateId], (old) =>
        old ? { ...old, tags: next } : old
      );
    } catch {
      setTags(prev); // Revert on failure
      alert("Failed to save tags");
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const val = inputVal.trim();
    if (!val) { setInputVisible(false); return; }
    const lower = val.toLowerCase();
    if (tags.some(t => t.toLowerCase() === lower)) {
      setInputVal('');
      setInputVisible(false);
      return;
    }
    const next = [...tags, val];
    setInputVal('');
    setInputVisible(false);
    saveTags(next);
  };

  const removeTag = (idx) => {
    saveTags(tags.filter((_, i) => i !== idx));
  };

  const TAG_COLORS = [
    'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {tags.map((tag, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-sm transition-all animate-in fade-in zoom-in duration-200 ${TAG_COLORS[i % TAG_COLORS.length]}`}
        >
          <Tag className="w-2.5 h-2.5 shrink-0" />
          {tag}
          <button
            onClick={() => removeTag(i)}
            disabled={saving}
            className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity disabled:cursor-not-allowed hover:scale-110"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {inputVisible ? (
        <div className="relative animate-in fade-in slide-in-from-right-2 duration-200">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(); }
              if (e.key === 'Escape') { setInputVisible(false); setInputVal(''); }
            }}
            onBlur={addTag}
            placeholder="New tag…"
            className="text-[11px] border border-blue-300 rounded-full px-3 py-1 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent w-32 bg-white text-slate-700 shadow-sm"
          />
        </div>
      ) : (
        <button
          onClick={() => setInputVisible(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 px-3 py-1 rounded-full transition-all hover:bg-blue-50/50 active:scale-95"
        >
          <Plus className="w-3 h-3" /> Add Tag
        </button>
      )}
    </div>
  );
}

function CandidateProfileCard({ candidate, canEdit, canViewCompensation, onSave }) {
  const c = candidate;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const openEdit = () => {
    setForm({
      tenth_board: c.tenth_board || '',
      tenth_percentage: c.tenth_percentage ?? '',
      twelfth_board: c.twelfth_board || '',
      twelfth_percentage: c.twelfth_percentage ?? '',
      graduation_course: c.graduation_course || '',
      graduation_college: c.graduation_college || '',
      graduation_year: c.graduation_year ?? '',
      graduation_percentage: c.graduation_percentage ?? '',
      qualifying_exam: c.qualifying_exam || '',
      qualifying_rank: c.qualifying_rank || '',
      post_graduation_course: c.post_graduation_course || '',
      post_graduation_college: c.post_graduation_college || '',
      post_graduation_year: c.post_graduation_year ?? '',
      post_graduation_percentage: c.post_graduation_percentage ?? '',
      post_qualifying_exam: c.post_qualifying_exam || '',
      post_qualifying_rank: c.post_qualifying_rank || '',
      total_experience_years: c.total_experience_years ?? '',
      ctc_fixed_lakhs: c.ctc_fixed_lakhs ?? '',
      ctc_variable_lakhs: c.ctc_variable_lakhs ?? '',
      current_ctc_lakhs: c.current_ctc_lakhs ?? '',
      expected_ctc_lakhs: c.expected_ctc_lakhs ?? '',
      offers_in_hand: c.offers_in_hand || '',
      notice_period_days: c.notice_period_days ?? '',
      notice_period_status: c.notice_period_status || '',
      reason_for_change: c.reason_for_change || '',
      native_location: c.native_location || '',
      skills: c.skills || [],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      Object.entries(form).forEach(([k, v]) => {
        payload[k] = v === '' ? null : v;
      });
      await onSave(payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const f = (k) => form[k];
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const pct = (v) => (v != null && v !== '') ? `${v}%` : null;
  const lpa = (v) => (v != null && v !== '') ? `${v} LPA` : null;
  const yrs = (v) => (v != null && v !== '') ? `${v} Years` : null;

  const ctcLabel = (() => {
    const fixed    = c.ctc_fixed_lakhs    != null ? `${c.ctc_fixed_lakhs}L Fixed`    : null;
    const variable = c.ctc_variable_lakhs != null ? `${c.ctc_variable_lakhs}L Variable` : null;
    if (fixed || variable) return [fixed, variable].filter(Boolean).join(' + ');
    return lpa(c.current_ctc_lakhs);
  })();

  const noticePeriodLabel = (() => {
    const statusMap = { serving: 'Serving', lwd: 'LWD', notice: 'In Notice' };
    const parts = [];
    if (c.notice_period_status) parts.push(statusMap[c.notice_period_status] || c.notice_period_status);
    if (c.notice_period_days != null) parts.push(`${c.notice_period_days} days`);
    return parts.join(' · ') || null;
  })();

  const inputCls = 'border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-400 w-full';
  const selectCls = inputCls + ' bg-white';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-xs font-semibold text-slate-700">Profile Details</span>
        <span className="text-xs text-slate-400 ml-auto">
          {new Date(c.created_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
        {canEdit && !editing && (
          <button onClick={openEdit} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[400] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
              <span className="text-sm font-semibold text-slate-800">Edit Profile Details</span>
              <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-1">Education</p>
                {[
                  { label: '10th Board', key: 'tenth_board', type: 'text' },
                  { label: '10th Percentage', key: 'tenth_percentage', type: 'number' },
                  { label: '12th Board', key: 'twelfth_board', type: 'text' },
                  { label: '12th Percentage', key: 'twelfth_percentage', type: 'number' },
                  { label: 'Graduation Course', key: 'graduation_course', type: 'text' },
                  { label: 'Graduation College', key: 'graduation_college', type: 'text' },
                  { label: 'Graduation Year', key: 'graduation_year', type: 'number' },
                  { label: 'Graduation Percentage', key: 'graduation_percentage', type: 'number' },
                  { label: 'Qualifying Exam', key: 'qualifying_exam', type: 'text' },
                  { label: 'Qualifying Rank / Marks', key: 'qualifying_rank', type: 'text' },
                  { label: 'PG Course', key: 'post_graduation_course', type: 'text' },
                  { label: 'PG College', key: 'post_graduation_college', type: 'text' },
                  { label: 'PG Year', key: 'post_graduation_year', type: 'number' },
                  { label: 'PG Percentage', key: 'post_graduation_percentage', type: 'number' },
                  { label: 'PG Qualifying Exam', key: 'post_qualifying_exam', type: 'text' },
                  { label: 'PG Qualifying Rank / Marks', key: 'post_qualifying_rank', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key} className="flex gap-3 items-center text-xs">
                    <span className="text-slate-500 shrink-0 w-48">{label}</span>
                    <input type={type} value={f(key)} onChange={set(key)} className={inputCls} placeholder="—" step={type === 'number' ? 'any' : undefined} />
                  </div>
                ))}
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-2">Experience & Compensation</p>
                {[
                  { label: 'Experience (Years)', key: 'total_experience_years', type: 'number' },
                  ...(canViewCompensation ? [
                    { label: 'CTC Fixed (LPA)', key: 'ctc_fixed_lakhs', type: 'number' },
                    { label: 'CTC Variable (LPA)', key: 'ctc_variable_lakhs', type: 'number' },
                    { label: 'Current CTC (LPA)', key: 'current_ctc_lakhs', type: 'number' },
                    { label: 'Expected CTC (LPA)', key: 'expected_ctc_lakhs', type: 'number' },
                    { label: 'Offers in Hand', key: 'offers_in_hand', type: 'text' },
                    { label: 'Notice Period (Days)', key: 'notice_period_days', type: 'number' },
                  ] : []),
                ].map(({ label, key, type }) => (
                  <div key={key} className="flex gap-3 items-center text-xs">
                    <span className="text-slate-500 shrink-0 w-48">{label}</span>
                    <input type={type} value={f(key)} onChange={set(key)} className={inputCls} placeholder="—" step={type === 'number' ? 'any' : undefined} />
                  </div>
                ))}
                {canViewCompensation && (
                <div className="flex gap-3 items-center text-xs">
                  <span className="text-slate-500 shrink-0 w-48">Notice Period Status</span>
                  <select value={f('notice_period_status')} onChange={set('notice_period_status')} className={selectCls}>
                    <option value="">—</option>
                    <option value="serving">Serving</option>
                    <option value="lwd">LWD</option>
                    <option value="notice">In Notice</option>
                  </select>
                </div>
                )}
                {[
                  { label: 'Reason for Change', key: 'reason_for_change', type: 'text' },
                  { label: 'Native Location', key: 'native_location', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key} className="flex gap-3 items-center text-xs">
                    <span className="text-slate-500 shrink-0 w-48">{label}</span>
                    <input type={type} value={f(key)} onChange={set(key)} className={inputCls} placeholder="—" />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Skills</span>
                  <SkillTagInput
                    skills={form.skills || []}
                    onChange={(updated) => setForm(prev => ({ ...prev, skills: updated }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-100 shrink-0">
              <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
                <Check className="w-3 h-3" />{saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5 pl-1">
          <ProfileRow label="10th Board"                    value={c.tenth_board} />
          <ProfileRow label="10th Percentage"               value={pct(c.tenth_percentage)} />
          <ProfileRow label="12th Board"                    value={c.twelfth_board} />
          <ProfileRow label="12th Percentage"               value={pct(c.twelfth_percentage)} />
          <ProfileRow label="Graduation Course"             value={c.graduation_course} />
          <ProfileRow label="Graduation College"            value={c.graduation_college} />
          <ProfileRow label="Graduation Year"               value={c.graduation_year} />
          <ProfileRow label="Graduation Percentage"         value={pct(c.graduation_percentage)} />
          <ProfileRow label="Qualifying Exam"               value={c.qualifying_exam} />
          <ProfileRow label="Qualifying Rank / Marks"       value={c.qualifying_rank} />
          <ProfileRow label="PG Course"                     value={c.post_graduation_course} />
          <ProfileRow label="PG College"                    value={c.post_graduation_college} />
          <ProfileRow label="PG Year"                       value={c.post_graduation_year} />
          <ProfileRow label="PG Percentage"                 value={pct(c.post_graduation_percentage)} />
          <ProfileRow label="PG Qualifying Exam"            value={c.post_qualifying_exam} />
          <ProfileRow label="PG Qualifying Rank / Marks"    value={c.post_qualifying_rank} />
          <ProfileRow label="Experience"                    value={yrs(c.total_experience_years)} />
          {canViewCompensation && <>
          <ProfileRow label="CTC in LPA (Fixed + Variable)" value={ctcLabel} />
          <ProfileRow label="ECTC in LPA"                   value={lpa(c.expected_ctc_lakhs)} />
          <ProfileRow label="Offers if Any"                 value={c.offers_in_hand} />
          <ProfileRow label="Notice Period"                 value={noticePeriodLabel} />
          </>}
          <ProfileRow label="Reason for Change"             value={c.reason_for_change} />
          <ProfileRow label="Current Location"              value={c.location} />
          <ProfileRow label="Native"                        value={c.native_location} />
          <div className="flex gap-2 text-xs mt-0.5">
            <span className="text-slate-400 shrink-0 w-44">Skills</span>
            {c.skills?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {c.skills.map((s, i) => (
                  <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-medium">{s}</span>
                ))}
              </div>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </div>
        </div>
    </div>
  );
}

export default function CandidateJobProfile() {
  const { candidateId } = useParams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') || null;
  const fromCandidates = !jobId;
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [addNoteEmpty, setAddNoteEmpty] = useState(true);
  const [viewingNote, setViewingNote] = useState(null);
  const [savingModalNote, setSavingModalNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(SCHEDULE_FORM_DEFAULT);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleToast, setScheduleToast] = useState(null);

  // Identity block inline edit
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityForm, setIdentityForm] = useState({});
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState('');

  const openIdentityEdit = (c) => {
    setIdentityForm({
      full_name:              c.full_name || '',
      email:                  c.email || '',
      phone:                  c.phone || '',
      designation:            c.designation || '',
      current_employer:       c.current_employer || '',
      location:               c.location || '',
      total_experience_years: c.total_experience_years ?? '',
      skills:                 c.skills || [],
    });
    setIdentityError('');
    setEditingIdentity(true);
  };

  const handleIdentitySave = async () => {
    setIdentitySaving(true);
    setIdentityError('');
    try {
      const payload = { ...identityForm };
      if (payload.total_experience_years === '') payload.total_experience_years = null;
      await candidatesApi.update(candidateId, payload);
      refetchCandidate();
      setEditingIdentity(false);
    } catch (err) {
      setIdentityError(err.data?.detail || JSON.stringify(err.data) || 'Save failed.');
    } finally {
      setIdentitySaving(false);
    }
  };

  const addNoteEditor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: '',
    onUpdate: ({ editor }) => setAddNoteEmpty(editor.isEmpty),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[80px] prose prose-sm max-w-none px-3 py-2 focus:outline-none',
      },
    },
  });

  const { data: candidate, isLoading, refetch: refetchCandidate } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => candidatesApi.detail(candidateId),
  });

  const [aiMatch, setAiMatch]               = useState(null);  // { score, reason, job_title }
  const [aiMatchLoading, setAiMatchLoading]   = useState(false);
  const [aiRecomputing, setAiRecomputing]     = useState(false);

  const applyAIResults = (results) => {
    if (results && results.length > 0) {
      const best = results[0];
      setAiMatch({ score: best.score, reason: best.reason, job_title: best.job_title });
    } else {
      setAiMatch(null);
    }
  };

  // On mount: read cached scores — no LLM call
  useEffect(() => {
    if (!candidateId) return;
    setAiMatchLoading(true);
    candidatesApi.getAIMatch(candidateId)
      .then(applyAIResults)
      .catch(() => setAiMatch(null))
      .finally(() => setAiMatchLoading(false));
  }, [candidateId]);

  const handleRecomputeAI = () => {
    if (aiRecomputing) return;
    setAiRecomputing(true);
    candidatesApi.computeAIMatch(candidateId)
      .then(applyAIResults)
      .catch(() => {})
      .finally(() => setAiRecomputing(false));
  };

  const { data: notesRaw, refetch: refetchNotes } = useQuery({
    queryKey: ['candidate', candidateId, 'notes'],
    queryFn: () => candidatesApi.notes(candidateId),
    enabled: !!candidateId,
  });

  const { data: usersRaw } = useQuery({
    queryKey: ['users', 'dropdown'],
    queryFn: () => usersApi.dropdown(),
    enabled: !fromCandidates && isScheduleOpen,
  });
  const usersList = Array.isArray(usersRaw) ? usersRaw : (usersRaw?.results || []);

  const notes = Array.isArray(notesRaw) ? notesRaw : (notesRaw?.results || []);
  const mapping = candidate?.job_mappings?.find(m => m.job === jobId);
  const stage = mapping?.macro_stage || 'APPLIED';
  const latestResume = candidate?.resume_files?.find(f => f.is_latest) || candidate?.resume_files?.[0];

  const [resumeDownloading, setResumeDownloading] = useState(false);

  // Open in new tab: direct navigation — no fetch, no CORS issue
  const openResumeInNewTab = (file) => {
    const url = file?.file_url;
    if (!url) { alert('Resume URL not available.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Download: fetch from our own backend proxy (same-origin → no CORS)
  const downloadResume = async (file) => {
    if (resumeDownloading) return;
    setResumeDownloading(true);
    try {
      const BASE_API = (import.meta.env.VITE_API_URL || '') + '/api/v1';
      const token = localStorage.getItem('access');
      const res = await fetch(`${BASE_API}/candidates/${candidateId}/resume/download/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed.');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file?.original_filename || 'resume';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch {
      alert('Could not download resume. Please try again.');
    } finally {
      setResumeDownloading(false);
    }
  };

  const handleAddNote = async () => {
    if (!addNoteEditor || addNoteEmpty) return;
    const html = addNoteEditor.getHTML();
    setAddingNote(true);
    try {
      await candidatesApi.addNote(candidateId, html);
      addNoteEditor.commands.clearContent();
      setAddNoteEmpty(true);
      setShowNoteForm(false);
      refetchNotes();
    } catch (err) {
      alert('Failed to save note: ' + (err?.message || 'Unknown error'));
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditNote = async (noteId, htmlContent) => {
    setSavingModalNote(true);
    try {
      await candidatesApi.editNote(candidateId, noteId, htmlContent);
      setViewingNote(null);
      refetchNotes();
    } catch (err) {
      alert('Failed to save edit: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingModalNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    setDeletingNoteId(noteId);
    try {
      await candidatesApi.deleteNote(candidateId, noteId);
      setViewingNote(null);
      refetchNotes();
    } finally {
      setDeletingNoteId(null);
    }
  };

  const closeScheduleModal = () => {
    setIsScheduleOpen(false);
    setScheduleForm(SCHEDULE_FORM_DEFAULT);
    setScheduleToast(null);
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleForm.interviewer || !scheduleForm.scheduled_at) return;
    setScheduleLoading(true);
    setScheduleToast(null);
    try {
      await interviewsApi.create({
        mapping:          mapping.id,
        round_number:     Number(scheduleForm.round_number),
        round_label:      scheduleForm.round_label,
        interviewer:      scheduleForm.interviewer,
        scheduled_at:     new Date(scheduleForm.scheduled_at).toISOString(),
        duration_minutes: Number(scheduleForm.duration_minutes),
        mode:             scheduleForm.mode,
        meeting_link:     scheduleForm.meeting_link,
      });
      setScheduleToast({ type: 'success', message: 'Interview scheduled successfully.' });
      setTimeout(() => closeScheduleModal(), 1200);
    } catch (err) {
      setScheduleToast({ type: 'error', message: err.data?.detail || JSON.stringify(err.data) || 'Failed to schedule.' });
    } finally {
      setScheduleLoading(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading candidate profile…" />;
  if (!candidate) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Candidate not found.
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">

      {/* ── Slim top bar: breadcrumb + job-context actions ──────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {fromCandidates ? 'Candidates' : 'Jobs'}
          </button>
          {!fromCandidates && <><span>/</span><span className="text-slate-500">Pipeline</span></>}
          <span>/</span>
          <span className="text-slate-700 font-medium">{candidate.full_name}</span>
        </div>
        {!fromCandidates && (
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STAGE_COLORS[stage] || STAGE_COLORS.APPLIED}`}>
              {stage.charAt(0) + stage.slice(1).toLowerCase()}
            </span>
            <button
              onClick={() => setIsScheduleOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" /> Schedule Interview
            </button>
          </div>
        )}
      </div>

      {/* ── Main 2-column area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: candidate info + resume */}
        <div className="flex-1 bg-white border-r border-slate-200 overflow-auto flex flex-col">

          {/* Candidate identity block */}
          <div className="px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-start gap-3 mb-3">
              <Avatar name={candidate.full_name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-bold text-slate-900">{candidate.full_name}</h1>
                  {aiMatchLoading ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                      <Loader className="w-3 h-3 animate-spin" /> Loading…
                    </span>
                  ) : aiMatch ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        title={`Best match: ${aiMatch.job_title}\n${aiMatch.reason}`}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border cursor-default ${
                          aiMatch.score >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          aiMatch.score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        AI Match {Math.round(aiMatch.score)}%
                      </span>
                      <button
                        onClick={handleRecomputeAI}
                        disabled={aiRecomputing}
                        title="Recompute AI match"
                        className="text-slate-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                      >
                        <Loader className={`w-3.5 h-3.5 ${aiRecomputing ? 'animate-spin text-blue-500' : ''}`} />
                      </button>
                    </span>
                  ) : candidate.job_mappings?.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Not applied to any job</span>
                  ) : (
                    <button
                      onClick={handleRecomputeAI}
                      disabled={aiRecomputing}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {aiRecomputing
                        ? <><Loader className="w-3 h-3 animate-spin" /> Computing…</>
                        : <><Sparkles className="w-3 h-3" /> Compute AI Match</>
                      }
                    </button>
                  )}
                </div>
                {candidate.designation && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {candidate.designation}
                    {candidate.current_employer && (
                      <span className="text-slate-400"> &bull; {candidate.current_employer}</span>
                    )}
                  </p>
                )}
                {aiMatch && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">
                    <span className="font-medium text-slate-500">{aiMatch.job_title}</span> — {aiMatch.reason}
                  </p>
                )}
              </div>
              <div className="shrink-0 pt-0.5 flex items-start gap-2">
                <TagsSection candidateId={candidateId} initialTags={candidate.tags || []} queryClient={queryClient} />
                {['admin', 'recruiter'].includes(currentUser?.role) && (
                  <button
                    onClick={() => openIdentityEdit(candidate)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors shrink-0"
                    title="Edit candidate details"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <InfoChip icon={<Mail className="w-3.5 h-3.5" />} label={candidate.email} />
              <InfoChip icon={<Phone className="w-3.5 h-3.5" />} label={candidate.phone} />
              <InfoChip icon={<MapPin className="w-3.5 h-3.5" />} label={candidate.location} />
              <InfoChip
                icon={<Briefcase className="w-3.5 h-3.5" />}
                label={candidate.total_experience_years ? `${candidate.total_experience_years} Years Exp.` : null}
              />
              {candidate.source && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                  {SOURCE_LABELS[candidate.source] || candidate.source}
                </span>
              )}
              {candidate.source === 'referral' && candidate.sub_source && (
                <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium">
                  {candidate.sub_source}
                </span>
              )}
            </div>
            {candidate.skills?.length > 0 && (
              <SkillsRow skills={candidate.skills} />
            )}
          </div>

          {/* Identity edit modal */}
          {editingIdentity && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[400] p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
                  <span className="text-sm font-semibold text-slate-800">Edit Candidate Details</span>
                  <button onClick={() => setEditingIdentity(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto px-5 py-4">
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Full Name',        key: 'full_name',              type: 'text'   },
                      { label: 'Email',             key: 'email',                  type: 'email'  },
                      { label: 'Phone',             key: 'phone',                  type: 'text'   },
                      { label: 'Designation',       key: 'designation',            type: 'text'   },
                      { label: 'Current Company',   key: 'current_employer',       type: 'text'   },
                      { label: 'Location',          key: 'location',               type: 'text'   },
                      { label: 'Experience (Years)',key: 'total_experience_years', type: 'number' },
                    ].map(({ label, key, type }) => (
                      <div key={key} className="flex gap-3 items-center text-xs">
                        <span className="text-slate-500 shrink-0 w-44">{label}</span>
                        <input
                          type={type}
                          value={identityForm[key]}
                          onChange={e => setIdentityForm(prev => ({ ...prev, [key]: e.target.value }))}
                          className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-400 w-full"
                          placeholder="—"
                          step={type === 'number' ? 'any' : undefined}
                        />
                      </div>
                    ))}
                    <div className="flex flex-col gap-1.5 text-xs">
                      <span className="text-slate-500 font-medium">Skills</span>
                      <SkillTagInput
                        skills={identityForm.skills || []}
                        onChange={updated => setIdentityForm(prev => ({ ...prev, skills: updated }))}
                      />
                    </div>
                    {identityError && (
                      <p className="text-xs text-rose-600">{identityError}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-100 shrink-0">
                  <button onClick={() => setEditingIdentity(false)} className="text-xs text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleIdentitySave} disabled={identitySaving} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
                    <Check className="w-3 h-3" />{identitySaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resume viewer */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">Resume</span>
            <div className="flex items-center gap-3 flex-wrap">
              {latestResume && (
                <>
                  <button
                    type="button"
                    onClick={() => openResumeInNewTab(latestResume)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadResume(latestResume)}
                    disabled={resumeDownloading}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                    title="Download resume"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {resumeDownloading && <span className="text-xs">…</span>}
                  </button>
                </>
              )}
              {['admin', 'recruiter'].includes(currentUser?.role) && (
                <ResumeUploadButton candidateId={candidateId} onUploaded={refetchCandidate} />
              )}
            </div>
          </div>

          <div className="min-h-[600px] flex-1">
            {latestResume ? (
              latestResume.file_type === 'pdf' ? (
                <iframe
                  src={latestResume.file_url}
                  className="w-full h-[800px]"
                  title="Candidate Resume"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                  <FileText className="w-14 h-14 text-slate-200" />
                  <p className="text-sm font-medium text-slate-500">
                    {latestResume.original_filename || 'Resume'}
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadResume(latestResume)}
                    disabled={resumeDownloading}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" /> {resumeDownloading ? 'Downloading…' : 'Download Resume'}
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
                <FileText className="w-14 h-14" />
                <p className="text-sm text-slate-400">No resume uploaded</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="w-[380px] shrink-0 flex flex-col bg-white overflow-hidden">
          {/* Activity header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold text-slate-800">Activity Feed</span>
            <button
              onClick={() => setShowNoteForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Note
            </button>
          </div>

          {/* Add Note form — rich text editor */}
          {showNoteForm && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <Toolbar editor={addNoteEditor} />
                <EditorContent editor={addNoteEditor} />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => { setShowNoteForm(false); addNoteEditor?.commands.clearContent(); setAddNoteEmpty(true); }}
                  className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !addNoteEditor || addNoteEmpty}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  {addingNote ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-4">

            {/* Notes — newest first, click to open modal */}
            {[...notes].reverse().map(note => {
              const plainText = stripHtml(note.content);
              return (
                <div key={note.id} className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="w-px flex-1 bg-slate-100 min-h-[12px]" />
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700">{note.user_name || 'Unknown'}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(note.created_at).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {note.is_edited && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Edited
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        {String(note.user_id) === String(currentUser?.id) && (
                          <button
                            onClick={() => setViewingNote(note)}
                            title="Edit note"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {(String(note.user_id) === String(currentUser?.id) ||
                          ['admin', 'hiring_manager'].includes(currentUser?.role)) && (
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={deletingNoteId === note.id}
                            title="Delete note"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingNote(note)}
                      className="text-left w-full"
                    >
                      <p
                        className="text-sm text-slate-600 leading-relaxed line-clamp-2 break-words"
                        style={{
                          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
                          maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
                        }}
                      >
                        {plainText || <span className="italic text-slate-400">Empty note</span>}
                      </p>
                    </button>

                    {/* Edit history — admin only, inline in feed */}
                    {currentUser?.role === 'admin' && note.is_edited && note.history?.length > 0 && (
                      <div className="mt-1.5">
                        <button
                          onClick={() => setExpandedHistoryId(expandedHistoryId === note.id ? null : note.id)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {expandedHistoryId === note.id
                            ? <><ChevronUp className="w-3 h-3" /> Hide history</>
                            : <><ChevronDown className="w-3 h-3" /> View edit history ({note.history.length})</>}
                        </button>
                        {expandedHistoryId === note.id && (
                          <div className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-slate-100 pl-3">
                            {note.history.map(h => (
                              <div key={h.id} className="text-xs">
                                <span className="text-slate-400">
                                  {new Date(h.edited_at).toLocaleString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                                <div
                                  className="prose prose-sm max-w-none text-slate-500 mt-0.5"
                                  dangerouslySetInnerHTML={{ __html: h.content }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Profile Created card — always at the bottom (oldest event) */}
            <CandidateProfileCard
              candidate={candidate}
              canEdit={hasPermission(currentUser, 'MANAGE_CANDIDATES')}
              canViewCompensation={hasPermission(currentUser, 'VIEW_COMPENSATION')}
              onSave={async (payload) => {
                await candidatesApi.update(candidateId, payload);
                refetchCandidate();
              }}
            />

            {notes.length === 0 && (
              <div className="flex flex-col items-center gap-2 text-slate-300 py-4">
                <Clock className="w-8 h-8" />
                <p className="text-xs text-slate-400">No notes yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Note Editor Modal ────────────────────────────────────────────────── */}
      {viewingNote && (
        <NoteEditorModal
          note={viewingNote}
          currentUser={currentUser}
          onClose={() => setViewingNote(null)}
          onSave={(htmlContent) => handleEditNote(viewingNote.id, htmlContent)}
          onDelete={() => handleDeleteNote(viewingNote.id)}
          saving={savingModalNote}
          deleting={deletingNoteId === viewingNote?.id}
        />
      )}

      {/* ── Schedule Interview Modal ─────────────────────────────────────────── */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[580px] max-w-[92vw]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Schedule Interview</h3>
              <button onClick={closeScheduleModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {scheduleToast && (
                <div className={`text-sm px-4 py-3 rounded-lg font-medium ${scheduleToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {scheduleToast.message}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Candidate</label>
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-slate-50">
                  {candidate.full_name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Round</label>
                  <select
                    value={scheduleForm.round_label}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, round_label: e.target.value, round_number: e.target.selectedIndex })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Select round…</option>
                    <option value="Screening Round">Screening Round</option>
                    <option value="Technical Round 1">Technical Round 1</option>
                    <option value="Technical Round 2">Technical Round 2</option>
                    <option value="Managerial Round">Managerial Round</option>
                    <option value="HR Round">HR Round</option>
                    <option value="Final Round">Final Round</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Interviewer *</label>
                  <select
                    value={scheduleForm.interviewer}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Select interviewer…</option>
                    {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Date *</label>
                  <input
                    type="date"
                    value={scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[0] : ''}
                    onChange={(e) => {
                      const time = scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[1] : '00:00';
                      setScheduleForm({ ...scheduleForm, scheduled_at: `${e.target.value}T${time}` });
                    }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Time *</label>
                  <input
                    type="time"
                    value={scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[1] : ''}
                    onChange={(e) => {
                      const date = scheduleForm.scheduled_at ? scheduleForm.scheduled_at.split('T')[0] : '';
                      setScheduleForm({ ...scheduleForm, scheduled_at: `${date}T${e.target.value}` });
                    }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Duration (minutes)</label>
                  <input
                    type="number" min="15" step="15"
                    value={scheduleForm.duration_minutes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Mode</label>
                  <select
                    value={scheduleForm.mode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, mode: e.target.value })}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="virtual">Virtual</option>
                    <option value="phone">Phone</option>
                    <option value="face_to_face">Face to Face</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Meeting Link <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text" placeholder="https://meet.google.com/..."
                  value={scheduleForm.meeting_link}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={closeScheduleModal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={scheduleLoading || !scheduleForm.interviewer || !scheduleForm.scheduled_at}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {scheduleLoading ? 'Scheduling…' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
