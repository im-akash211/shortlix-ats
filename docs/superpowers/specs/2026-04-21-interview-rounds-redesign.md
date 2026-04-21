# Interview Rounds Redesign — Design Spec

**Date:** 2026-04-21
**Status:** Approved

---

## Overview

Redesign the Interview stage to support flexible multi-round hiring workflows. Rounds follow a default progression (R1→R2→R3→Client→CDO→MGMT) but skipping and jumping to any round is allowed. Moving to the next round no longer auto-schedules — scheduling is an explicit separate action via a modal. Rejected candidates stay in the Interview tab (not auto-dropped to Dropped) and can be rescheduled for any round.

---

## Backend

### 1. Model Changes

**`ROUND_CHOICES` and `ROUND_PROGRESSION`** — add R3:

```python
ROUND_CHOICES = [
    ('R1', 'Round 1'),
    ('R2', 'Round 2'),
    ('R3', 'Round 3'),
    ('CLIENT', 'Client Round'),
    ('CDO', 'CDO Round'),
    ('MGMT', 'Management Round'),
]

ROUND_PROGRESSION = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT']
```

**`CandidateJobMapping`** — add `interview_status` field:

```python
interview_status = models.CharField(
    max_length=20,
    choices=[('REJECTED', 'Rejected')],
    null=True,
    blank=True,
)
```

- `null` = candidate is actively in Interview stage
- `'REJECTED'` = candidate failed a round; stays in Interview tab, does NOT move to Dropped
- Pattern mirrors `screening_status` on Applied stage

**`Interview.round_status`** — existing choices stay (`SCHEDULED`, `ON_HOLD`, `COMPLETED`). No model change.

**`Interview.round_result`** (PASS/FAIL/ON_HOLD) — kept for record-keeping. FAIL no longer auto-drops candidate.

**`Interview.round_status` valid progressions:**
- `null → SCHEDULED` (scheduling)
- `SCHEDULED → ON_HOLD` (place on hold)
- `ON_HOLD → SCHEDULED` (resume)
- `SCHEDULED → COMPLETED` (mark complete)
- `COMPLETED → SCHEDULED` (re-open, edge case)

**Migration:** one auto-generated migration adding `interview_status` nullable CharField to `CandidateJobMapping`.

---

### 2. Serializer Changes

**`CandidateJobMappingSerializer`** — add `interview_status` to `Meta.fields` after `screening_status`. Not in `read_only_fields`.

---

### 3. Endpoint Changes

#### Changed: `NextRoundView` — `POST /candidates/{pk}/jobs/{job_id}/interview/next-round/`

- Remove auto-Interview-record creation
- Only advance `mapping.current_interview_round` to next in `ROUND_PROGRESSION`
- Add guard: the latest Interview for the current round must have `round_status='COMPLETED'` — return 400 if not
- Returns updated `CandidateJobMapping`

#### Changed: `JumpToRoundView` — `POST /candidates/{pk}/jobs/{job_id}/interview/jump-round/`

- Remove auto-Interview-record creation
- Only updates `mapping.current_interview_round` to the requested round
- No completion guard (jump = explicit user intent to skip)
- Add `'R3'` to valid round values
- Returns updated `CandidateJobMapping`

#### New: `PATCH /interviews/{pk}/round-status/`

- Body: `{ "round_status": "SCHEDULED" | "ON_HOLD" | "COMPLETED" }`
- Updates `Interview.round_status`
- No strict transition enforcement — any status can be set (flexible by design)
- Returns updated Interview

#### Changed: `SetRoundResultView` — `PATCH /interviews/{pk}/round-result/`

- FAIL path: set `mapping.interview_status = 'REJECTED'` instead of auto-dropping to DROPPED
  - No `PipelineStageHistory` entry for rejection (not a macro-stage move)
  - Returns `{ ..., "auto_rejected": true }` in response
- PASS path: return `suggest_move_to_offered=True` if `round_status='COMPLETED'` (for any round ≥ R1, not just MGMT)
- `round_result` and `round_status` updated as before

#### Changed: `InterviewListCreateView` — `POST /interviews/`

- `perform_create()`: when creating an Interview for a mapping with `interview_status='REJECTED'`:
  - Clear `mapping.interview_status = None`
  - Update `mapping.current_interview_round` to the new interview's `round_name`
  - Save mapping with `update_fields=['interview_status', 'current_interview_round', 'stage_updated_at', 'moved_by']`
- This is the reschedule flow — no extra endpoint needed

---

## Frontend

### 1. Constants

