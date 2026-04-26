export const SOURCE_LABELS = {
  recruiter_upload: 'Recruiter Upload',
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  manual: 'Manual',
};

export const STAGE_LABELS = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  on_hold: 'On Hold',
  selected: 'Selected',
  rejected: 'Rejected',
  offered: 'Offered',
  joined: 'Joined',
};

export const STAGE_COLORS = {
  pending:     'bg-amber-100 text-amber-700',
  shortlisted: 'bg-blue-100 text-blue-700',
  interview:   'bg-purple-100 text-purple-700',
  on_hold:     'bg-slate-100 text-slate-600',
  selected:    'bg-emerald-100 text-emerald-700',
  rejected:    'bg-rose-100 text-rose-700',
  offered:     'bg-cyan-100 text-cyan-700',
  joined:      'bg-green-100 text-green-700',
};

export const EMPTY_FILTERS = {
  source: [], stage: [], job: '',
  exp_min: '', exp_max: '',
  date_from: '', date_to: '',
};

export const BLANK_REVIEW = {
  first_name: '', last_name: '', email: '', phone: '',
  designation: '', current_company: '', experience_years: '',
  expected_ctc_lakhs: '',
  skills: [], education: [],
};
