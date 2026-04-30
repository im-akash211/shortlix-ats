import { MapPin, Phone, Mail, Briefcase } from 'lucide-react';

export default function CandidateSnapshot({ interview, onViewProfile }) {
  const skills = interview.candidate_skills?.slice(0, 5) ?? [];

  return (
    <div className="px-5 py-4 border-b border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Candidate</p>
      <div className="flex flex-col gap-1.5 text-sm text-slate-600">
        {interview.candidate_phone && (
          <span className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {interview.candidate_phone}
          </span>
        )}
        {interview.candidate_email && (
          <span className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {interview.candidate_email}
          </span>
        )}
        {interview.candidate_location && (
          <span className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {interview.candidate_location}
          </span>
        )}
        {interview.candidate_experience != null && (
          <span className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {interview.candidate_experience} yrs experience
          </span>
        )}
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {skills.map((s) => (
            <span key={s} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}
      {onViewProfile && (
        <button
          onClick={onViewProfile}
          className="mt-3 text-xs text-blue-600 hover:underline font-medium"
        >
          View full profile →
        </button>
      )}
    </div>
  );
}
