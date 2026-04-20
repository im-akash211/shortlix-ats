# Applied Screening Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `screening_status` field (SCREENED / MAYBE / REJECTED) to Applied-stage candidates, with a filter bar and "Move to" action dropdown in the Applied pipeline tab.

**Architecture:** New nullable `screening_status` column on `CandidateJobMapping`; new `PATCH /candidates/{id}/jobs/{job_id}/screening-status/` endpoint; frontend filters `allCandidates` client-side and updates the field in-place on action.

**Tech Stack:** Django REST Framework, PostgreSQL, React 18, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `backend/apps/candidates/models.py` | Add `SCREENING_STATUS_CHOICES` + `screening_status` field |
| `backend/apps/candidates/migrations/0007_screening_status.py` | Auto-generated migration |
| `backend/apps/candidates/serializers.py` | Add `screening_status` to `CandidateJobMappingSerializer` |
| `backend/apps/candidates/views.py` | Add `SetScreeningStatusView` |
| `backend/apps/candidates/urls.py` | Register new URL |
| `frontend/src/lib/api.js` | Add `candidates.setScreeningStatus()` |
| `frontend/src/pages/Jobs.jsx` | `screeningFilter` state, filter bar, badge, "Move to" dropdown |

---

## Task 1: Add `screening_status` to the model

**Files:**
- Modify: `backend/apps/candidates/models.py`

- [ ] **Step 1: Add choices constant and field**

  Open `backend/apps/candidates/models.py`. After the `PRIORITY_CHOICES` block (around line 35), add:

  ```python
  SCREENING_STATUS_CHOICES = [
      ('SCREENED', 'Screened'),
      ('MAYBE', 'Maybe'),
      ('REJECTED', 'Rejected'),
  ]
  ```

  In the `CandidateJobMapping` model, after the `priority` field, add:

  ```python
  screening_status = models.CharField(
      max_length=20,
      choices=SCREENING_STATUS_CHOICES,
      null=True,
      blank=True,
      default=None,
  )
  ```

- [ ] **Step 2: Generate and inspect the migration**

  ```bash
  cd backend
  python manage.py makemigrations candidates --name screening_status
  ```

  Expected output: `Migrations for 'candidates': apps/candidates/migrations/0007_screening_status.py`

  Open the generated file and confirm it adds one `AddField` for `screening_status` with `null=True`.

- [ ] **Step 3: Run the migration**

  ```bash
  python manage.py migrate candidates
  ```

  Expected: `Applying candidates.0007_screening_status... OK`

- [ ] **Step 4: Verify with Django shell**

  ```bash
  python manage.py shell -c "
  from apps.candidates.models import CandidateJobMapping
  m = CandidateJobMapping.objects.first()
  print(m.screening_status)  # Should print: None
  "
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add backend/apps/candidates/models.py backend/apps/candidates/migrations/0007_screening_status.py
  git commit -m "feat: add screening_status field to CandidateJobMapping"
  ```

---

## Task 2: Expose `screening_status` in the serializer

**Files:**
- Modify: `backend/apps/candidates/serializers.py`

- [ ] **Step 1: Add `screening_status` to serializer fields**

  In `backend/apps/candidates/serializers.py`, update `CandidateJobMappingSerializer.Meta.fields`. Add `'screening_status'` after `'priority'`:

  ```python
  class Meta:
      model = CandidateJobMapping
      fields = [
          'id', 'candidate', 'job',
          'macro_stage', 'offer_status', 'drop_reason',
          'current_interview_round', 'next_interview_date', 'priority',
          'screening_status',
          'moved_by', 'stage_updated_at', 'created_at',
          'candidate_name', 'candidate_email', 'candidate_phone',
          'candidate_location', 'candidate_experience', 'candidate_skills',
          'candidate_designation',
          'job_title', 'job_code',
      ]
      read_only_fields = ['id', 'moved_by', 'stage_updated_at', 'created_at']
  ```

- [ ] **Step 2: Verify the pipeline endpoint returns the field**

  ```bash
  # With server running (python manage.py runserver):
  curl -s http://localhost:8000/api/jobs/<any-job-uuid>/pipeline/ \
    -H "Authorization: Bearer <token>" | python -m json.tool | grep screening_status
  ```

  Expected: each candidate object contains `"screening_status": null`

- [ ] **Step 3: Commit**

  ```bash
  git add backend/apps/candidates/serializers.py
  git commit -m "feat: expose screening_status in CandidateJobMappingSerializer"
  ```

---

## Task 3: Add `SetScreeningStatusView` endpoint

**Files:**
- Modify: `backend/apps/candidates/views.py`
- Modify: `backend/apps/candidates/urls.py`

- [ ] **Step 1: Update models import**

  In `backend/apps/candidates/views.py`, add `SCREENING_STATUS_CHOICES` to the models import:

  ```python
  from .models import (
      Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote,
      VALID_TRANSITIONS, ROUND_PROGRESSION, ROUND_CHOICES, SCREENING_STATUS_CHOICES,
  )
  ```

