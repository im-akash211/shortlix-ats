import React from 'react';
import { CheckCircle, AlertCircle, Loader, Upload, Plus, X, GraduationCap } from 'lucide-react';
import Modal from './Modal';
import SkillTagInput from './SkillTagInput';

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
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Extracted Information" maxWidth="max-w-3xl">
      {convertSuccess ? (
        /* ── Conversion success ── */
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">Candidate Added to Talent Pool!</p>
            <p className="text-sm text-slate-500 mt-1">
              <span className="font-medium text-slate-700">{convertSuccess.full_name}</span> is now in the talent pool.
            </p>
          </div>
          <button
            onClick={() => { onClose(); queryClient.invalidateQueries({ queryKey: ['candidates', 'list'] }); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-md text-sm font-medium transition-colors"
          >
            View in Talent Pool
          </button>
        </div>
      ) : duplicateInfo ? (
        /* ── Duplicate found ── */
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Duplicate Candidate Found</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Matched by <span className="font-semibold">{duplicateInfo.matchType?.replace(/_/g, ' ')}</span>.
                Please choose how to proceed.
              </p>
            </div>
          </div>

          {/* Existing candidate preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Existing Candidate</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Name',        value: duplicateInfo.candidate.full_name },
                { label: 'Email',       value: duplicateInfo.candidate.email },
                { label: 'Phone',       value: duplicateInfo.candidate.phone || '—' },
                { label: 'Designation', value: duplicateInfo.candidate.designation || '—' },
                { label: 'Company',     value: duplicateInfo.candidate.current_employer || '—' },
                { label: 'Source',      value: duplicateInfo.candidate.source || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-medium text-slate-800 truncate">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {reviewError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleResolveDuplicate('merge')}
              disabled={resolveLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            >
              {resolveLoading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Merge with Existing'}
            </button>
            <button
              onClick={() => handleResolveDuplicate('force_create')}
              disabled={resolveLoading || duplicateInfo.matchType === 'email'}
              title={duplicateInfo.matchType === 'email' ? 'Cannot force-create when email matches exactly' : ''}
              className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            >
              Force Create
            </button>
            <button
              onClick={() => handleResolveDuplicate('discard')}
              disabled={resolveLoading}
              className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        /* ── Edit form ── */
        <div className="flex flex-col gap-5">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            {[['first_name', 'First Name'], ['last_name', 'Last Name']].map(([field, label]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <input
                  type="text" value={reviewForm[field]}
                  onChange={e => setReviewField(field, e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Contact row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Email <span className="text-rose-500">*</span></label>
              <input
                type="email" value={reviewForm.email}
                onChange={e => setReviewField('email', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Phone</label>
              <input
                type="text" value={reviewForm.phone}
                onChange={e => setReviewField('phone', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Professional row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Designation</label>
              <input
                type="text" value={reviewForm.designation}
                onChange={e => setReviewField('designation', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Current Company</label>
              <input
                type="text" value={reviewForm.current_company}
                onChange={e => setReviewField('current_company', e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Experience */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Total Experience (years)</label>
            <input
              type="number" min="0" step="0.5" value={reviewForm.experience_years}
              onChange={e => setReviewField('experience_years', e.target.value)}
              className="w-40 border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Skills</label>
            <SkillTagInput
              skills={reviewForm.skills}
              onChange={skills => setReviewField('skills', skills)}
            />
          </div>

          {/* Education */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> Education
              </label>
              <button
                type="button" onClick={addEducation}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {reviewForm.education.length === 0 && (
              <p className="text-xs text-slate-400 italic">No education entries.</p>
            )}
            {reviewForm.education.map((edu, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
                <button
                  type="button" onClick={() => removeEducation(idx)}
                  className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {[['degree', 'Degree'], ['institution', 'Institution'], ['year', 'Year']].map(([f, l]) => (
                  <div key={f} className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">{l}</label>
                    <input
                      type="text" value={edu[f]}
                      onChange={e => updateEducation(idx, f, e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Reviewed status badge */}
          {reviewSaved && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Review saved. Click &ldquo;Save to Talent Pool&rdquo; to create the candidate.
            </div>
          )}

          {reviewError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{reviewError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap">
            <button
              onClick={handleSaveReview}
              disabled={reviewLoading}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {reviewLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Reviewed Data
            </button>
            <button
              onClick={handleConvert}
              disabled={convertLoading || !reviewSaved}
              title={!reviewSaved ? 'Save reviewed data first' : ''}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {convertLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Save to Talent Pool
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors ml-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
