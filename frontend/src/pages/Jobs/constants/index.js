export const SOURCE_LABELS = {
  recruiter_upload: 'Recruiter Upload',
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  manual: 'Manual',
};

export const STAGE_LABELS = {
  APPLIED:     'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW:   'Interview',
  OFFERED:     'Offered',
  JOINED:      'Joined',
  DROPPED:     'Dropped',
};

export const STAGE_COLORS = {
  APPLIED:     'bg-amber-100 text-amber-700',
  SHORTLISTED: 'bg-blue-100 text-blue-700',
  INTERVIEW:   'bg-purple-100 text-purple-700',
  OFFERED:     'bg-cyan-100 text-cyan-700',
  JOINED:      'bg-green-100 text-green-700',
  DROPPED:     'bg-rose-100 text-rose-700',
};

export const STAGE_ORDER = { APPLIED: 0, SHORTLISTED: 1, INTERVIEW: 2, OFFERED: 3, JOINED: 4, DROPPED: 5 };

export const SCREENING_STATUS_LABELS = {
  SCREENED: 'Screened',
  MAYBE: 'Maybe',
  REJECTED: 'Rejected',
};

export const SCREENING_STATUS_COLORS = {
  SCREENED: 'bg-green-100 text-green-700',
  MAYBE: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

export const ROUND_LABELS = { R1: 'R1', R2: 'R2', R3: 'R3', CLIENT: 'Client', CDO: 'CDO', MGMT: 'Mgmt' };
export const ROUND_PROGRESSION = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT'];

export const DROP_REASON_LABELS = {
  REJECTED: 'Rejected', CANDIDATE_DROP: 'Candidate Drop', NO_SHOW: 'No Show',
};

export const OFFER_STATUS_LABELS = {
  OFFER_SENT: 'Offer Sent', OFFER_ACCEPTED: 'Offer Accepted', OFFER_DECLINED: 'Offer Declined',
};

export const PRIORITY_COLORS = {
  HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-slate-100 text-slate-500',
};

// Offered tab covers OFFERED + JOINED + DROPPED (rendered as three sections).
export const STAGE_TAB_MAP = {
  Applied:     'APPLIED',
  Shortlisted: 'SHORTLISTED',
  Interview:   'INTERVIEW',
  Offered:     'OFFERED',
};

export const PIPELINE_TABS = ['Applied', 'Shortlisted', 'Interview', 'Offered'];

export const SHORTLIST_REASONS = [
  'Strong relevant experience',
  'Good skill match',
  'Positive interview feedback',
  'Cultural fit',
  'Meets key job requirements',
];

export const APPLIED_REJECT_REASONS = [
  'Lack of required experience',
  'Skill mismatch',
  'Not a cultural fit',
  'Salary expectations too high',
  'Incomplete profile / missing information',
];
