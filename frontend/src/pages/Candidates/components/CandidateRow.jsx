import React from 'react';
import {
  Edit, MapPin, Phone, Mail, Briefcase,
  MessageSquarePlus, Trash2, FileText, Share2, ShieldOff,
} from 'lucide-react';
import { SOURCE_LABELS, STAGE_LABELS, STAGE_COLORS } from '../constants';

export default function CandidateRow({ candidate: c, openModal, openShare, openViewProfile, openDeleteConfirm, openResume, shareOpen, isAdmin }) {
  return (
    <tr className="hover:bg-blue-50/50 transition-colors">

      {/* Applicant cell */}
      <td className="px-2 py-1.5 align-top">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => openViewProfile(c)}
              className="font-semibold text-slate-800 text-xs hover:text-blue-600 text-left transition-colors"
            >
              {c.full_name?.toUpperCase()}
            </button>
            <div className="flex flex-col gap-0 text-slate-500 text-xs leading-[1.25]">
              <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5 text-slate-400" /> {c.phone || '—'}</span>
              <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5 text-slate-400" /> {c.email}</span>
              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-slate-400" /> {c.location || '—'}</span>
              <span className="flex items-center gap-1"><Briefcase className="w-2.5 h-2.5 text-slate-400" /> {c.total_experience_years ? `${c.total_experience_years} Yrs` : '—'}</span>
            </div>
            {/* Tags display */}
            {c.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {c.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {/* Action icons */}
            <div className="flex items-center gap-2 text-slate-400">
              <button onClick={() => openResume(c)} className="hover:text-blue-600 transition-colors" title="View Resume"><FileText className="w-3.5 h-3.5" /></button>
              <button onClick={() => openModal('note', c)} className="hover:text-blue-600 transition-colors" title="Add Note"><MessageSquarePlus className="w-3.5 h-3.5" /></button>
              <button onClick={() => openModal('edit', c)} className="hover:text-blue-600 transition-colors" title="Edit Profile"><Edit className="w-3.5 h-3.5" /></button>
              <button onClick={() => openDeleteConfirm(c)} className="hover:text-rose-600 transition-colors" title="Delete Candidate"><Trash2 className="w-3.5 h-3.5" /></button>
              {/* Share */}
              <button onClick={(e) => openShare(e, shareOpen === c.id ? null : c.id)} className="hover:text-blue-600 transition-colors" title="Share Profile"><Share2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </td>

      {/* Job Applied */}
      <td className="px-2 py-1.5 align-top">
        {c.current_job ? (
          <div className="flex flex-col text-xs">
            <span className="text-slate-700">{c.current_job.title}</span>
            <span className="text-slate-500">({c.current_job.job_code})</span>
          </div>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>

      {/* Status */}
      <td className="px-2 py-1.5 align-top">
        {c.current_stage ? (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[c.current_stage] || 'bg-slate-100 text-slate-600'}`}>
            {STAGE_LABELS[c.current_stage] || c.current_stage}
          </span>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>

      {/* Source */}
      <td className="px-2 py-1.5 align-top">
        <span className="text-slate-700 font-medium text-xs">
          {SOURCE_LABELS[c.source] || c.source || '—'}
        </span>
      </td>

      {/* Date Added */}
      <td className="px-3 py-1.5 align-top text-slate-600 text-xs">
        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '—'}
      </td>

      {/* Actions */}
      <td className="px-2 py-1.5 align-top text-center">
        {isAdmin ? (
          <button
            onClick={() => openModal('move', c)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-xs font-medium transition-colors shadow-sm"
          >
            Move
          </button>
        ) : (
          <span className="flex items-center justify-center gap-1 text-xs text-slate-400" title="Only admins can move candidates">
            <ShieldOff className="w-3 h-3" /> Admin only
          </span>
        )}
      </td>
    </tr>
  );
}
