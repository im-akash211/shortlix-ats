# Interview Rounds Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Interview stage to support flexible multi-round workflows with explicit scheduling, on-hold status, in-tab rejection (no auto-drop), and reschedule-from-rejection flow.

**Architecture:** Add `interview_status` to `CandidateJobMapping` (mirrors `screening_status` pattern); add R3 to round choices; change `NextRoundView`/`JumpToRoundView` to only advance the round pointer without auto-creating Interview records; add a `SetRoundStatusView` endpoint; change `SetRoundResultView` FAIL path to set `interview_status=REJECTED` instead of auto-dropping; update frontend with scheduling modal, filter bar, and state-driven action bar.

**Tech Stack:** Django REST Framework, PostgreSQL, React 18, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `backend/apps/candidates/models.py` | Add R3 to `ROUND_CHOICES`/`ROUND_PROGRESSION`; add `interview_status` field |
| `backend/apps/candidates/migrations/0009_interview_status.py` | Auto-generated migration |
| `backend/apps/candidates/serializers.py` | Add `interview_status` to `CandidateJobMappingSerializer` |
| `backend/apps/candidates/views.py` | Rewrite `NextRoundView`, `JumpToRoundView`; update `perform_create` in `InterviewListCreateView` via signal or override |
| `backend/apps/interviews/views.py` | Add `SetRoundStatusView`; change `SetRoundResultView` FAIL path; update `InterviewListCreateView.perform_create` |
| `backend/apps/interviews/urls.py` | Register `SetRoundStatusView` |
| `frontend/src/lib/api.js` | Add `interviews.setRoundStatus()` |
| `frontend/src/pages/Jobs.jsx` | Add R3 constants, `interviewFilter`, scheduling modal, state-driven action bar, rejected card UI |

---

## Task 1: Add R3 to round constants and `interview_status` to model

**Files:**
- Modify: `backend/apps/candidates/models.py`

- [ ] **Step 1: Add R3 to ROUND_CHOICES and ROUND_PROGRESSION**

  In `backend/apps/candidates/models.py`, replace the `ROUND_CHOICES` and `ROUND_PROGRESSION` blocks:

  ```python
  ROUND_CHOICES = [
      ('R1', 'Round 1'),
      ('R2', 'Round 2'),
      ('R3', 'Round 3'),
      ('CLIENT', 'Client Round'),
      ('CDO', 'CDO Round'),
      ('MGMT', 'Management Round'),
  ]

  # Ordered progression for guided next-round flow
  ROUND_PROGRESSION = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT']
  ```

- [ ] **Step 2: Add `interview_status` field to `CandidateJobMapping`**

  In the `CandidateJobMapping` model, after the `screening_status` field, add:

  ```python
  # Interview rejection status — null means active, REJECTED means failed a round (stays in Interview tab)
  interview_status = models.CharField(
      max_length=20,
      choices=[('REJECTED', 'Rejected')],
      null=True,
      blank=True,
  )
  ```

- [ ] **Step 3: Generate migration**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py makemigrations candidates --name interview_status
  ```

  Expected: `Migrations for 'candidates': apps/candidates/migrations/0009_interview_status.py`

  Open the file and confirm it has one `AlterField` for `current_interview_round` (new R3 choice) and one `AddField` for `interview_status`.

- [ ] **Step 4: Run migration**

  ```bash
  python manage.py migrate candidates
  ```

  Expected: `Applying candidates.0009_interview_status... OK`

- [ ] **Step 5: Django check**

  ```bash
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

  ```bash
  git add backend/apps/candidates/models.py backend/apps/candidates/migrations/0009_interview_status.py
  git commit -m "feat: add R3 to ROUND_CHOICES and interview_status field to CandidateJobMapping"
  ```

---

## Task 2: Expose `interview_status` in serializer

**Files:**
- Modify: `backend/apps/candidates/serializers.py`

