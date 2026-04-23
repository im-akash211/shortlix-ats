import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader, Upload, Plus, X, GraduationCap, ExternalLink, Pencil, Save } from 'lucide-react';
import Modal from './Modal';
import SkillTagInput from './SkillTagInput';

const MATCH_LABEL = {
  email: 'Email',
  phone: 'Phone',
  fuzzy_name: 'Name & Company',
  ai_content: 'AI Content',
};

function PreviewField({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 truncate">{value || <span className="text-slate-400 italic">—</span>}</p>
    </div>
  );
}

export default function ReviewResumeModal({
  isOpen,
  onClose,
  reviewIngestion,
  reviewForm,
  reviewLoading,
  reviewSaved,
  convertLoading,
  duplicateInfo,
  resolveLoading,
  convertSuccess,
  reviewError,
  setReviewField,
  updateEducation,
  addEducation,
  removeEducation,
  handleSaveReview,
  handleConvert,
  handleResolveDuplicate,
  queryClient,
  // Optional: when uploading from a job context
  targetJob = null,
  onApplyToJob = null,
}) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  // Snapshot form at the moment Edit is clicked — used to restore on Cancel
  const [snapshot, setSnapshot] = useState(null);

  const handleEdit = () => {
    setSnapshot(JSON.parse(JSON.stringify(reviewForm)));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Restore form to pre-edit snapshot via parent setter
    if (snapshot) {
      Object.entries(snapshot).forEach(([k, v]) => setReviewField(k, v));
    }
    setIsEditing(false);
    setSnapshot(null);
  };

  const handleSaveChanges = async () => {
    await handleSaveReview();
    setIsEditing(false);
    setSnapshot(null);
  };

  // parsed data to show in preview
  const data = reviewForm;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resume Preview" maxWidth="max-w-3xl">
      {convertSuccess ? (
        /* ── Success ── */
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">
              {targetJob ? 'Candidate Added & Applied!' : 'Candidate Added to Talent Pool!'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              <span className="font-medium text-slate-700">{convertSuccess.full_name}</span>{' '}
              {targetJob
                ? <>has been added to the talent pool and applied to <span className="font-medium text-slate-700">{targetJob.title}</span>.</>
                : 'is now in the talent pool.'
              }
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] });
              if (targetJob && onApplyToJob) onApplyToJob(convertSuccess);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-md text-sm font-medium transition-colors"
          >
            {targetJob ? 'View in Pipeline' : 'View in Talent Pool'}
          </button>
        </div>

      ) : duplicateInfo ? (
        /* ── Duplicate found ── */
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {duplicateInfo.candidates?.length > 1
                  ? `${duplicateInfo.candidates.length} Potential Duplicate Candidates Found`
                  : 'Duplicate Candidate Found'}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Click a candidate to open their profile. Choose how to proceed below.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
            {(duplicateInfo.candidates || []).map((c, idx) => (
              <button
                key={c.id ?? idx}
                onClick={() => { onClose(); navigate(`/candidates/${c.id}/profile`); }}
                className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 text-sm">{c.full_name}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      {MATCH_LABEL[c.match_type] || c.match_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0 mt-0.5" />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  {c.email && <span><span className="text-slate-400">Email: </span>{c.email}</span>}
                  {c.phone && <span><span className="text-slate-400">Phone: </span>{c.phone}</span>}
                  {c.designation && <span><span className="text-slate-400">Role: </span>{c.designation}</span>}
                  {c.current_employer && <span><span className="text-slate-400">Company: </span>{c.current_employer}</span>}
                </div>
                {c.confidence != null && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{Math.round(c.confidence * 100)}% match</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {reviewError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleResolveDuplicate('merge')} disabled={resolveLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors">
              {resolveLoading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Merge with Top Match'}
            </button>
            <button onClick={() => handleResolveDuplicate('force_create')} disabled={resolveLoading || duplicateInfo.matchType === 'email'}
              title={duplicateInfo.matchType === 'email' ? 'Cannot force-create when email matches exactly' : ''}
              className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors">
              Force Create
            </button>
            <button onClick={() => handleResolveDuplicate('discard')} disabled={resolveLoading}
              className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-md text-sm font-medium transition-colors">
              Discard
            </button>
          </div>
        </div>

      ) : isEditing ? (
        /* ── Page 3: Edit form ── */
        <div className="flex flex-col gap-5">
          <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Editing extracted details. Click <strong>Save Changes</strong> to apply, or <strong>Cancel</strong> to go back.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[['first_name', 'First Name'], ['last_name', 'Last Name']].map(([field, label]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <input type="text" value={reviewForm[field]} onChange={e => setReviewField(field, e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Email <span className="text-rose-500">*</span></label>
              <input type="email" value={reviewForm.email} onChange={e => setReviewField('email', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Phone</label>
              <input type="text" value={reviewForm.phone} onChange={e => setReviewField('phone', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Designation</label>
              <input type="text" value={reviewForm.designation} onChange={e => setReviewField('designation', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Current Company</label>
              <input type="text" value={reviewForm.current_company} onChange={e => setReviewField('current_company', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Total Experience (years)</label>
            <input type="number" min="0" step="0.5" value={reviewForm.experience_years}
              onChange={e => setReviewField('experience_years', e.target.value)}
              className="w-40 border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Skills</label>
            <SkillTagInput skills={reviewForm.skills} onChange={skills => setReviewField('skills', skills)} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> Education
              </label>
              <button type="button" onClick={addEducation}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {reviewForm.education.length === 0 && (
              <p className="text-xs text-slate-400 italic">No education entries.</p>
            )}
            {reviewForm.education.map((edu, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
                <button type="button" onClick={() => removeEducation(idx)}
                  className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                {[['degree', 'Degree'], ['institution', 'Institution'], ['year', 'Year']].map(([f, l]) => (
                  <div key={f} className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{l}</label>
                    <input type="text" value={edu[f]} onChange={e => updateEducation(idx, f, e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {reviewError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button onClick={handleSaveChanges} disabled={reviewLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors">
              {reviewLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
            <button onClick={handleCancelEdit}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-md text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </div>

      ) : (
        /* ── Page 2: Read-only preview ── */
        <div className="flex flex-col gap-5">
          <p className="text-xs text-slate-500">
            Review the details extracted from the resume. Click <strong>Edit</strong> to make changes or <strong>Save</strong> to add to the talent pool.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <PreviewField label="First Name" value={data.first_name} />
            <PreviewField label="Last Name" value={data.last_name} />
            <PreviewField label="Email" value={data.email} />
            <PreviewField label="Phone" value={data.phone} />
            <PreviewField label="Designation" value={data.designation} />
            <PreviewField label="Current Company" value={data.current_company} />
            <PreviewField label="Experience (years)" value={data.experience_years} />
          </div>

          {data.skills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((s, i) => (
                  <span key={i} className="bg-blue-50 border border-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          {data.education?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> Education</p>
              <div className="flex flex-col gap-2">
                {data.education.map((edu, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700">{edu.degree}</span>
                    {edu.institution && <span className="text-slate-500"> · {edu.institution}</span>}
                    {edu.year && <span className="text-slate-400"> ({edu.year})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button onClick={handleConvert} disabled={convertLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors">
              {convertLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Save to Talent Pool
            </button>
            <button onClick={handleEdit}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-md text-sm font-medium transition-colors">
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button onClick={onClose}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ml-auto">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
