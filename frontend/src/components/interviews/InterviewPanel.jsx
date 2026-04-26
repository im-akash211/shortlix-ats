import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/authContext';
import { interviews as interviewsApi } from '../../lib/api';

import InterviewHeader from './InterviewHeader';
import InterviewActions from './InterviewActions';
import InterviewDetails from './InterviewDetails';
import InterviewTimeline from './InterviewTimeline';
import InterviewFeedbackSection from './InterviewFeedbackSection';
import CandidateSnapshot from './CandidateSnapshot';
import InterviewEditModal from './InterviewEditModal';

export default function InterviewPanel({ interview, allInterviews, onClose, onCancelRequest }) {
  const { user } = useAuth();
  const role = user?.role;
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data: feedbackData, refetch: refetchFeedback } = useQuery({
    queryKey: ['interview-feedback', interview.id],
    queryFn: () => interviewsApi.getFeedback(interview.id),
    enabled: !!interview.has_feedback,
    retry: false,
  });

  useEffect(() => {
    if (feedbackData) setFeedback(feedbackData);
  }, [feedbackData]);

  const handleFeedbackSaved = () => {
    refetchFeedback();
    queryClient.invalidateQueries({ queryKey: ['interviews'] });
  };

  // Interviews for the same candidate-job mapping (for timeline)
  const siblingInterviews = allInterviews?.filter(
    (iv) => iv.mapping === interview.mapping
  ) ?? [interview];

  const isCompleted = interview.computed_status === 'COMPLETED' || interview.status === 'completed';
  const canEdit = (role === 'admin' || role === 'recruiter') && !isCompleted;

  // Permission derivations for feedback
  const isMyInterview = interview.interviewer === user?.id;
  const canCreateFeedback = role === 'admin' || (role === 'interviewer' && isMyInterview);
  const canEditFeedback   = canCreateFeedback;
  const canDeleteFeedback = canCreateFeedback;

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div className="flex-1 bg-slate-900/40" onClick={onClose} />

        {/* Panel */}
        <div className="w-[440px] bg-white shadow-2xl flex flex-col overflow-hidden">
          {/* Sticky header */}
          <InterviewHeader
            interview={interview}
            onClose={onClose}
            canEdit={canEdit}
            onEditClick={() => setIsEditing(true)}
          />

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <InterviewActions
              interview={interview}
              role={role}
              hasFeedback={!!interview.has_feedback || !!feedback}
              onCancelClick={onCancelRequest}
              onEditClick={() => setIsEditing(true)}
            />

            <CandidateSnapshot interview={interview} />
            <InterviewDetails interview={interview} />

            {siblingInterviews.length > 0 && (
              <InterviewTimeline
                interviews={siblingInterviews}
                currentInterviewId={interview.id}
              />
            )}

            <InterviewFeedbackSection
              interview={interview}
              feedback={interview.has_feedback ? (feedback ?? feedbackData ?? null) : null}
              canCreate={canCreateFeedback}
              canEdit={canEditFeedback}
              canDelete={canDeleteFeedback}
              onFeedbackSaved={handleFeedbackSaved}
            />
          </div>
        </div>
      </div>

      {/* Edit modal — rendered above the panel (z-[60]) */}
      {isEditing && (
        <InterviewEditModal
          interview={interview}
          onClose={() => setIsEditing(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['interviews'] })}
        />
      )}
    </>
  );
}
