# Pipeline UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Offered/Joined/Dropped tabs into one "Offered" tab with three sections, allow dropped candidates to be restored to Shortlisted, add job-scoped comments on pipeline cards, and polish dimmed-candidate separators.

**Architecture:** Backend adds `DROPPED → SHORTLISTED` to `VALID_TRANSITIONS` and a new `CandidateJobComment` model (FK to `CandidateJobMapping`). Frontend reorganises the pipeline drawer into 4 tabs (removing Joined/Dropped as separate tabs), renders the Offered tab as three stacked sections, and adds an append-only comment thread to every pipeline card.

**Tech Stack:** Django REST Framework, PostgreSQL, React 18, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `backend/apps/candidates/models.py` | Add `DROPPED→SHORTLISTED` to `VALID_TRANSITIONS`; add `CandidateJobComment` model |
| `backend/apps/candidates/migrations/000X_candidatejobcomment.py` | Auto-generated migration |
| `backend/apps/candidates/serializers.py` | Add `CandidateJobCommentSerializer` |
| `backend/apps/candidates/views.py` | Add `CandidateJobCommentListCreateView` |
| `backend/apps/candidates/urls.py` | Register comment endpoint; add import |
| `frontend/src/lib/api.js` | Add `candidates.getComments`, `candidates.addComment` |
| `frontend/src/pages/Jobs.jsx` | Tab grouping, Offered sections, restore button, comments UI, dimmed polish |

---

## Task 1: Backend — VALID_TRANSITIONS + CandidateJobComment model + migration

**Files:**
- Modify: `backend/apps/candidates/models.py`
- Create: `backend/apps/candidates/migrations/000X_candidatejobcomment.py` (auto-generated)

- [ ] **Step 1: Update VALID_TRANSITIONS to allow DROPPED → SHORTLISTED**

  In `backend/apps/candidates/models.py`, find line 73 and change:

  ```python
  # Before
  'DROPPED':     [],
  
  # After
  'DROPPED':     ['SHORTLISTED'],
  ```

- [ ] **Step 2: Add CandidateJobComment model**

  At the bottom of `backend/apps/candidates/models.py`, after the `CandidateNote` class, add:

  ```python
  class CandidateJobComment(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
      mapping = models.ForeignKey(
          CandidateJobMapping, on_delete=models.CASCADE, related_name='comments'
      )
      user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
      content = models.TextField()
      created_at = models.DateTimeField(auto_now_add=True)

      class Meta:
          ordering = ['created_at']
  ```

