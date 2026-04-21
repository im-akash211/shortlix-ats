# Pipeline UX Improvements — Design Spec

**Date:** 2026-04-21
**Status:** Approved

---

## Overview

Four improvements to the pipeline UI and backend:

1. **Stage Grouping** — Merge Offered, Joined, and Dropped into one "Offered" tab with three stacked sections.
2. **Reversal from Dropped** — Allow dropped candidates to be restored to Shortlisted.
3. **Job-Scoped Comments** — Per-job, per-candidate comments separate from global candidate notes.
4. **Dimmed Candidates Polish** — Applied, Shortlisted, and Interview tabs show all progressed candidates with a clear visual separator.

---

## 1. Stage Grouping (UI Only)

### Tab Bar

Remove the separate `Joined` and `Dropped` tabs. Tab bar becomes:

```
Applied · Shortlisted · Interview · Offered
```

The `Offered` tab count badge = count of OFFERED + JOINED + DROPPED candidates for the job.

### Three Stacked Sections

Inside the Offered tab, render three labeled sections in this order:

| Section header | Data source |
|---|---|
| Acceptance Pending | `macro_stage === 'OFFERED'` |
| Joined | `macro_stage === 'JOINED'` |
| Dropped | `macro_stage === 'DROPPED'` |

Each section:
- Header row: bold label + count badge (e.g. `Acceptance Pending  3`)
- Cards rendered below the header using the existing `renderCandidateCard()`
- Empty section shows a small `"No candidates"` placeholder — sections are always visible so the structure is clear

### Data Sourcing

No new API calls. `allCandidates` (already loaded for the job) is sliced per section by `macro_stage`. The Offered tab renders all three groups from in-memory data.

### No Dimmed Cards in Offered Tab

JOINED and DROPPED candidates are already visible as their own sections. Showing them again as dimmed cards in Acceptance Pending would duplicate data.

### STAGE_TAB_MAP Changes (Frontend)

```javascript
// Remove:
Joined:  'JOINED',
Dropped: 'DROPPED',

// Keep (renamed display only):
Offered: 'OFFERED',  // tab now covers all three stages
```

`getStatCount('Offered')` must sum OFFERED + JOINED + DROPPED from `allCandidates`.

### Card Actions by Section

| Section | Existing actions | Change |
|---|---|---|
| Acceptance Pending | Make Offer (already there), Drop | No change |
| Joined | None (terminal) | No change |
| Dropped | Drop reason label | Add **Restore to Pipeline** button (see §2) |

---

## 2. Reversal from Dropped

### Backend

**`backend/apps/candidates/models.py`** — update `VALID_TRANSITIONS`:

```python
VALID_TRANSITIONS = {
    ...
    'DROPPED': ['SHORTLISTED'],   # was []
}
```

No other model changes. `MACRO_STAGE_CHOICES` is unchanged (constraint satisfied).

**No new endpoint.** The existing `CandidateChangeStageView` (`PATCH /candidates/{pk}/jobs/{job_id}/stage/`) already:
- Validates the transition against `VALID_TRANSITIONS`
- Clears `drop_reason` and `offer_status` on non-DROPPED/OFFERED stages
- Creates a `PipelineStageHistory` record

### Frontend

In the **Dropped section** of the Offered tab, every active card shows a **"Restore to Pipeline"** button:

```jsx
<button onClick={() => handleRestoreToShortlist(c)}>
  Restore to Pipeline
</button>
```

