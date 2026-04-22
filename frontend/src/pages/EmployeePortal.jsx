import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { employee as employeeApi } from '../lib/api';
import {
  Briefcase, MapPin, Upload, X, CheckCircle, ChevronRight, LogOut, Users, Search,
} from 'lucide-react';

export default function EmployeePortal() {
  const [empName, setEmpName] = useState('');
  const [empId, setEmpId] = useState('');
  const [entered, setEntered] = useState(false);
  const [search, setSearch] = useState('');
  const [referJob, setReferJob] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['employee-jobs'],
    queryFn: employeeApi.jobs,
    enabled: entered,
  });

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      (j.department || '').toLowerCase().includes(q) ||
      (j.location || '').toLowerCase().includes(q) ||
      (j.job_code || '').toLowerCase().includes(q) ||
      (j.skills_required || []).some(s => s.toLowerCase().includes(q))
    );
  }, [jobs, search]);

  const { mutate: submitReferral, isPending } = useMutation({
    mutationFn: ({ file, jobId }) => {
      const fd = new FormData();
      fd.append('resume', file);
      fd.append('job_id', jobId);
      fd.append('employee_name', empName);
      fd.append('employee_id', empId);
      return employeeApi.refer(fd);
    },
    onSuccess: (data) => { setResult(data); setSubmitError(''); },
    onError: (err) => setSubmitError(err.message || 'Referral failed. Please try again.'),
  });

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setResumeFile(file);
  }, []);

  const handleEnter = (e) => {
    e.preventDefault();
    if (!empName.trim() || !empId.trim()) return;
    setEntered(true);
  };

  const handleSubmit = () => {
    if (!resumeFile || !referJob) return;
    setSubmitError('');
    submitReferral({ file: resumeFile, jobId: referJob.id });
  };

  const closeModal = () => {
    setReferJob(null);
    setResumeFile(null);
    setResult(null);
    setSubmitError('');
  };

  /* ── Entry screen ─────────────────────────────────────────────────────── */
  if (!entered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Employee Referral Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Refer talented people for open positions</p>
          </div>

          <form onSubmit={handleEnter} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Your Name
                <span className="text-slate-400 font-normal ml-1">(lowercase, no spaces)</span>
              </label>
              <input
                type="text"
                required
                value={empName}
                onChange={e => setEmpName(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="johndoe"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Employee ID</label>
              <input
                type="text"
                required
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                placeholder="EMP001"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!empName.trim() || !empId.trim()}
              className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Enter Portal →
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Demo accounts for testing:</p>
            <div className="flex flex-col gap-1.5">
              {[
                { name: 'johndoe',    id: 'EMP001' },
                { name: 'priyasharma', id: 'EMP002' },
                { name: 'rahulverma', id: 'EMP003' },
              ].map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => { setEmpName(acc.name); setEmpId(acc.id); }}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-100 transition-colors"
                >
                  <span className="font-mono font-medium">{acc.name}</span>
                  <span className="text-slate-400">{acc.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Jobs portal ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Employee Referral Portal</h1>
            <p className="text-xs text-slate-400">
              Logged in as <span className="font-semibold text-slate-600">{empName}</span>
              <span className="mx-1">·</span>
              ID: <span className="font-semibold text-slate-600">{empId}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEntered(false); setEmpName(''); setEmpId(''); }}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Open Positions</h2>
            <p className="text-sm text-slate-500">
              Select a position and refer a candidate by uploading their resume.
            </p>
          </div>
          <div className="sm:ml-auto relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title, department, skill…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all bg-white"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-slate-400 py-16 text-sm">Loading open positions…</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center text-slate-400 py-16 text-sm">
            {search.trim() ? `No positions match "${search}".` : 'No open positions at this time. Check back soon!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map(job => (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                    {job.job_code}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-2">{job.title}</h3>
                </div>

                <div className="flex flex-col gap-1.5">
                  {job.department && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Briefcase className="w-3 h-3 shrink-0" /> {job.department}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3 h-3 shrink-0" /> {job.location}
                    </span>
                  )}
                  {(job.experience_min != null || job.experience_max != null) && (
                    <span className="text-xs text-slate-500">
                      {job.experience_min ?? 0}–{job.experience_max ?? '∞'} yrs experience
                    </span>
                  )}
                </div>

                {job.skills_required?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {job.skills_required.slice(0, 4).map((s, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {s}
                      </span>
                    ))}
                    {job.skills_required.length > 4 && (
                      <span className="text-[10px] text-slate-400">+{job.skills_required.length - 4} more</span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setReferJob(job)}
                  className="mt-auto flex items-center justify-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refer a Candidate <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refer modal */}
      {referJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-400">Referring for</p>
                <h3 className="text-sm font-bold text-slate-800">{referJob.title}</h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5">
              {result ? (
                /* Success state */
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle className="w-14 h-14 text-emerald-500" />
                  <div>
                    <p className="text-base font-bold text-slate-800">Referral submitted!</p>
                    <p className="text-sm text-slate-500 mt-1.5">
                      <span className="font-semibold text-slate-700">{result.candidate_name}</span> has been
                      added to the pipeline for{' '}
                      <span className="font-semibold text-slate-700">{result.job_title}</span>.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">The recruitment team has been notified.</p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="mt-2 text-sm bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">
                    Upload the candidate's resume (PDF or DOCX). Details will be extracted automatically.
                  </p>

                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('emp-resume-input').click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      dragging
                        ? 'border-blue-400 bg-blue-50'
                        : resumeFile
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      id="emp-resume-input"
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={e => setResumeFile(e.target.files[0] || null)}
                    />
                    {resumeFile ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                        <p className="text-sm font-semibold text-emerald-700">{resumeFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(resumeFile.size / 1024).toFixed(0)} KB · Click to change
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Drop resume here or click to browse</p>
                        <p className="text-xs text-slate-400">PDF or DOCX · max 10 MB</p>
                      </div>
                    )}
                  </div>

                  {submitError && (
                    <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                      {submitError}
                    </p>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={closeModal}
                      className="flex-1 text-sm text-slate-600 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!resumeFile || isPending}
                      className="flex-1 text-sm font-semibold bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? 'Submitting…' : 'Submit Referral'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
