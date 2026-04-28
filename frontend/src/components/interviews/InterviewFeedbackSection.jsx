import { useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { interviews as interviewsApi } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';

const DECISION_CONFIG = {
  PASS:    { label: 'Pass',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
  FAIL:    { label: 'Fail',    bg: 'bg-rose-100',    text: 'text-rose-700'    },
  ON_HOLD: { label: 'On Hold', bg: 'bg-amber-100',   text: 'text-amber-700'   },
};

// Legacy recommendation map for backward compat display
const REC_CONFIG = {
  proceed: { label: 'Proceed', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  hold:    { label: 'Hold',    bg: 'bg-amber-100',   text: 'text-amber-700'   },
  reject:  { label: 'Reject',  bg: 'bg-rose-100',    text: 'text-rose-700'    },
};

function StarDisplay({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-3.5 h-3.5 fill-current ${n <= value ? 'text-amber-400' : 'text-slate-200'}`} />
      ))}
    </div>
  );
}

function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`transition-colors ${n <= value ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  );
}

export default function InterviewFeedbackSection({ interview, feedback, canCreate, canEdit, canDelete, onFeedbackSaved }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    decision: '',
    recommendation: '',
    overall_rating: 0,
    strengths: '',
    concerns: '',
    comments: '',
  });

  const endTime = interview.end_time
    ? new Date(interview.end_time)
    : new Date(new Date(interview.scheduled_at).getTime() + (interview.duration_minutes || 60) * 60000);
  const isCompleted = endTime < new Date() || interview.computed_status === 'COMPLETED';

  if (!isCompleted) return null;

  const startCreate = () => {
    setForm({ decision: '', recommendation: '', overall_rating: 0, strengths: '', concerns: '', comments: '' });
    setEditing(true);
  };

  const startEdit = () => {
    setForm({
      decision: feedback.decision || '',
      recommendation: feedback.recommendation || '',
      overall_rating: feedback.overall_rating || 0,
      strengths: feedback.strengths || '',
      concerns: feedback.concerns || feedback.weaknesses || '',
      comments: feedback.comments || '',
    });
    setEditing(true);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this feedback? This cannot be undone.')) return;
    setLoading('delete');
    try {
      await interviewsApi.deleteFeedback(interview.id);
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['interview-feedback', interview.id] });
      onFeedbackSaved?.();
    } catch (err) {
      alert(err.data?.detail || 'Failed to delete feedback.');
    } finally {
      setLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.decision) {
      alert('Please select a decision (Pass / Fail / On Hold).');
      return;
    }
    if (!form.overall_rating) {
      alert('Please provide a rating.');
      return;
    }
    setLoading(true);
    try {
      if (feedback) {
        await interviewsApi.updateFeedback(interview.id, form);
      } else {
        await interviewsApi.submitFeedback(interview.id, {
          ...form,
          weaknesses: form.concerns,
        });
      }
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      onFeedbackSaved?.();
    } catch (err) {
      alert(err.data?.detail || 'Failed to save feedback.');
    } finally {
      setLoading(false);
    }
  };

  if (editing) {
    return (
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          {feedback ? 'Edit Feedback' : 'Submit Feedback'}
        </p>
        <div className="flex flex-col gap-4">
          {/* Decision */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Decision</label>
            <div className="flex gap-2">
              {Object.entries(DECISION_CONFIG).map(([val, cfg]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, decision: val }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                    form.decision === val
                      ? `${cfg.bg} ${cfg.text} border-current`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rating *</label>
            <StarInput value={form.overall_rating} onChange={(n) => setForm((f) => ({ ...f, overall_rating: n }))} />
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Strengths</label>
            <textarea
              value={form.strengths}
              onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))}
              rows={2}
              placeholder="What went well…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 resize-none"
            />
          </div>

          {/* Concerns */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Concerns</label>
            <textarea
              value={form.concerns}
              onChange={(e) => setForm((f) => ({ ...f, concerns: e.target.value }))}
              rows={2}
              placeholder="Areas of concern…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
            <textarea
              value={form.comments}
              onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
              rows={2}
              placeholder="Additional notes…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-medium"
            >
              {loading ? 'Saving…' : 'Save Feedback'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (feedback) {
    const decisionCfg = DECISION_CONFIG[feedback.decision] || REC_CONFIG[feedback.recommendation];
    return (
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Feedback</p>
          <div className="flex items-center gap-3">
            {canEdit && (
              <button onClick={startEdit} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={loading === 'delete'}
                className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {loading === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          {decisionCfg && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${decisionCfg.bg} ${decisionCfg.text}`}>
              {decisionCfg.label}
            </span>
          )}
          <StarDisplay value={feedback.overall_rating} />
        </div>
        {feedback.strengths && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Strengths</p>
            <p className="text-xs text-slate-600">{feedback.strengths}</p>
          </div>
        )}
        {(feedback.concerns || feedback.weaknesses) && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Concerns</p>
            <p className="text-xs text-slate-600">{feedback.concerns || feedback.weaknesses}</p>
          </div>
        )}
        {feedback.comments && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Notes</p>
            <p className="text-xs text-slate-600">{feedback.comments}</p>
          </div>
        )}
      </div>
    );
  }

  // No feedback yet
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Feedback</p>
      {canCreate ? (
        <button
          onClick={startCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium"
        >
          Add Feedback
        </button>
      ) : (
        <p className="text-slate-400 text-xs">No feedback submitted yet.</p>
      )}
    </div>
  );
}