- [ ] **Step 1: Add `interview_status` to `CandidateJobMappingSerializer.Meta.fields`**

  In `backend/apps/candidates/serializers.py`, add `'interview_status'` after `'screening_status'`:

  ```python
  class Meta:
      model = CandidateJobMapping
      fields = [
          'id', 'candidate', 'job',
          'macro_stage', 'offer_status', 'drop_reason',
          'current_interview_round', 'next_interview_date', 'priority',
          'screening_status',
          'interview_status',
          # Audit
          'moved_by', 'stage_updated_at', 'created_at',
          # Denormalised candidate fields
          'candidate_name', 'candidate_email', 'candidate_phone',
          'candidate_location', 'candidate_experience', 'candidate_skills',
          'candidate_designation',
          # Denormalised job fields
          'job_title', 'job_code',
      ]
      read_only_fields = ['id', 'moved_by', 'stage_updated_at', 'created_at']
  ```

- [ ] **Step 2: Django check**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Commit**

  ```bash
  git add backend/apps/candidates/serializers.py
  git commit -m "feat: expose interview_status in CandidateJobMappingSerializer"
  ```

---

## Task 3: Rewrite `NextRoundView` and `JumpToRoundView` — round pointer only, no auto-scheduling

**Files:**
- Modify: `backend/apps/candidates/views.py`

- [ ] **Step 1: Rewrite `NextRoundView`**

  In `backend/apps/candidates/views.py`, replace the entire `NextRoundView` class (lines ~195–256) with:

  ```python
  class NextRoundView(APIView):
      """
      POST /candidates/{pk}/jobs/{job_id}/interview/next-round/

      Advances current_interview_round to the next in ROUND_PROGRESSION.
      Does NOT create an Interview record — scheduling is a separate step.
      Guard: the latest Interview for the current round must be COMPLETED.
      """

      def post(self, request, pk, job_id):
          mapping = generics.get_object_or_404(
              CandidateJobMapping, candidate_id=pk, job_id=job_id
          )
          if mapping.macro_stage != 'INTERVIEW':
              return Response(
                  {'error': 'Candidate must be in INTERVIEW stage'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          current_round = mapping.current_interview_round or 'R1'
          if current_round not in ROUND_PROGRESSION:
              return Response(
                  {'error': f'Invalid current round: {current_round}'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          # Guard: current round must be completed before advancing
          from apps.interviews.models import Interview
          latest = mapping.interviews.filter(round_name=current_round).order_by('-created_at').first()
          if not latest or latest.round_status != 'COMPLETED':
              return Response(
                  {'error': f'Round {current_round} must be completed before advancing to the next round'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          idx = ROUND_PROGRESSION.index(current_round)
          if idx >= len(ROUND_PROGRESSION) - 1:
              return Response(
                  {'error': 'Final round (MGMT) already reached. Cannot advance further.'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          next_round = ROUND_PROGRESSION[idx + 1]
          mapping.current_interview_round = next_round
          mapping.moved_by = request.user
          mapping.save(update_fields=['current_interview_round', 'moved_by', 'stage_updated_at'])
          return Response(CandidateJobMappingSerializer(mapping).data)
  ```

- [ ] **Step 2: Rewrite `JumpToRoundView`**

  Replace the entire `JumpToRoundView` class (lines ~259–295) with:

  ```python
  class JumpToRoundView(APIView):
      """
      POST /candidates/{pk}/jobs/{job_id}/interview/jump-round/

      Body: { "round_name": "R3" | "CLIENT" | ... }

      Jumps to any round without completion guard (explicit skip intent).
      Does NOT create an Interview record — scheduling is a separate step.
      """

      def post(self, request, pk, job_id):
          round_name = request.data.get('round_name')
          valid_rounds = [r[0] for r in ROUND_CHOICES]

          if not round_name:
              return Response({'error': 'round_name is required'}, status=status.HTTP_400_BAD_REQUEST)
          if round_name not in valid_rounds:
              return Response(
                  {'error': f'round_name must be one of {valid_rounds}'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          mapping = generics.get_object_or_404(
              CandidateJobMapping, candidate_id=pk, job_id=job_id
          )
          if mapping.macro_stage != 'INTERVIEW':
              return Response(
                  {'error': 'Candidate must be in INTERVIEW stage'},
                  status=status.HTTP_400_BAD_REQUEST,
              )
          if mapping.current_interview_round == round_name:
              return Response(
                  {'error': f'Candidate is already in round {round_name}'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          mapping.current_interview_round = round_name
          mapping.moved_by = request.user
          mapping.save(update_fields=['current_interview_round', 'moved_by', 'stage_updated_at'])
          return Response(CandidateJobMappingSerializer(mapping).data)
  ```

  Also delete the `_create_interview_and_advance` static method and `_default_scheduled_at` helper — they are no longer used.

