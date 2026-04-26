import React from 'react';
import Modal from './Modal';
import SkillTagInput from './SkillTagInput';

const inp = 'w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:border-blue-500';
const sel = inp + ' bg-white';

function Section({ title }) {
  return (
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-1 col-span-2">
      {title}
    </p>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function EditProfileModal({
  isOpen, onClose, selectedCandidate,
  editForm, setEditForm, editLoading, handleEditSave, user,
}) {
  const set = (key) => (e) => setEditForm({ ...editForm, [key]: e.target.value });
  const isPriv = user?.role === 'admin' || user?.role === 'recruiter';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Candidate Profile" maxWidth="max-w-3xl">
      {selectedCandidate && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">

            {/* ── Basic Info ── */}
            <Section title="Basic Info" />

            <Field label="Full Name" required>
              <input type="text" value={editForm.full_name ?? ''} onChange={set('full_name')} className={inp} />
            </Field>

            <Field label="Email">
              <input type="email" value={editForm.email ?? ''} onChange={set('email')} className={inp} />
            </Field>

            <Field label="Phone">
              <input type="text" value={editForm.phone ?? ''} onChange={set('phone')} className={inp} />
            </Field>

            <Field label="Designation">
              <input type="text" value={editForm.designation ?? ''} onChange={set('designation')} className={inp} placeholder="e.g. Software Engineer" />
            </Field>

            <Field label="Current Company">
              <input type="text" value={editForm.current_employer ?? ''} onChange={set('current_employer')} className={inp} placeholder="e.g. Acme Corp" />
            </Field>

            <Field label="Current Location">
              <input type="text" value={editForm.location ?? ''} onChange={set('location')} className={inp} placeholder="e.g. Bangalore" />
            </Field>

            <Field label="Native Location">
              <input type="text" value={editForm.native_location ?? ''} onChange={set('native_location')} className={inp} placeholder="e.g. Lucknow" />
            </Field>

            <Field label="Total Experience (years)">
              <input type="number" step="0.1" min="0" value={editForm.total_experience_years ?? ''} onChange={set('total_experience_years')} className={inp} placeholder="e.g. 4.5" />
            </Field>

            {/* ── Compensation (admin/recruiter only) ── */}
            {isPriv && (
              <>
                <Section title="Compensation" />

                <Field label="CTC Fixed (LPA)">
                  <input type="number" min="0" step="0.1" value={editForm.ctc_fixed_lakhs ?? ''} onChange={set('ctc_fixed_lakhs')} className={inp} placeholder="e.g. 10" />
                </Field>

                <Field label="CTC Variable (LPA)">
                  <input type="number" min="0" step="0.1" value={editForm.ctc_variable_lakhs ?? ''} onChange={set('ctc_variable_lakhs')} className={inp} placeholder="e.g. 2" />
                </Field>

                <Field label="Current CTC (LPA)">
                  <input type="number" min="0" step="0.1" value={editForm.current_ctc_lakhs ?? ''} onChange={set('current_ctc_lakhs')} className={inp} placeholder="e.g. 12" />
                </Field>

                <Field label="Expected CTC (LPA)">
                  <input type="number" min="0" step="0.1" value={editForm.expected_ctc_lakhs ?? ''} onChange={set('expected_ctc_lakhs')} className={inp} placeholder="e.g. 15" />
                </Field>

                <Field label="Offers in Hand">
                  <input type="text" value={editForm.offers_in_hand ?? ''} onChange={set('offers_in_hand')} className={inp} placeholder="e.g. 1 offer from XYZ at 14 LPA" />
                </Field>

                <Field label="Notice Period (days)">
                  <input type="number" min="0" step="1" value={editForm.notice_period_days ?? ''} onChange={set('notice_period_days')} className={inp} placeholder="e.g. 30" />
                </Field>

                <Field label="Notice Period Status">
                  <select value={editForm.notice_period_status ?? ''} onChange={set('notice_period_status')} className={sel}>
                    <option value="">— Select —</option>
                    <option value="serving">Serving</option>
                    <option value="lwd">LWD</option>
                    <option value="notice">In Notice</option>
                  </select>
                </Field>

                <Field label="Reason for Change">
                  <input type="text" value={editForm.reason_for_change ?? ''} onChange={set('reason_for_change')} className={inp} placeholder="e.g. Growth opportunity" />
                </Field>
              </>
            )}

            {/* ── Skills ── */}
            <Section title="Skills" />
            <div className="col-span-2">
              <SkillTagInput
                skills={editForm.skills || []}
                onChange={(updated) => setEditForm({ ...editForm, skills: updated })}
              />
            </div>

          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleEditSave}
              disabled={editLoading || !editForm.full_name}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {editLoading ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