- [ ] **Step 3: Generate migration**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py makemigrations candidates --name candidatejobcomment
  ```

  Expected: `Migrations for 'candidates': apps/candidates/migrations/000X_candidatejobcomment.py` with one `CreateModel` for `CandidateJobComment`.

- [ ] **Step 4: Run migration**

  ```bash
  python manage.py migrate candidates
  ```

  Expected: `Applying candidates.000X_candidatejobcomment... OK`

- [ ] **Step 5: Django system check**

  ```bash
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI"
  git add backend/apps/candidates/models.py backend/apps/candidates/migrations/
  git commit -m "feat: allow DROPPED→SHORTLISTED transition and add CandidateJobComment model"
  ```

---

## Task 2: Backend — Comments serializer, view, and URL

**Files:**
- Modify: `backend/apps/candidates/serializers.py`
- Modify: `backend/apps/candidates/views.py`
- Modify: `backend/apps/candidates/urls.py`

- [ ] **Step 1: Add CandidateJobCommentSerializer**

  In `backend/apps/candidates/serializers.py`, add the import at the top alongside the existing model imports:

  ```python
  from .models import (
      Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote, ResumeFile,
      CandidateJobComment,
  )
  ```

  Then add this serializer after `CandidateNoteSerializer`:

  ```python
  class CandidateJobCommentSerializer(serializers.ModelSerializer):
      user_name = serializers.CharField(source='user.full_name', read_only=True)

      class Meta:
          model = CandidateJobComment
          fields = ['id', 'mapping', 'user', 'user_name', 'content', 'created_at']
          read_only_fields = ['id', 'user', 'created_at']
  ```

- [ ] **Step 2: Add CandidateJobCommentListCreateView**

  In `backend/apps/candidates/views.py`, add the import alongside existing model imports:

  ```python
  from .models import (
      Candidate, CandidateJobMapping, PipelineStageHistory, CandidateNote,
      VALID_TRANSITIONS, ROUND_PROGRESSION, ROUND_CHOICES, SCREENING_STATUS_CHOICES,
      CandidateJobComment,
  )
  ```

  Add the import for the new serializer:

  ```python
  from .serializers import (
      CandidateListSerializer, CandidateDetailSerializer, CandidateCreateSerializer,
      CandidateJobMappingSerializer, CandidateNoteSerializer, CandidateJobCommentSerializer,
  )
  ```

  Then add this view at the bottom of `views.py`:

  ```python
  class CandidateJobCommentListCreateView(generics.ListCreateAPIView):
      serializer_class = CandidateJobCommentSerializer
      permission_classes = [IsAuthenticated]

      def get_queryset(self):
          return CandidateJobComment.objects.filter(
              mapping__candidate_id=self.kwargs['pk'],
              mapping__job_id=self.kwargs['job_id'],
          ).select_related('user')

      def perform_create(self, serializer):
          mapping = generics.get_object_or_404(
              CandidateJobMapping,
              candidate_id=self.kwargs['pk'],
              job_id=self.kwargs['job_id'],
          )
          serializer.save(mapping=mapping, user=self.request.user)
  ```

- [ ] **Step 3: Register URL**

  In `backend/apps/candidates/urls.py`, update the imports:

  ```python
  from .views import (
      CandidateListCreateView, CandidateDetailView, CandidateDeleteView,
      CandidateNoteListCreateView, CandidateAssignJobView, CandidateChangeStageView,
      CandidateMoveJobView, CandidateShareView, NextRoundView, JumpToRoundView,
      SetScreeningStatusView, CandidateJobCommentListCreateView,
  )
  ```

  Add the URL pattern inside `urlpatterns`:

  ```python
  path('<uuid:pk>/jobs/<uuid:job_id>/comments/', CandidateJobCommentListCreateView.as_view(), name='candidate-job-comments'),
  ```

- [ ] **Step 4: Django system check**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\backend"
  python manage.py check
  ```

  Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 5: Commit**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI"
  git add backend/apps/candidates/serializers.py backend/apps/candidates/views.py backend/apps/candidates/urls.py
  git commit -m "feat: add CandidateJobComment serializer, view, and URL"
  ```

---

## Task 3: Frontend — Stage Grouping (constants + Offered tab sections)

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Update STAGE_TAB_MAP and PIPELINE_TABS**

  Find lines 150–158 (the `STAGE_TAB_MAP` and `PIPELINE_TABS` declarations) and replace:

  ```javascript
  // Before
  const STAGE_TAB_MAP = {
    Applied:     'APPLIED',
    Shortlisted: 'SHORTLISTED',
    Interview:   'INTERVIEW',
    Offered:     'OFFERED',
    Joined:      'JOINED',
    Dropped:     'DROPPED',
  };
  const PIPELINE_TABS = ['Applied', 'Shortlisted', 'Interview', 'Offered', 'Joined', 'Dropped'];
  
  // After
  const STAGE_TAB_MAP = {
    Applied:     'APPLIED',
    Shortlisted: 'SHORTLISTED',
    Interview:   'INTERVIEW',
    Offered:     'OFFERED',
  };
  const PIPELINE_TABS = ['Applied', 'Shortlisted', 'Interview', 'Offered'];
  ```

- [ ] **Step 2: Update getStatCount to sum all three stages for Offered**

  Find the `getStatCount` function (lines 823–827) and replace:

  ```javascript
  // Before
  const getStatCount = (tab) => {
    const stage = STAGE_TAB_MAP[tab];
    if (!stage) return 0;
    return allCandidates.filter(c => c.macro_stage === stage).length;
  };
  
  // After
  const getStatCount = (tab) => {
    if (tab === 'Offered') {
      return allCandidates.filter(c => ['OFFERED', 'JOINED', 'DROPPED'].includes(c.macro_stage)).length;
    }
    const stage = STAGE_TAB_MAP[tab];
    if (!stage) return 0;
    return allCandidates.filter(c => c.macro_stage === stage).length;
  };
  ```

- [ ] **Step 3: Update the stats grid tiles in the job detail panel**

  Find the stats grid (lines 1492–1510) which currently has 6 tiles including Joined and Dropped:

  ```jsx
  // Before — 6 tiles
  {[
    { label: 'Applied',     tab: 'Applied' },
    { label: 'Shortlisted', tab: 'Shortlisted' },
    { label: 'Interview',   tab: 'Interview' },
    { label: 'Offered',     tab: 'Offered' },
    { label: 'Joined',      tab: 'Joined' },
    { label: 'Dropped',     tab: 'Dropped' },
  ].map(({ label, tab }) => (
  ```

  Replace with 4 tiles:

  ```jsx
  // After — 4 tiles
  {[
    { label: 'Applied',     tab: 'Applied' },
    { label: 'Shortlisted', tab: 'Shortlisted' },
    { label: 'Interview',   tab: 'Interview' },
    { label: 'Offered',     tab: 'Offered' },
  ].map(({ label, tab }) => (
  ```

- [ ] **Step 4: Replace the candidate list render with an Offered-aware version**

  Find the IIFE inside the candidate list `<div>` (starts at `{allCandidatesLoading ? (` around line 1853). Replace the entire IIFE body (everything from `() => {` to the final `})()}`) with this:

  ```jsx
  {allCandidatesLoading ? (
    <PageLoader label="Loading candidates…" />
  ) : (() => {
    // ── Offered tab: three stacked sections ──────────────────
    if (pipelineTab === 'Offered') {
      const acceptancePending = allCandidates.filter(c => c.macro_stage === 'OFFERED');
      const joined            = allCandidates.filter(c => c.macro_stage === 'JOINED');
      const dropped           = allCandidates.filter(c => c.macro_stage === 'DROPPED');
      const total             = acceptancePending.length + joined.length + dropped.length;

      if (total === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-2" />
            <p className="text-sm">No candidates in this stage</p>
          </div>
        );
      }

      const renderSection = (title, candidates) => (
        <div key={title} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{title}</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
              {candidates.length}
            </span>
          </div>
          {candidates.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 pl-1">No candidates</p>
          ) : (
            candidates.map(renderCandidateCard)
          )}
        </div>
      );

      return (
        <div className="flex flex-col gap-6">
          {renderSection('Acceptance Pending', acceptancePending)}
          <div className="border-t border-slate-100" />
          {renderSection('Joined', joined)}
          <div className="border-t border-slate-100" />
          {renderSection('Dropped', dropped)}
        </div>
      );
    }

    // ── All other tabs: active cards + dimmed ─────────────────
    const currentStage = STAGE_TAB_MAP[pipelineTab];
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

    if (activeCandidates.length === 0 && dimmedCandidates.length === 0 && !dimmedLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Users className="w-10 h-10 mb-2" />
          <p className="text-sm">No candidates in this stage</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {activeCandidates.map(renderCandidateCard)}
        {dimmedLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs border-t border-dashed border-slate-200 mt-1">
            <svg className="animate-spin w-3.5 h-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            Loading history…
          </div>
        ) : dimmedCandidates.length > 0 ? (
          <>
            <div className="flex items-center gap-2 py-2 my-1">
              <div className="flex-1 border-t border-dashed border-slate-200" />
              <span className="text-xs text-slate-400 shrink-0">
                {dimmedCandidates.length} candidate{dimmedCandidates.length !== 1 ? 's' : ''} progressed from this stage
              </span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>
            {dimmedCandidates.map(renderCandidateCard)}
          </>
        ) : null}
      </div>
    );
  })()}
  ```

- [ ] **Step 5: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 6: Commit**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI"
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: merge Offered/Joined/Dropped into one tab with three sections"
  ```

---

## Task 4: Frontend — Restore to Pipeline button

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add restoringId state**

  Find the drop modal state block (around line 308–311):

  ```javascript
  // ── Drop candidate modal state ───────────────────────────────────────────────
  const [dropModalCandidate, setDropModalCandidate] = useState(null);
  const [dropReason, setDropReason]               = useState('REJECTED');
  const [dropLoading, setDropLoading]             = useState(false);
  ```

  Add one line after it:

  ```javascript
  const [restoringId, setRestoringId] = useState(null);
  ```

- [ ] **Step 2: Add handleRestoreToShortlist handler**

  Find `handleDropConfirm` (around line 740). After its closing `};`, add:

  ```javascript
  const handleRestoreToShortlist = async (c) => {
    setRestoringId(c.id);
    try {
      await candidatesApi.changeStage(c.candidate, c.job, {
        macro_stage: 'SHORTLISTED',
        remarks: 'Restored from Dropped',
      });
      await refreshAllCandidates(viewingJob.id);
    } catch (err) {
      alert(err.data?.error || err.data?.detail || 'Failed to restore candidate');
    } finally {
      setRestoringId(null);
    }
  };
  ```

- [ ] **Step 3: Add Restore button to DROPPED cards in renderCandidateCard**

  Find the Interview action bar block (starts with `{isActive && macroStage === 'INTERVIEW' && (`). After its closing `)}`, before the final `</div>` that closes `<div key={c.id}>`, add:

  ```jsx
  {/* Restore to pipeline — only for active DROPPED cards */}
  {isActive && macroStage === 'DROPPED' && (
    <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
      <button
        onClick={() => handleRestoreToShortlist(c)}
        disabled={restoringId === c.id}
        className="w-full text-xs font-semibold bg-slate-700 text-white rounded px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {restoringId === c.id ? 'Restoring…' : 'Restore to Pipeline'}
      </button>
    </div>
  )}
  ```

- [ ] **Step 4: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI"
  git add frontend/src/pages/Jobs.jsx
  git commit -m "feat: Restore to Pipeline button for Dropped candidates"
  ```

---

## Task 5: Frontend — Job-Scoped Comments UI

**Files:**
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Add getComments and addComment API methods**

  In `frontend/src/lib/api.js`, find the `candidates` export object and add two methods after `setScreeningStatus`:

  ```javascript
  getComments: (candidateId, jobId) =>
    request(`/candidates/${candidateId}/jobs/${jobId}/comments/`),
  addComment: (candidateId, jobId, content) =>
    request(`/candidates/${candidateId}/jobs/${jobId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  ```

- [ ] **Step 2: Add comment state variables**

  In `Jobs.jsx`, find the screening filter state block (around line 295–296):

  ```javascript
  // ── Screening filter state ───────────────────────────────────────────────────
  const [screeningFilter, setScreeningFilter] = useState('ALL');
  ```

  After that block, add:

  ```javascript
  // ── Comment state ─────────────────────────────────────────────────────────────
  const [commentsByCard, setCommentsByCard]           = useState({});
  const [commentsOpenId, setCommentsOpenId]            = useState(null);
  const [commentsLoadingId, setCommentsLoadingId]      = useState(null);
  const [commentInput, setCommentInput]                = useState('');
  const [commentSubmittingId, setCommentSubmittingId]  = useState(null);
  ```

- [ ] **Step 3: Add handleToggleComments handler**

  In `Jobs.jsx`, find `handleNextRound` (around line 753). Before it, add:

  ```javascript
  const handleToggleComments = async (c) => {
    if (commentsOpenId === c.id) {
      setCommentsOpenId(null);
      return;
    }
    setCommentsOpenId(c.id);
    setCommentInput('');
    if (commentsByCard[c.id]) return;
    setCommentsLoadingId(c.id);
    try {
      const data = await candidatesApi.getComments(c.candidate, c.job);
      setCommentsByCard(prev => ({ ...prev, [c.id]: data }));
    } catch {
      setCommentsByCard(prev => ({ ...prev, [c.id]: [] }));
    } finally {
      setCommentsLoadingId(null);
    }
  };

  const handleAddComment = async (c) => {
    const text = commentInput.trim();
    if (!text) return;
    setCommentSubmittingId(c.id);
    try {
      const newComment = await candidatesApi.addComment(c.candidate, c.job, text);
      setCommentsByCard(prev => ({ ...prev, [c.id]: [...(prev[c.id] || []), newComment] }));
      setCommentInput('');
    } catch {
      alert('Failed to add comment');
    } finally {
      setCommentSubmittingId(null);
    }
  };
  ```

- [ ] **Step 4: Add comments section inside renderCandidateCard**

  Inside `renderCandidateCard`, find the closing `</div>` of the main card div (the one with `border rounded-xl p-4`). It's immediately before the Interview action bar block. Just before that closing `</div>`, insert:

  ```jsx
          {/* ── Comments section ─────────────────────────────── */}
          <div className="mt-3 border-t border-slate-100">
            <button
              onClick={() => handleToggleComments(c)}
              className="w-full flex items-center justify-between px-1 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span>
                💬 Comments
                {commentsByCard[c.id]?.length ? ` (${commentsByCard[c.id].length})` : ''}
              </span>
              <span>{commentsOpenId === c.id ? '▴' : '▾'}</span>
            </button>

            {commentsOpenId === c.id && (
              <div className="px-1 pb-2 space-y-2">
                {commentsLoadingId === c.id ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : (commentsByCard[c.id] || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No comments yet.</p>
                ) : (
                  (commentsByCard[c.id] || []).map(cm => (
                    <div key={cm.id} className="text-xs">
                      <span className="font-medium text-slate-700">{cm.user_name}</span>
                      <span className="text-slate-400 ml-1">
                        {new Date(cm.created_at).toLocaleDateString()}
                      </span>
                      <p className="text-slate-600 mt-0.5">{cm.content}</p>
                    </div>
                  ))
                )}
                {isActive && (
                  <div className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={commentsOpenId === c.id ? commentInput : ''}
                      onChange={e => setCommentInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddComment(c); }}
                      placeholder="Add a comment…"
                      className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button
                      onClick={() => handleAddComment(c)}
                      disabled={commentSubmittingId === c.id}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
  ```

- [ ] **Step 5: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI"
  git add frontend/src/lib/api.js frontend/src/pages/Jobs.jsx
  git commit -m "feat: job-scoped comments on pipeline cards"
  ```

---

## Task 6: Frontend — Dimmed candidates polish + fetch wiring

**Files:**
- Modify: `frontend/src/pages/Jobs.jsx`

- [ ] **Step 1: Skip dimmed fetch for Offered tab in refreshDimmed**

  Find the `refreshDimmed` function (lines 456–465):

  ```javascript
  const refreshDimmed = (jobId, tab) => {
    const stage = STAGE_TAB_MAP[tab];
    if (!stage) { setDimmedCandidates([]); return Promise.resolve(); }
    return jobsApi.pipeline(jobId, { stage, include_progressed: 'true' })
      .then((res) => {
        const all = Array.isArray(res) ? res : (res.results || []);
        setDimmedCandidates(all.filter(c => c.is_current_stage === false));
      })
      .catch(console.error);
  };
  ```

  Replace with:

  ```javascript
  const refreshDimmed = (jobId, tab) => {
    if (tab === 'Offered') { setDimmedCandidates([]); return Promise.resolve(); }
    const stage = STAGE_TAB_MAP[tab];
    if (!stage) { setDimmedCandidates([]); return Promise.resolve(); }
    return jobsApi.pipeline(jobId, { stage, include_progressed: 'true' })
      .then((res) => {
        const all = Array.isArray(res) ? res : (res.results || []);
        setDimmedCandidates(all.filter(c => c.is_current_stage === false));
      })
      .catch(console.error);
  };
  ```

- [ ] **Step 2: Verify the dimmed separator is already updated**

  In Task 3 Step 4, the new IIFE already includes the updated separator:

  ```jsx
  <div className="flex items-center gap-2 py-2 my-1">
    <div className="flex-1 border-t border-dashed border-slate-200" />
    <span className="text-xs text-slate-400 shrink-0">
      {dimmedCandidates.length} candidate{dimmedCandidates.length !== 1 ? 's' : ''} progressed from this stage
    </span>
    <div className="flex-1 border-t border-dashed border-slate-200" />
  </div>
  ```

  Confirm this is in the file. If Task 3 was completed correctly, no further change is needed here.

- [ ] **Step 3: Verify build**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI\frontend"
  npx vite build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  cd "c:\Users\akash.ramteke\Desktop\ATS-Shorthills AI"
  git add frontend/src/pages/Jobs.jsx
  git commit -m "fix: skip dimmed fetch for Offered tab; polish dimmed separator with count"
  ```

---

## Verification Checklist

- [ ] Offered tab count badge = OFFERED + JOINED + DROPPED combined
- [ ] Joined and Dropped tabs no longer appear in the tab bar
- [ ] Offered tab shows three sections: Acceptance Pending / Joined / Dropped
- [ ] Each section shows "No candidates" when empty (section header still visible)
- [ ] Dropped candidate has "Restore to Pipeline" button; clicking moves them to Shortlisted tab
- [ ] PipelineStageHistory has a DROPPED→SHORTLISTED entry after restore
- [ ] Comments section collapsed by default on all cards
- [ ] Clicking opens comments; first open fetches from API
- [ ] Comment input submits on Enter or Post button; new comment appears immediately
- [ ] Dimmed card shows comments but not the input
- [ ] Applied, Shortlisted, Interview tabs all show dimmed candidates with count separator
- [ ] Offered tab shows no dimmed cards (progression visible within sections)
- [ ] Dimmed separator reads "N candidate(s) progressed from this stage"
