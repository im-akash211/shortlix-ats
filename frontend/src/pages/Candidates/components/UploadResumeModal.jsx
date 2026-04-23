import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Loader, AlertCircle, CheckCircle, Edit, User, ExternalLink } from 'lucide-react';
import Modal from './Modal';

export default function UploadResumeModal({
  isOpen,
  onClose,
  uploadFile,
  uploadLoading,
  uploadResult,
  uploadError,
  uploadDuplicate,
  existingCandidate,
  fileInputRef,
  handleFileSelect,
  handleUploadSubmit,
  openReviewModal,
  setUploadResult,
  setUploadFile,
  setUploadError,
}) {
  const navigate = useNavigate();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Resume" maxWidth="max-w-xl">
      <div className="flex flex-col gap-5">

        {/* Step 1: File picker (only shown before upload starts) */}
        {!uploadResult && (
          <>
            <p className="text-sm text-slate-500">
              Upload a candidate's resume in PDF or DOCX format. The AI will automatically
              extract structured information.
            </p>

            {/* Drop zone / file picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
            >
              <FileText className="w-10 h-10 text-slate-300 group-hover:text-blue-400 transition-colors" />
              {uploadFile ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">{uploadFile.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Click to select a file</p>
                  <p className="text-xs text-slate-400 mt-0.5">PDF or DOCX · Max 10 MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {uploadDuplicate && (
              <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <div className="flex items-start gap-2 text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-semibold">Duplicate Resume Detected</p>
                    <p className="text-amber-700 mt-0.5">
                      This exact file has already been uploaded — even if the filename is different.
                    </p>
                  </div>
                </div>
                <div className="bg-white border border-amber-100 rounded-lg px-4 py-3 flex flex-col gap-1.5 text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Status</span>
                    <span className="text-xs font-medium capitalize text-slate-700">
                      {uploadDuplicate.existing_status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Uploaded</span>
                    <span className="text-xs font-medium text-slate-700">
                      {new Date(uploadDuplicate.uploaded_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">Record ID</span>
                    <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]">
                      {uploadDuplicate.existing_resume_id}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-amber-700">
                  To re-upload, please ask an admin to remove the existing record first.
                </p>
              </div>
            )}

            {existingCandidate && (
              <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <div className="flex items-start gap-2 text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-semibold">Already in Talent Pool</p>
                    <p className="text-amber-700 mt-0.5">
                      This resume has already been converted to a candidate profile.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { onClose(); navigate(`/candidates/${existingCandidate.id}/profile`); }}
                  className="flex items-center gap-3 bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50 rounded-lg px-4 py-3 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{existingCandidate.full_name}</p>
                    {existingCandidate.email && (
                      <p className="text-xs text-slate-500 truncate">{existingCandidate.email}</p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-amber-500 group-hover:text-amber-700 shrink-0" />
                </button>
              </div>
            )}

            {uploadError && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleUploadSubmit}
                disabled={!uploadFile || uploadLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {uploadLoading
                  ? <><Loader className="w-4 h-4 animate-spin" /> Uploading…</>
                  : <><Upload className="w-4 h-4" /> Upload & Parse</>
                }
              </button>
              <button
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Step 2: Processing status + results */}
        {uploadResult && (
          <div className="flex flex-col gap-4">

            {/* Status banner */}
            {uploadResult.status === 'parsed' && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Resume parsed successfully!
              </div>
            )}
            {(uploadResult.status === 'queued' || uploadResult.status === 'processing') && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm font-medium">
                <Loader className="w-4 h-4 shrink-0 animate-spin" />
                AI is extracting information… this may take a few seconds.
              </div>
            )}
            {uploadResult.status === 'review_pending' && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Manual Review Required</p>
                  <p className="text-xs mt-0.5">{uploadResult.error_message}</p>
                </div>
              </div>
            )}
            {uploadResult.status === 'failed' && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Parsing Failed</p>
                  <p className="text-xs mt-0.5">{uploadResult.error_message || 'An unexpected error occurred.'}</p>
                </div>
              </div>
            )}

            {/* File info */}
            <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-slate-700 truncate">{uploadResult.original_filename}</p>
                <p className="text-xs text-slate-500 capitalize">
                  {uploadResult.file_type?.toUpperCase()} ·{' '}
                  {(uploadResult.file_size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <span className={`ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                uploadResult.status === 'parsed'         ? 'bg-emerald-100 text-emerald-700' :
                uploadResult.status === 'failed'         ? 'bg-rose-100 text-rose-700' :
                uploadResult.status === 'review_pending' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {uploadResult.status.replace('_', ' ')}
              </span>
            </div>

            {/* Parsed data preview */}
            {uploadResult.parsed_data?.llm_output && Object.keys(uploadResult.parsed_data.llm_output).length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-slate-700">Extracted Information</p>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: 'Name',        value: [uploadResult.parsed_data.llm_output.first_name, uploadResult.parsed_data.llm_output.last_name].filter(Boolean).join(' ') || null },
                    { label: 'Email',       value: uploadResult.parsed_data.llm_output.email },
                    { label: 'Phone',       value: uploadResult.parsed_data.llm_output.phone },
                    { label: 'Designation', value: uploadResult.parsed_data.llm_output.designation },
                    { label: 'Company',     value: uploadResult.parsed_data.llm_output.current_company },
                    { label: 'Experience',  value: uploadResult.parsed_data.llm_output.experience_years != null
                        ? `${uploadResult.parsed_data.llm_output.experience_years} years` : null },
                  ].map(({ label, value }) => (
                    value ? (
                      <div key={label} className="bg-white border border-slate-200 rounded-lg p-2.5">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="font-medium text-slate-800 mt-0.5 truncate">{value}</p>
                      </div>
                    ) : null
                  ))}
                </div>

                {uploadResult.parsed_data.llm_output.skills?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uploadResult.parsed_data.llm_output.skills.slice(0, 12).map((s, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          {s}
                        </span>
                      ))}
                      {uploadResult.parsed_data.llm_output.skills.length > 12 && (
                        <span className="text-xs text-slate-400">
                          +{uploadResult.parsed_data.llm_output.skills.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {uploadResult.parsed_data.llm_output.education?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Education</p>
                    <div className="flex flex-col gap-1.5">
                      {uploadResult.parsed_data.llm_output.education.map((e, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-lg p-2.5 text-sm">
                          <p className="font-medium text-slate-800">{e.degree}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{e.institution} {e.year ? `· ${e.year}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
              {uploadResult.status === 'parsed' && (
                <button
                  onClick={() => { onClose(); openReviewModal(uploadResult); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <Edit className="w-4 h-4" /> Review &amp; Edit
                </button>
              )}
              <button
                onClick={() => { setUploadResult(null); setUploadFile(null); setUploadError(''); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Upload Another
              </button>
              <button
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
