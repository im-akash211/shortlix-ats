import React from 'react';
import { FileText } from 'lucide-react';
import Modal from './Modal';

export default function ResumeModal({ resumeModal, setResumeModal }) {
  return (
    <Modal isOpen={!!resumeModal} onClose={() => setResumeModal(null)} title={resumeModal ? `Resume — ${resumeModal.name}` : ''} maxWidth="max-w-4xl">
      {resumeModal && (
        resumeModal.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <FileText className="w-16 h-16 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Failed to load resume.</p>
          </div>
        ) : resumeModal.empty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <FileText className="w-16 h-16 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No resume uploaded</p>
            <p className="text-xs text-slate-400">This candidate does not have a resume on file.</p>
          </div>
        ) : resumeModal.missing ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <FileText className="w-16 h-16 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Resume file not found</p>
            <p className="text-xs text-slate-400">The file may have been deleted. Please upload a new resume.</p>
          </div>
        ) : resumeModal.type === 'pdf' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{resumeModal.filename}</span>
              <a href={resumeModal.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open in new tab</a>
            </div>
            <iframe src={resumeModal.url} className="w-full rounded-lg border border-slate-200" style={{ height: '70vh' }} title="Resume" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-slate-500">
            <FileText className="w-16 h-16 text-slate-300" />
            <p className="text-sm text-slate-600">Preview not available for .docx files.</p>
            <a href={resumeModal.url} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Download Resume
            </a>
          </div>
        )
      )}
    </Modal>
  );
}
