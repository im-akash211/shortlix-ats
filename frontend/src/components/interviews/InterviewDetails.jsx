import { Video, Phone, Users, Clock, Link, FileText } from 'lucide-react';

const MODE_LABELS = { virtual: 'Virtual', phone: 'Phone Call', face_to_face: 'Face-to-Face' };
const MODE_ICONS  = { virtual: Video, phone: Phone, face_to_face: Users };

const ROUND_LABELS = {
  R1: 'Round 1', R2: 'Round 2', R3: 'Round 3',
  CLIENT: 'Client Round', CDO: 'CDO Round', MGMT: 'Management Round',
};

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <span className="text-slate-400 text-xs">{label} </span>
        <span className="text-slate-700">{value}</span>
      </div>
    </div>
  );
}

export default function InterviewDetails({ interview }) {
  const ModeIcon = MODE_ICONS[interview.mode] || Video;
  const roundLabel = ROUND_LABELS[interview.round_name] || interview.round_label;

  return (
    <div className="px-5 py-4 border-b border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Interview Details</p>
      <div className="flex flex-col gap-2.5">
        <Row icon={FileText} label="Round:" value={roundLabel} />
        <Row icon={ModeIcon} label="Type:" value={MODE_LABELS[interview.mode] || interview.mode} />
        <Row icon={Clock}    label="Duration:" value={`${interview.duration_minutes} minutes`} />
        <Row icon={Users}    label="Interviewer:" value={interview.interviewer_name} />
        {interview.meeting_link && (
          <div className="flex items-start gap-2 text-sm">
            <Link className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-400 text-xs">Meeting: </span>
              <a
                href={interview.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs break-all"
              >
                {interview.meeting_link}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