Handler:
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
    alert(err.data?.error || 'Failed to restore candidate');
  } finally {
    setRestoringId(null);
  }
};
```

New loading state: `const [restoringId, setRestoringId] = useState(null)`.

On success the candidate disappears from Dropped and reappears in the Shortlisted tab. History record `DROPPED → SHORTLISTED` is written automatically.

---

## 3. Job-Scoped Comments

### Backend

#### Model

Add to `backend/apps/candidates/models.py`:

```python
class CandidateJobComment(models.Model):
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mapping = models.ForeignKey(
        CandidateJobMapping, on_delete=models.CASCADE, related_name='comments'
    )
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
```

Comments are append-only — no edit or delete — matching the `CandidateNote` audit pattern.

#### Serializer

Add to `backend/apps/candidates/serializers.py`:

```python
class CandidateJobCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model  = CandidateJobComment
        fields = ['id', 'mapping', 'user', 'user_name', 'content', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
```

#### View

Add to `backend/apps/candidates/views.py`:

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

#### URL

Add to `backend/apps/candidates/urls.py`:

```python
path('<uuid:pk>/jobs/<uuid:job_id>/comments/', CandidateJobCommentListCreateView.as_view(), name='candidate-job-comments'),
```

#### Migration

One auto-generated migration adding the `CandidateJobComment` table.

### Frontend

#### API Methods

Add to the `candidates` object in `frontend/src/lib/api.js`:

```javascript
getComments: (candidateId, jobId) =>
  request(`/candidates/${candidateId}/jobs/${jobId}/comments/`),
addComment: (candidateId, jobId, content) =>
  request(`/candidates/${candidateId}/jobs/${jobId}/comments/`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),
```

#### State

Per-card comment state — stored in a single map keyed by candidate mapping id:

```javascript
const [commentsByCard, setCommentsByCard]       = useState({});  // { [mappingId]: Comment[] }
const [commentsOpenId, setCommentsOpenId]        = useState(null); // which card is expanded
const [commentsLoadingId, setCommentsLoadingId]  = useState(null);
const [commentInput, setCommentInput]            = useState('');
const [commentSubmittingId, setCommentSubmittingId] = useState(null);
```

#### Toggle Handler

```javascript
const handleToggleComments = async (c) => {
  if (commentsOpenId === c.id) {
    setCommentsOpenId(null);
    return;
  }
  setCommentsOpenId(c.id);
  setCommentInput(''); // reset input when switching cards
  if (commentsByCard[c.id]) return; // already loaded
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
```

#### Submit Handler

```javascript
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

#### Card UI

Append at the bottom of every card in `renderCandidateCard()` (both active and dimmed):

```jsx
{/* Comments section */}
<div className="mt-2 border-t border-slate-100">
  <button
    onClick={() => handleToggleComments(c)}
    className="w-full flex items-center justify-between px-1 py-1.5 text-xs text-slate-500 hover:text-slate-700"
  >
    <span>💬 Comments{commentsByCard[c.id]?.length ? ` (${commentsByCard[c.id].length})` : ''}</span>
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
            <span className="text-slate-400 ml-1">{new Date(cm.created_at).toLocaleDateString()}</span>
            <p className="text-slate-600 mt-0.5">{cm.content}</p>
          </div>
        ))
      )}

      {/* Input — only for active cards */}
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
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      )}
    </div>
  )}
</div>
```

---

## 4. Dimmed Candidates Polish

### Scope

Dimmed candidates are shown in **Applied, Shortlisted, and Interview** tabs only. The Offered tab has no dimmed cards.

### What "progressed" means per tab

| Tab | Dimmed candidates shown |
|---|---|
| Applied | Candidates now in Shortlisted, Interview, Offered, Joined, or Dropped |
| Shortlisted | Candidates now in Interview, Offered, Joined, or Dropped |
| Interview | Candidates now in Offered, Joined, or Dropped |

The backend `JobPipelineView` with `include_progressed=true` already returns candidates who passed through a stage based on `PipelineStageHistory`. No backend change needed.

### Fetch Wiring

The `include_progressed=true` fetch must fire consistently when:
1. A tab is clicked (already works)
2. The job drawer is opened (must trigger for whichever tab is currently active)

Fix: call the dimmed-fetch inside `openJobDetails` after setting the initial tab, not only on tab-click.

### Visual Separator

Replace the current generic separator with:

```jsx
<div className="flex items-center gap-2 py-2 my-1">
  <div className="flex-1 border-t border-dashed border-slate-200" />
  <span className="text-xs text-slate-400 shrink-0">
    {dimmedCandidates.length} candidate{dimmedCandidates.length !== 1 ? 's' : ''} progressed from this stage
  </span>
  <div className="flex-1 border-t border-dashed border-slate-200" />
</div>
```

Hidden entirely when `dimmedCandidates.length === 0`.

### Dimmed Card Behaviour

- `opacity-50 bg-slate-50` styling unchanged
- No action buttons (existing guard: `isActive` check)
- Comments section visible but input hidden (existing `isActive` guard in comments UI)

---

## Out of Scope

- Editing or deleting comments
- Bulk restore from Dropped
- Reverting from Joined
- Dimmed candidates in the Offered tab
- Notifications on comment mention