- [ ] **Step 3: Django check**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/apps/candidates/views.py
  git commit -m "refactor: NextRoundView and JumpToRoundView no longer auto-create Interview records"
  ```

---

## Task 4: Add `SetRoundStatusView`; change `SetRoundResultView` FAIL path; update `InterviewListCreateView.perform_create`

**Files:**
- Modify: `backend/apps/interviews/views.py`
- Modify: `backend/apps/interviews/urls.py`

- [ ] **Step 1: Add `SetRoundStatusView` to `views.py`**

  At the end of `backend/apps/interviews/views.py`, add:

  ```python
  class SetRoundStatusView(APIView):
      """
      PATCH /interviews/{pk}/round-status/

      Body: { "round_status": "SCHEDULED" | "ON_HOLD" | "COMPLETED" }

      Updates Interview.round_status. No strict transition enforcement.
      """
      permission_classes = [IsAuthenticated]

      VALID_STATUSES = {'SCHEDULED', 'ON_HOLD', 'COMPLETED'}

      def patch(self, request, pk):
          round_status = request.data.get('round_status')
          if round_status not in self.VALID_STATUSES:
              return Response(
                  {'error': f'round_status must be one of {sorted(self.VALID_STATUSES)}'},
                  status=status.HTTP_400_BAD_REQUEST,
              )
          interview = generics.get_object_or_404(Interview, pk=pk)
          interview.round_status = round_status
          interview.save(update_fields=['round_status'])
          return Response(InterviewListSerializer(interview).data)
  ```

- [ ] **Step 2: Change `SetRoundResultView` FAIL path**

  In `backend/apps/interviews/views.py`, replace the `if round_result == 'FAIL':` block (lines ~137–152) with:

  ```python
  if round_result == 'FAIL':
      from apps.candidates.models import PipelineStageHistory
      mapping.interview_status = 'REJECTED'
      mapping.save(update_fields=['interview_status'])
      response_data['auto_rejected'] = True

  elif round_result == 'PASS':
      response_data['suggest_move_to_offered'] = True
  ```

  Also remove the old `elif round_result == 'PASS' and interview.round_name == 'MGMT':` check — Make Offer is now available after any completed round.

- [ ] **Step 3: Update `InterviewListCreateView.perform_create` to handle reschedule**

  Replace `perform_create` in `InterviewListCreateView`:

  ```python
  def perform_create(self, serializer):
      interview = serializer.save(created_by=self.request.user)
      # If candidate was REJECTED in Interview stage, clear rejection on reschedule
      mapping = interview.mapping
      if (
          mapping.macro_stage == 'INTERVIEW'
          and mapping.interview_status == 'REJECTED'
          and interview.round_name
      ):
          mapping.interview_status = None
          mapping.current_interview_round = interview.round_name
          mapping.moved_by = self.request.user
          mapping.save(update_fields=['interview_status', 'current_interview_round', 'moved_by', 'stage_updated_at'])
  ```

- [ ] **Step 4: Register `SetRoundStatusView` in URLs**

  In `backend/apps/interviews/urls.py`, add the import and URL:

  ```python
  from .views import (
      InterviewListCreateView, InterviewDetailView, InterviewCancelView,
      InterviewFeedbackCreateView, InterviewFeedbackDetailView, InterviewSummaryView,
      SetRoundResultView, SetRoundStatusView,
  )

  # Add to urlpatterns:
  path('<uuid:pk>/round-status/', SetRoundStatusView.as_view(), name='interview-round-status'),
  ```

- [ ] **Step 5: Django check**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

  ```bash
  git add backend/apps/interviews/views.py backend/apps/interviews/urls.py
  git commit -m "feat: add SetRoundStatusView, change FAIL to set interview_status=REJECTED, handle reschedule in perform_create"
  ```

---

## Task 5: Add `interviews.setRoundStatus` to frontend API

**Files:**
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: Add the method**

  In `frontend/src/lib/api.js`, inside the `interviews` object, after `setRoundResult`, add:

  ```javascript
  setRoundStatus: (id, roundStatus) =>
    request(`/interviews/${id}/round-status/`, {
      method: 'PATCH',
      body: JSON.stringify({ round_status: roundStatus }),
    }),
  ```

- [ ] **Step 2: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/lib/api.js
  git commit -m "feat: add interviews.setRoundStatus API method"
  ```

