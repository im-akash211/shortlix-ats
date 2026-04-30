import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { departments as deptApi, users as usersApi } from '../../../lib/api';
import TagInput from '../../../components/requisition/TagInput';
import CandidateSignals from '../../../components/requisition/CandidateSignals';

// ── small shared primitives ────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}
function Input({ ...props }) {
  return (
    <input
      {...props}
      className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 w-full"
    />
  );
}
function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white w-full"
    >
      {children}
    </select>
  );
}
function Field({ label, required, children, col2 }) {
  return (
    <div className={`flex flex-col gap-1.5 ${col2 ? 'col-span-2' : ''}`}>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}
function SectionHeader({ children }) {
  return (
    <div className="col-span-2 pt-3 pb-1 border-b border-slate-100">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{children}</p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────
export default function JobEditModal({
  isEditOpen,
  setIsEditOpen,
  jobDetail,
  editForm,
  setEditForm,
  editLoading,
  handleEditSave,
  setIsCloseConfirmOpen,
}) {
  const [subVerticals1, setSubVerticals1] = useState([]);
  const [subVerticals2, setSubVerticals2] = useState([]);

  // Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => deptApi.list(),
    select: (res) => res.results || res,
    staleTime: Infinity,
    enabled: isEditOpen,
  });

  // Hiring managers
  const { data: usersList = [] } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list(),
    select: (res) => (res.results || res).filter((u) => u.role === 'hiring_manager'),
    staleTime: Infinity,
    enabled: isEditOpen,
  });

  // Sub-verticals when department changes
  useEffect(() => {
    if (!editForm.department) { setSubVerticals1([]); setSubVerticals2([]); return; }
    deptApi.subVerticals(editForm.department)
      .then((res) => { setSubVerticals1(res.results || res); setSubVerticals2(res.results || res); })
      .catch(() => { setSubVerticals1([]); setSubVerticals2([]); });
  }, [editForm.department]);

  const set = (key, val) => setEditForm((f) => ({ ...f, [key]: val }));
  const setSignal = (key, val) => setEditForm((f) => ({ ...f, [key]: val }));

  if (!isEditOpen) return null;

  const signalValues = {
    iit_grad: editForm.iit_grad || false,
    nit_grad: editForm.nit_grad || false,
    iim_grad: editForm.iim_grad || false,
    top_institute: editForm.top_institute || false,
    unicorn_exp: editForm.unicorn_exp || false,
    top_internet_product: editForm.top_internet_product || false,
    top_software_product: editForm.top_software_product || false,
    top_it_services_mnc: editForm.top_it_services_mnc || false,
    top_consulting_mnc: editForm.top_consulting_mnc || false,
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[780px] max-w-[96vw] max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">Edit Job</h3>
            <p className="text-xs text-slate-500 mt-0.5">{jobDetail?.job_code} — {jobDetail?.title}</p>
          </div>
          <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4">

            {/* ── Basic Info ── */}
            <SectionHeader>Basic Info</SectionHeader>

            <Field label="Job Title" required col2>
              <Input value={editForm.title || ''} onChange={(e) => set('title', e.target.value)} />
            </Field>

            <Field label="Department" required>
              <Select value={editForm.department || ''} onChange={(e) => set('department', e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>

            <Field label="Designation">
              <Input value={editForm.designation || ''} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Senior Engineer" />
            </Field>

            <Field label="Sub Vertical 1">
              <Select value={editForm.sub_vertical_1 || ''} onChange={(e) => set('sub_vertical_1', e.target.value || null)}>
                <option value="">None</option>
                {subVerticals1.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
              </Select>
            </Field>

            <Field label="Sub Vertical 2">
              <Select value={editForm.sub_vertical_2 || ''} onChange={(e) => set('sub_vertical_2', e.target.value || null)}>
                <option value="">None</option>
                {subVerticals2.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
              </Select>
            </Field>

            <Field label="Project Name">
              <Input value={editForm.project_name || ''} onChange={(e) => set('project_name', e.target.value)} placeholder="e.g. Project Alpha" />
            </Field>

            <Field label="Client Name">
              <Input value={editForm.client_name || ''} onChange={(e) => set('client_name', e.target.value)} placeholder="e.g. Acme Corp" />
            </Field>

            {/* ── Requirements ── */}
            <SectionHeader>Requirements</SectionHeader>

            <Field label="Experience Min (yrs)">
              <Input type="number" step="0.5" min="0" value={editForm.experience_min ?? 0}
                onChange={(e) => set('experience_min', e.target.value)}
                onWheel={(e) => e.target.blur()} />
            </Field>

            <Field label="Experience Max (yrs)">
              <Input type="number" step="0.5" min="0" value={editForm.experience_max ?? 0}
                onChange={(e) => set('experience_max', e.target.value)}
                onWheel={(e) => e.target.blur()} />
            </Field>

            <Field label="Min Qualification" col2>
              <Input value={editForm.min_qualification || ''} onChange={(e) => set('min_qualification', e.target.value)} placeholder="e.g. B.Tech / MCA" />
            </Field>

            <Field label="Mandatory Skills" col2>
              <TagInput
                value={editForm.skills_required || []}
                onChange={(v) => set('skills_required', v)}
                placeholder="Type a skill and press Enter"
              />
            </Field>

            <Field label="Desirable Skills" col2>
              <TagInput
                value={editForm.skills_desirable || []}
                onChange={(v) => set('skills_desirable', v)}
                placeholder="Type a skill and press Enter"
              />
            </Field>

            {/* ── Job Details ── */}
            <SectionHeader>Job Details</SectionHeader>

            <Field label="Status">
              {jobDetail?.status === 'closed' ? (
                <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" /> Closed — no further changes
                </div>
              ) : (
                <Select value={editForm.status || 'open'} onChange={(e) => {
                  if (e.target.value === 'closed') { setIsCloseConfirmOpen(true); }
                  else { set('status', e.target.value); }
                }}>
                  {(jobDetail?.status === 'open'
                    ? ['open', 'closed', 'abandoned']
                    : jobDetail?.status === 'abandoned'
                      ? ['abandoned', 'open', 'closed']
                      : ['open', 'abandoned', 'closed']
                  ).map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </Select>
              )}
            </Field>

            <Field label="Priority">
              <Select value={editForm.priority || 'medium'} onChange={(e) => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>

            <Field label="Employment Type">
              <Select value={editForm.employment_type || 'permanent'} onChange={(e) => set('employment_type', e.target.value)}>
                <option value="permanent">Permanent</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </Select>
            </Field>

            <Field label="Requisition Type">
              <Select value={editForm.requisition_type || 'new'} onChange={(e) => set('requisition_type', e.target.value)}>
                <option value="new">New</option>
                <option value="backfill">Backfill</option>
              </Select>
            </Field>

            <Field label="Work Mode">
              <Select value={editForm.work_mode || ''} onChange={(e) => set('work_mode', e.target.value)}>
                <option value="">Select</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="office">Office</option>
              </Select>
            </Field>

            <Field label="Location" required>
              <Select value={editForm.location || ''} onChange={(e) => set('location', e.target.value)}>
                <option value="">Select location</option>
                <option value="Gurgaon">Gurgaon</option>
                <option value="Noida">Noida</option>
                <option value="Remote">Remote</option>
              </Select>
            </Field>

            {/* ── Hiring Info ── */}
            <SectionHeader>Hiring Info</SectionHeader>

            <Field label="Hiring Manager" required col2>
              <Select value={editForm.hiring_manager || ''} onChange={(e) => set('hiring_manager', e.target.value)}>
                <option value="">Select hiring manager</option>
                {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </Field>

            {/* ── Planning ── */}
            <SectionHeader>Planning</SectionHeader>

            <Field label="Open Positions">
              <Input type="number" min="1" value={editForm.positions_count ?? 1}
                onChange={(e) => set('positions_count', e.target.value)}
                onWheel={(e) => e.target.blur()} />
            </Field>

            <Field label="Expected Start Date">
              <Input type="date" value={editForm.expected_start_date || ''}
                onChange={(e) => set('expected_start_date', e.target.value || null)} />
            </Field>

            <Field label="TAT (Days)">
              <Input type="number" min="1" value={editForm.tat_days || ''}
                onChange={(e) => set('tat_days', e.target.value || null)}
                onWheel={(e) => e.target.blur()} placeholder="e.g. 30" />
            </Field>

            <div /> {/* spacer */}

            <Field label="Budget Min (₹ Lakhs)">
              <Input type="number" min="0" step="0.01" value={editForm.budget_min || ''}
                onChange={(e) => set('budget_min', e.target.value || null)}
                onWheel={(e) => e.target.blur()} placeholder="e.g. 10" />
            </Field>

            <Field label="Budget Max (₹ Lakhs)">
              <Input type="number" min="0" step="0.01" value={editForm.budget_max || ''}
                onChange={(e) => set('budget_max', e.target.value || null)}
                onWheel={(e) => e.target.blur()} placeholder="e.g. 20" />
            </Field>

            {/* ── Candidate Signals ── */}
            <SectionHeader>Candidate Signals</SectionHeader>
            <div className="col-span-2">
              <CandidateSignals values={signalValues} onChange={setSignal} />
            </div>

            {/* ── Job Description ── */}
            <SectionHeader>Job Description</SectionHeader>
            <div className="col-span-2">
              <textarea
                rows={6}
                value={editForm.job_description || ''}
                onChange={(e) => set('job_description', e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none w-full"
                placeholder="Paste or type the job description here…"
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={() => setIsEditOpen(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={handleEditSave} disabled={editLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {editLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