- [ ] **Step 2: Add the view**

  At the end of `backend/apps/candidates/views.py`, add:

  ```python
  class SetScreeningStatusView(APIView):
      """
      PATCH /candidates/{pk}/jobs/{job_id}/screening-status/

      Body: { "screening_status": "SCREENED" | "MAYBE" | "REJECTED" | null }

      Only allowed when macro_stage == "APPLIED". Returns 400 otherwise.
      """

      def patch(self, request, pk, job_id):
          mapping = generics.get_object_or_404(
              CandidateJobMapping, candidate_id=pk, job_id=job_id
          )

          if mapping.macro_stage != 'APPLIED':
              return Response(
                  {'error': 'screening_status can only be set on Applied candidates'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          new_status = request.data.get('screening_status')
          valid_values = [key for key, _ in SCREENING_STATUS_CHOICES] + [None]
          if new_status not in valid_values:
              return Response(
                  {'error': f'Invalid screening_status. Must be one of: SCREENED, MAYBE, REJECTED, or null'},
                  status=status.HTTP_400_BAD_REQUEST,
              )

          mapping.screening_status = new_status
          mapping.save(update_fields=['screening_status'])

          return Response(CandidateJobMappingSerializer(mapping).data)
  ```

- [ ] **Step 3: Register the URL**

  In `backend/apps/candidates/urls.py`, add the import and URL:

  ```python
  from .views import (
      CandidateListCreateView, CandidateDetailView, CandidateDeleteView,
      CandidateNoteListCreateView, CandidateAssignJobView, CandidateChangeStageView,
      CandidateMoveJobView, CandidateShareView, NextRoundView, JumpToRoundView,
      SetScreeningStatusView,
  )

  # Add inside urlpatterns:
  path('<uuid:pk>/jobs/<uuid:job_id>/screening-status/', SetScreeningStatusView.as_view(), name='candidate-screening-status'),
  ```

- [ ] **Step 4: Run Django system check**

  ```bash
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 5: Manual smoke test**

  ```bash
  # Set to SCREENED
  curl -s -X PATCH http://localhost:8000/api/candidates/<candidate-uuid>/jobs/<job-uuid>/screening-status/ \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"screening_status": "SCREENED"}' | python -m json.tool | grep screening_status
  # Expected: "screening_status": "SCREENED"

  # Try on non-APPLIED candidate — should get 400
  curl -s -X PATCH http://localhost:8000/api/candidates/<shortlisted-candidate-uuid>/jobs/<job-uuid>/screening-status/ \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"screening_status": "SCREENED"}' | python -m json.tool
  # Expected: {"error": "screening_status can only be set on Applied candidates"}
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add backend/apps/candidates/views.py backend/apps/candidates/urls.py
  git commit -m "feat: add SetScreeningStatusView endpoint for Applied screening classification"
  ```

---

## Task 4: Add `candidates.setScreeningStatus` to frontend API

**Files:**
- Modify: `frontend/src/lib/api.js`

- [ ] **Step 1: Add the method**

  In `frontend/src/lib/api.js`, inside the `candidates` object, after the `jumpToRound` method, add:

  ```javascript
  setScreeningStatus: (candidateId, jobId, screeningStatus) =>
    request(`/candidates/${candidateId}/jobs/${jobId}/screening-status/`, {
      method: 'PATCH',
      body: JSON.stringify({ screening_status: screeningStatus }),
    }),
  ```

- [ ] **Step 2: Verify build**

  ```bash
  cd frontend
  npx vite build 2>&1 | tail -5
  ```

  Expected: `built in X.XXs` with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/lib/api.js
  git commit -m "feat: add candidatesApi.setScreeningStatus API method"
  ```

---

## Task 5: Frontend — `screeningFilter` state + filter bar

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add `screeningFilter` state**

  In `Jobs.jsx`, in the state declarations block, add:

  ```javascript
  const [screeningFilter, setScreeningFilter] = useState('ALL');
  ```

- [ ] **Step 2: Reset filter on tab change**

  Find the `setPipelineTab` call (or wherever `pipelineTab` is set, likely in a tab `onClick`). After setting the tab, also reset the filter:

  ```javascript
  // In the tab onClick handler:
  setPipelineTab(tab);
  setScreeningFilter('ALL');
  ```

- [ ] **Step 3: Add the filter bar JSX**

  Find where the candidate list is rendered inside the pipeline drawer (just before the candidate cards loop, after the tabs). Add the filter bar, visible only on the Applied tab:

  ```jsx
  {pipelineTab === 'Applied' && (
    <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center gap-2">
      <span className="text-xs text-slate-500 font-medium">Filter:</span>
      <select
        value={screeningFilter}
        onChange={(e) => setScreeningFilter(e.target.value)}
        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="ALL">All</option>
        <option value="SCREENED">Screened</option>
        <option value="MAYBE">Maybe</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>
  )}
  ```