---

## Task 6: Frontend — constants, state, filter bar, and `interview_status` badge

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Update `ROUND_LABELS` and `ROUND_PROGRESSION` constants**

  Find the `ROUND_LABELS` and `ROUND_PROGRESSION` constants near the top of `Jobs.jsx` and replace:

  ```javascript
  const ROUND_LABELS = { R1: 'R1', R2: 'R2', R3: 'R3', CLIENT: 'Client', CDO: 'CDO', MGMT: 'Mgmt' };
  const ROUND_PROGRESSION = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT'];
  ```

- [ ] **Step 2: Add new state variables**

  In the state declarations block, add:

  ```javascript
  const [interviewFilter, setInterviewFilter] = useState('ALL');
  const [scheduleModalCandidate, setScheduleModalCandidate] = useState(null);
  const [scheduleModalRound, setScheduleModalRound] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ interviewer: '', scheduled_at: '', mode: 'virtual', meeting_link: '' });
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [roundStatusLoadingId, setRoundStatusLoadingId] = useState(null);
  ```

- [ ] **Step 3: Reset `interviewFilter` on tab change, drawer close, and in `openJobDetails`**

  Find every place `setScreeningFilter('ALL')` is called (tab onClick, backdrop onClick, X-button onClick, `openJobDetails`). Add `setInterviewFilter('ALL')` alongside each of those calls.

- [ ] **Step 4: Add filter bar JSX for Interview tab**

  Find the screening filter bar block:
  ```jsx
  {pipelineTab === 'Applied' && (
    <div className="px-4 py-2 border-b border-slate-100 ...">
  ```

  After it, add:

  ```jsx
  {pipelineTab === 'Interview' && (
    <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center gap-2">
      <span className="text-xs text-slate-500 font-medium">Filter:</span>
      <select
        value={interviewFilter}
        onChange={(e) => setInterviewFilter(e.target.value)}
        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
      >
        <option value="ALL">All</option>
        <option value="R1">R1</option>
        <option value="R2">R2</option>
        <option value="R3">R3</option>
        <option value="CLIENT">Client</option>
        <option value="CDO">CDO</option>
        <option value="MGMT">MGMT</option>
        <option value="ON_HOLD">On Hold</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>
  )}
  ```

- [ ] **Step 5: Apply interview filter to `activeCandidates` derivation**

  Find the `activeCandidates` derivation (which already has the `screeningFilter` logic). Add the interview filter after it:

  ```javascript
  const activeCandidates = allCandidates
    .filter(c => c.macro_stage === currentStage)
    .filter(c =>
      pipelineTab !== 'Applied' || screeningFilter === 'ALL' || c.screening_status === screeningFilter
    )
    .filter(c => {
      if (pipelineTab !== 'Interview' || interviewFilter === 'ALL') return true;
      if (interviewFilter === 'REJECTED') return c.interview_status === 'REJECTED';
      if (interviewFilter === 'ON_HOLD') return c.latest_round?.round_status === 'ON_HOLD';
      return c.current_interview_round === interviewFilter;
    });
  ```

- [ ] **Step 6: Add rejected badge to `renderCandidateCard`**

  Inside `renderCandidateCard`, in the top badge area where the round pill is shown (find the block starting with `{macroStage === 'INTERVIEW' && c.current_interview_round && ...}`). After that block, add the rejected badge:

  ```jsx
  {macroStage === 'INTERVIEW' && c.interview_status === 'REJECTED' && (
    <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
      Rejected
    </span>
  )}
  ```