```javascript
const ROUND_LABELS = {
  R1: 'R1', R2: 'R2', R3: 'R3', CLIENT: 'Client', CDO: 'CDO', MGMT: 'Mgmt',
};

const ROUND_PROGRESSION = ['R1', 'R2', 'R3', 'CLIENT', 'CDO', 'MGMT'];
```

### 2. New API Methods (`frontend/src/lib/api.js`)

```javascript
// Inside interviews object:
setRoundStatus: (id, roundStatus) =>
  request(`/interviews/${id}/round-status/`, {
    method: 'PATCH',
    body: JSON.stringify({ round_status: roundStatus }),
  }),
```

### 3. New State

```javascript
const [interviewFilter, setInterviewFilter] = useState('ALL');
const [scheduleModalCandidate, setScheduleModalCandidate] = useState(null);
const [scheduleModalRound, setScheduleModalRound] = useState(null);
const [roundStatusLoadingId, setRoundStatusLoadingId] = useState(null);
```

`interviewFilter` resets to `'ALL'` on tab change, drawer close, and in `openJobDetails`.

### 4. Filter Bar (Interview tab only)

Rendered between the tab row and candidate list, only when `pipelineTab === 'Interview'`:

```jsx
<select value={interviewFilter} onChange={e => setInterviewFilter(e.target.value)}>
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
```

Filter logic applied to `activeCandidates`:
```javascript
.filter(c => {
  if (pipelineTab !== 'Interview' || interviewFilter === 'ALL') return true;
  if (interviewFilter === 'REJECTED') return c.interview_status === 'REJECTED';
  if (interviewFilter === 'ON_HOLD') return c.latest_round?.round_status === 'ON_HOLD';
  return c.current_interview_round === interviewFilter;
})
```

### 5. Card Badge

Show `interview_status === 'REJECTED'` as a rose badge next to the round pill:

```jsx
{macroStage === 'INTERVIEW' && c.interview_status === 'REJECTED' && (
  <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
    Rejected
  </span>
)}
```

For rejected candidates, also show latest round context in the metadata row:
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
```

### 6. Interview Action Bar — State-Driven Buttons

Only shown for `isActive && macroStage === 'INTERVIEW'`.

| Condition | Buttons |
|---|---|
| `interview_status === 'REJECTED'` | Round selector (pre-filled with rejected round) + **Reschedule Interview** |
| `latest_round === null` | **Schedule {current_round} Interview** |
| `latest_round.round_status === 'SCHEDULED'` | **Mark as Completed** · **Place On Hold** |
| `latest_round.round_status === 'ON_HOLD'` | **Resume** (→ Scheduled) |
| `latest_round.round_status === 'COMPLETED'` | **Move to Next Round** · Jump to Round `<select>` · **Make Offer** |

**"Make Offer"** is shown whenever `latest_round.round_status === 'COMPLETED'` (any round, not just MGMT).

### 7. Scheduling Modal

Opens when user clicks **Schedule {Round} Interview** or **Reschedule Interview**.

Fields:
- Interviewer (user select, required)
- Date & Time (`scheduled_at`, required)
- Mode: Virtual / Phone / In-person
- Meeting Link (optional)

On submit: calls `interviews.create()` with:
```javascript
{
  mapping: c.id,
  round_name: scheduleModalRound,
  round_status: 'SCHEDULED',
  interviewer: selectedInterviewer,
  scheduled_at: selectedDateTime,
  mode: selectedMode,
  meeting_link: meetingLink,
}
```

After submit: `refreshAllCandidates(viewingJob.id)`, close modal.

For reschedule: `perform_create()` on the backend automatically clears `interview_status` and updates `current_interview_round`.

### 8. Action Handlers

```javascript
// Mark round status change
const handleRoundStatus = async (interviewId, newStatus) => { ... };

// Open scheduling modal
const handleScheduleInterview = (c, roundName) => {
  setScheduleModalCandidate(c);
  setScheduleModalRound(roundName);
};

// Submit scheduling modal
const handleScheduleSubmit = async (formData) => { ... };
```

---

## Behavior Rules

- Default progression is R1→R2→R3→CLIENT→CDO→MGMT, but skipping/jumping is always allowed
- **Next Round** requires current round to be `COMPLETED` — enforced by backend
- **Jump to Round** has no completion requirement — explicit user intent
- Rejected candidates stay in Interview tab, do not appear in Dropped tab
- Rescheduling a rejected candidate clears rejection and resumes them in the pipeline
- Make Offer is available after completing any round (not just final round)
- On Hold is reversible — Resume sets round_status back to SCHEDULED

---

## Out of Scope

- Feedback submission flow (no changes to `InterviewFeedbackCreateView`)
- Interviewer assignment notifications
- Calendar integrations
- Bulk round actions