- [ ] **Step 4: Apply filter to the visible candidates list**

  Find the line that derives `activeCandidates` from `allCandidates` (something like):
  ```javascript
  const activeCandidates = allCandidates.filter(c => c.macro_stage === currentStage);
  ```

  Replace it with:
  ```javascript
  const activeCandidates = allCandidates
    .filter(c => c.macro_stage === currentStage)
    .filter(c =>
      pipelineTab !== 'Applied' || screeningFilter === 'ALL' || c.screening_status === screeningFilter
    );
  ```

- [ ] **Step 5: Verify build**

  ```bash
  cd frontend
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: add screening filter bar to Applied pipeline tab"
  ```

---

## Task 6: Frontend — Screening status badge on Applied cards

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add badge constants**

  Near the top of `Jobs.jsx` where `STAGE_COLORS` and `STAGE_LABELS` are defined, add:

  ```javascript
  const SCREENING_STATUS_LABELS = {
    SCREENED: 'Screened',
    MAYBE: 'Maybe',
    REJECTED: 'Rejected',
  };

  const SCREENING_STATUS_COLORS = {
    SCREENED: 'bg-green-100 text-green-700',
    MAYBE: 'bg-amber-100 text-amber-700',
    REJECTED: 'bg-rose-100 text-rose-700',
  };
  ```

- [ ] **Step 2: Render the badge in `renderCandidateCard`**

  Inside `renderCandidateCard`, find the top section where the stage badge is rendered (the `macroStage` badge near the candidate name). After that badge, add the screening status badge:

  ```jsx
  {macroStage === 'APPLIED' && c.screening_status && (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SCREENING_STATUS_COLORS[c.screening_status]}`}>
      {SCREENING_STATUS_LABELS[c.screening_status]}
    </span>
  )}
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd frontend
  npx vite build 2>&1 | tail -5
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: show screening status badge on Applied candidate cards"
  ```

---

## Task 7: Frontend — "Move to" dropdown and Shortlist actions on Applied cards

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add `handleScreeningStatus` helper**

  In `Jobs.jsx`, near the other action handlers (like `doStageChange`), add:

  ```javascript
  const handleScreeningStatus = async (c, newStatus) => {
    await candidatesApi.setScreeningStatus(c.candidate, c.job, newStatus);
    setAllCandidates(prev =>
      prev.map(m => m.id === c.id ? { ...m, screening_status: newStatus } : m)
    );
  };
  ```

- [ ] **Step 2: Add `getMoveToOptions` helper**

  ```javascript
  const getMoveToOptions = (currentScreeningStatus) => {
    const all = ['SCREENED', 'MAYBE', 'REJECTED'];
    return all.filter(s => s !== currentScreeningStatus);
  };
  ```

- [ ] **Step 3: Render action buttons in `renderCandidateCard` for Applied stage**

  Inside `renderCandidateCard`, find the action buttons section (where the "Shortlist" button currently lives for Applied cards). Replace the Applied-stage action block with:

  ```jsx
  {macroStage === 'APPLIED' && isActive && (
    <div className="flex items-center gap-2 mt-2">
      {/* Primary: Shortlist */}
      <button
        onClick={() => doStageChange(c, { macro_stage: 'SHORTLISTED' })}
        className="flex-1 text-xs font-semibold bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 transition-colors"
      >
        Shortlist
      </button>

      {/* Secondary: Move to dropdown */}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) handleScreeningStatus(c, e.target.value);
        }}
        className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
      >
        <option value="" disabled>Move to</option>
        {getMoveToOptions(c.screening_status).map(opt => (
          <option key={opt} value={opt}>
            {SCREENING_STATUS_LABELS[opt]}
          </option>
        ))}
      </select>
    </div>
  )}
  ```

- [ ] **Step 4: Verify build**

  ```bash
  cd frontend
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: add Move to dropdown and Shortlist actions for Applied candidates"
  ```

---

## Verification Checklist

- [ ] Fresh Applied candidate has no screening badge and "Move to" shows all three options (Screened, Maybe, Rejected)
- [ ] After marking "Screened": green badge appears, "Move to" shows Maybe and Rejected only
- [ ] After marking "Maybe": amber badge appears, "Move to" shows Screened and Rejected only
- [ ] After marking "Rejected": rose badge appears, "Move to" shows Screened and Maybe only
- [ ] Filter dropdown set to "Rejected" shows only Rejected candidates; "All" shows everyone
- [ ] Filter resets to "All" when switching to another tab and back
- [ ] Shortlist button on Applied card moves candidate to Shortlisted tab (count updates)
- [ ] Attempting `PATCH /screening-status/` on a SHORTLISTED candidate returns 400
- [ ] Passing an invalid value (e.g. `"UNKNOWN"`) returns 400
- [ ] Passing `null` clears the badge back to unclassified
- [ ] Dimmed cards in Applied tab have no action buttons (existing behaviour preserved)