- [ ] **Step 7: Add rejected metadata row in `renderCandidateCard`**

  Find the Interview metadata row (the block showing `{macroStage === 'INTERVIEW' && c.latest_round && ...}`). Replace it with:

  ```jsx
  {macroStage === 'INTERVIEW' && c.interview_status === 'REJECTED' && c.latest_round && (
    <span className="text-xs text-slate-500">
      {ROUND_LABELS[c.latest_round.round_name] || c.latest_round.round_name}
      {' · Rejected'}
      {c.latest_round.scheduled_at && (
        <span className="text-slate-400">
          {' · '}{new Date(c.latest_round.scheduled_at).toLocaleDateString()}
        </span>
      )}
    </span>
  )}
  {macroStage === 'INTERVIEW' && c.interview_status !== 'REJECTED' && c.latest_round && (
    <span className="text-xs text-slate-500">
      {ROUND_LABELS[c.latest_round.round_name] || c.latest_round.round_name}
      {c.latest_round.round_status && (
        <span className="text-slate-400"> · {c.latest_round.round_status}</span>
      )}
    </span>
  )}
  ```

- [ ] **Step 8: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 9: Commit**

  ```bash
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: interview filter bar, R3 constants, and rejected badge"
  ```

---

## Task 7: Frontend — Scheduling modal

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add `handleScheduleSubmit` handler**

  Near the other action handlers (e.g., `handleNextRound`), add:

  ```javascript
  const handleScheduleSubmit = async () => {
    if (!scheduleForm.interviewer || !scheduleForm.scheduled_at) {
      alert('Interviewer and date/time are required');
      return;
    }
    setScheduleSubmitting(true);
    try {
      await interviewsApi.create({
        mapping: scheduleModalCandidate.id,
        round_name: scheduleModalRound,
        round_status: 'SCHEDULED',
        interviewer: scheduleForm.interviewer,
        scheduled_at: scheduleForm.scheduled_at,
        mode: scheduleForm.mode,
        meeting_link: scheduleForm.meeting_link || '',
      });
      await refreshAllCandidates(viewingJob.id);
      setScheduleModalCandidate(null);
      setScheduleModalRound(null);
      setScheduleForm({ interviewer: '', scheduled_at: '', mode: 'virtual', meeting_link: '' });
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to schedule interview');
    } finally {
      setScheduleSubmitting(false);
    }
  };
  ```

  Note: `interviewsApi` is the `interviews` export from `api.js`. Check how it is imported/aliased at the top of `Jobs.jsx` and use the same alias.

- [ ] **Step 2: Add the scheduling modal JSX**

  Find the Drop Candidate modal (`{dropModalCandidate && ...}`). After it, add the scheduling modal:

  ```jsx
  {scheduleModalCandidate && (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[400]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Schedule {ROUND_LABELS[scheduleModalRound] || scheduleModalRound} Interview
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date &amp; Time *</label>
            <input
              type="datetime-local"
              value={scheduleForm.scheduled_at}
              onChange={(e) => setScheduleForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
            <select
              value={scheduleForm.mode}
              onChange={(e) => setScheduleForm(f => ({ ...f, mode: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="virtual">Virtual</option>
              <option value="phone">Phone</option>
              <option value="face_to_face">In-person</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Meeting Link</label>
            <input
              type="url"
              placeholder="https://..."
              value={scheduleForm.meeting_link}
              onChange={(e) => setScheduleForm(f => ({ ...f, meeting_link: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => { setScheduleModalCandidate(null); setScheduleModalRound(null); }}
            className="text-sm px-4 py-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleScheduleSubmit}
            disabled={scheduleSubmitting}
            className="text-sm px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {scheduleSubmitting ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: add interview scheduling modal"
  ```

---

## Task 8: Frontend — State-driven Interview action bar

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add `handleRoundStatus` handler**

  Near the other action handlers, add:

  ```javascript
  const handleRoundStatus = async (interviewId, newStatus, candidateId) => {
    setRoundStatusLoadingId(candidateId);
    try {
      await interviewsApi.setRoundStatus(interviewId, newStatus);
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to update round status');
    } finally {
      setRoundStatusLoadingId(null);
    }
  };
  ```

- [ ] **Step 2: Replace the Interview action bar in `renderCandidateCard`**

  Find the current Interview action bar block:
  ```jsx
  {isActive && macroStage === 'INTERVIEW' && (
    <div className="flex items-center gap-2 mt-1 px-3 py-2 bg-purple-50 ...">
  ```

  Replace the entire block with the new state-driven version:

  ```jsx
  {isActive && macroStage === 'INTERVIEW' && (
    <div className="mt-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
      {/* REJECTED: reschedule from any round */}
      {c.interview_status === 'REJECTED' && (
        <div className="flex items-center gap-2">
          <select
            defaultValue={c.latest_round?.round_name || c.current_interview_round || 'R1'}
            id={`reschedule-round-${c.id}`}
            className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {ROUND_PROGRESSION.map(r => (
              <option key={r} value={r}>{ROUND_LABELS[r]}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const sel = document.getElementById(`reschedule-round-${c.id}`);
              setScheduleModalCandidate(c);
              setScheduleModalRound(sel ? sel.value : (c.latest_round?.round_name || c.current_interview_round || 'R1'));
            }}
            className="flex-1 text-xs font-semibold bg-rose-600 text-white rounded px-3 py-1.5 hover:bg-rose-700 transition-colors"
          >
            Reschedule Interview
          </button>
        </div>
      )}

      {/* No interview record yet — show Schedule button */}
      {!c.interview_status && !c.latest_round && (
        <button
          onClick={() => {
            setScheduleModalCandidate(c);
            setScheduleModalRound(c.current_interview_round || 'R1');
          }}
          className="w-full text-xs font-semibold bg-purple-600 text-white rounded px-3 py-1.5 hover:bg-purple-700 transition-colors"
        >
          Schedule {ROUND_LABELS[c.current_interview_round] || c.current_interview_round || 'R1'} Interview
        </button>
      )}

      {/* Round is SCHEDULED */}
      {!c.interview_status && c.latest_round?.round_status === 'SCHEDULED' && (
        <div className="flex items-center gap-2">
          <button
            disabled={roundStatusLoadingId === c.id}
            onClick={() => handleRoundStatus(c.latest_round_id, 'COMPLETED', c.id)}
            className="flex-1 text-xs font-semibold bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Mark as Completed
          </button>
          <button
            disabled={roundStatusLoadingId === c.id}
            onClick={() => handleRoundStatus(c.latest_round_id, 'ON_HOLD', c.id)}
            className="text-xs border border-slate-300 text-slate-600 rounded px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            On Hold
          </button>
        </div>
      )}

      {/* Round is ON_HOLD */}
      {!c.interview_status && c.latest_round?.round_status === 'ON_HOLD' && (
        <button
          disabled={roundStatusLoadingId === c.id}
          onClick={() => handleRoundStatus(c.latest_round_id, 'SCHEDULED', c.id)}
          className="w-full text-xs font-semibold bg-amber-600 text-white rounded px-3 py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          Resume
        </button>
      )}

      {/* Round is COMPLETED */}
      {!c.interview_status && c.latest_round?.round_status === 'COMPLETED' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setScheduleModalCandidate(c);
              setScheduleModalRound(c.current_interview_round || 'R1');
            }}
            className="text-xs font-semibold bg-purple-600 text-white rounded px-3 py-1.5 hover:bg-purple-700 transition-colors"
          >
            Move to Next Round
          </button>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                candidatesApi.jumpToRound(c.candidate, c.job, e.target.value)
                  .then(() => refreshAllCandidates(viewingJob.id))
                  .catch(err => alert(err.data?.error || 'Failed to jump round'));
              }
            }}
            className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
          >
            <option value="" disabled>Jump to round…</option>
            {ROUND_PROGRESSION.map(r => (
              <option key={r} value={r} disabled={r === c.current_interview_round}>
                {ROUND_LABELS[r]}{r === c.current_interview_round ? ' (current)' : ''}
              </option>
            ))}
          </select>
          {c.can_move_next && (
            <button
              onClick={() => handleMakeOffer(c)}
              disabled={shortlistingId === c.id}
              className="text-xs font-semibold bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {shortlistingId === c.id ? '…' : 'Make Offer'}
            </button>
          )}
        </div>
      )}
    </div>
  )}
  ```

  **Note:** The action bar uses `c.latest_round_id` for the round status update calls. The current `_get_latest_round()` in `JobPipelineView` returns a dict without the Interview ID. **Task 9 adds `latest_round_id` to the pipeline response.**

- [ ] **Step 3: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: state-driven Interview action bar with scheduling, on hold, and reschedule flows"
  ```

---

## Task 9: Expose `latest_round_id` in pipeline response

**Files:**
- Modify: `backend/apps/jobs/views.py`

The frontend action bar needs the Interview record's UUID to call `PATCH /interviews/{id}/round-status/`. Currently `_get_latest_round()` returns a dict without the `id`.

- [ ] **Step 1: Update `_get_latest_round` to include interview `id`**

  In `backend/apps/jobs/views.py`, find the `_get_latest_round` function (around lines 199–208):

  ```python
  def _get_latest_round(mapping):
      interview = mapping.interviews.order_by('-created_at').first()
      if not interview:
          return None
      return {
          'round_name': interview.round_name,
          'round_status': interview.round_status,
          'round_result': interview.round_result,
          'scheduled_at': interview.scheduled_at.isoformat() if interview.scheduled_at else None,
      }
  ```

  Replace with:

  ```python
  def _get_latest_round(mapping):
      interview = mapping.interviews.order_by('-created_at').first()
      if not interview:
          return None
      return {
          'id': str(interview.id),
          'round_name': interview.round_name,
          'round_status': interview.round_status,
          'round_result': interview.round_result,
          'scheduled_at': interview.scheduled_at.isoformat() if interview.scheduled_at else None,
      }
  ```

- [ ] **Step 2: Update frontend to use `c.latest_round.id` not `c.latest_round_id`**

  In `Jobs.jsx`, the action bar code in Task 8 used `c.latest_round_id`. Now that `id` is inside `latest_round`, update all occurrences of `c.latest_round_id` to `c.latest_round?.id`:

  Find:
  ```javascript
  handleRoundStatus(c.latest_round_id, 'COMPLETED', c.id)
  handleRoundStatus(c.latest_round_id, 'ON_HOLD', c.id)
  handleRoundStatus(c.latest_round_id, 'SCHEDULED', c.id)
  ```

  Replace each with:
  ```javascript
  handleRoundStatus(c.latest_round?.id, 'COMPLETED', c.id)
  handleRoundStatus(c.latest_round?.id, 'ON_HOLD', c.id)
  handleRoundStatus(c.latest_round?.id, 'SCHEDULED', c.id)
  ```

- [ ] **Step 3: Django check + frontend build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py check
  ```

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Both expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/apps/jobs/views.py frontend/src/pages/Jobs.jsx
  git commit -m "feat: expose latest_round.id in pipeline response for round-status updates"
  ```

---

## Verification Checklist

- [ ] R3 appears in round progression: moving to next round after R2 lands on R3
- [ ] Jumping directly to CLIENT skips R2/R3 with no error
- [ ] `NextRoundView` returns 400 if current round is not COMPLETED
- [ ] `JumpToRoundView` succeeds even if current round is not COMPLETED
- [ ] Moving to next round does NOT create an Interview record automatically
- [ ] "Schedule R1 Interview" button appears when candidate enters INTERVIEW with no Interview record
- [ ] Scheduling modal opens, submits, creates Interview record, card updates to show "Mark as Completed" + "On Hold"
- [ ] "Mark as Completed" sets `round_status=COMPLETED`; card shows "Move to Next Round", "Jump to Round", "Make Offer"
- [ ] "On Hold" sets `round_status=ON_HOLD`; card shows "Resume"
- [ ] "Resume" sets `round_status=SCHEDULED`; card reverts to "Mark as Completed" + "On Hold"
- [ ] "Make Offer" available after completing any round (R1, R2, R3, etc.)
- [ ] Setting `round_result=FAIL` sets `interview_status=REJECTED` — candidate stays in Interview tab, NOT in Dropped
- [ ] Rejected card shows round name + "Rejected" + date from latest_round
- [ ] Rejected card has round selector (pre-filled with rejected round) + "Reschedule Interview" button
- [ ] Rescheduling rejected candidate clears `interview_status`, updates `current_interview_round`
- [ ] Interview filter dropdown filters correctly for each option
- [ ] "On Hold" filter shows candidates whose latest_round.round_status === 'ON_HOLD'
- [ ] "Rejected" filter shows candidates with `interview_status === 'REJECTED'`
- [ ] Filter resets to "All" on tab change, drawer close, and drawer reopen
