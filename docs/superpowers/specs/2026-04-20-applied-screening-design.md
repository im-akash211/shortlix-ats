# Applied Stage Screening Classification — Design Spec

**Date:** 2026-04-20  
**Status:** Approved

---

## Overview

Add lightweight screening classification within the Applied macro stage. Recruiters can mark Applied candidates as Screened, Maybe, or Rejected without changing their macro stage. A filter dropdown in the Applied tab lets users narrow the view. This is entirely self-contained — it does not affect the Dropped tab, pipeline stats, or any other stage.

---

## Backend

### Model Change

Add `screening_status` to `CandidateJobMapping`:

```python
SCREENING_STATUS_CHOICES = [
    ('SCREENED', 'Screened'),
    ('MAYBE', 'Maybe'),
    ('REJECTED', 'Rejected'),
]

screening_status = CharField(
    max_length=20,
    choices=SCREENING_STATUS_CHOICES,
    null=True,
    blank=True,
    default=None,
)
```

- `null` = unclassified (default for all new and existing candidates)
- No index needed — this field is only used for in-memory filtering on the frontend

### Migration

Auto-generated migration adding the nullable column to `candidates_candidatejobmapping`. No data migration required — all existing records default to `null`.

### New Endpoint

`PATCH /candidates/{id}/jobs/{job_id}/screening-status/`

**Request body:**
```json
{ "screening_status": "SCREENED" | "MAYBE" | "REJECTED" | null }
```

**Rules:**
- Returns `400` if `macro_stage != "APPLIED"` — screening classification is only valid on Applied candidates
- Accepts `null` to clear classification back to unclassified
- No `PipelineStageHistory` record — this is not a pipeline stage move

**Response:** Updated `CandidateJobMapping` serialized object (same shape as pipeline response).

### Serializer

`CandidateJobMappingSerializer` exposes `screening_status` as a plain read/write field. No computed logic.

---

## Frontend

### New State

```javascript
const [screeningFilter, setScreeningFilter] = useState('ALL');
```

Resets to `'ALL'` whenever `pipelineTab` changes.

### Filter Bar (Applied tab only)

Rendered between the tab row and the candidate list, only when `pipelineTab === 'Applied'`:

```jsx
<select value={screeningFilter} onChange={e => setScreeningFilter(e.target.value)}>
  <option value="ALL">All</option>
  <option value="SCREENED">Screened</option>
  <option value="MAYBE">Maybe</option>
  <option value="REJECTED">Rejected</option>
</select>
```

Filtering is purely client-side — `activeCandidates` is already loaded in `allCandidates`. Apply filter as:

```javascript
const visibleCandidates = (pipelineTab === 'Applied' && screeningFilter !== 'ALL')
  ? activeCandidates.filter(c => c.screening_status === screeningFilter)
  : activeCandidates;
```

### Screening Status Badge

On Applied cards only, shown top-right next to the stage badge:

| Status | Style |
|--------|-------|
| `SCREENED` | `bg-green-100 text-green-700` |
| `MAYBE` | `bg-amber-100 text-amber-700` |
| `REJECTED` | `bg-rose-100 text-rose-700` |
| `null` | No badge rendered |

### Card Actions (Applied tab)

Two buttons always shown on Applied cards:

1. **Shortlist** — primary CTA (blue, solid). Always visible. Calls `changeStage` → moves candidate to `SHORTLISTED`.
2. **Move to ▾** — secondary dropdown. Options shown depend on current `screening_status`:

| Current screening_status | "Move to" options |
|--------------------------|-------------------|
| `null` (unclassified) | Screened · Maybe · Rejected |
| `SCREENED` | Maybe · Rejected |
| `MAYBE` | Screened · Rejected |
| `REJECTED` | Screened · Maybe |

Selecting an option calls `candidatesApi.setScreeningStatus(candidateId, jobId, status)`, then updates `allCandidates` in-place (mutate the matching entry's `screening_status` field — no full refetch needed).

### New API Method

```javascript
// frontend/src/lib/api.js
candidates.setScreeningStatus = (candidateId, jobId, screeningStatus) =>
  request(`/candidates/${candidateId}/jobs/${jobId}/screening-status/`, {
    method: 'PATCH',
    body: JSON.stringify({ screening_status: screeningStatus }),
  });
```

---

## Behavior Rules

- Screening classification is **only visible and actionable** on the Applied tab
- Rejected screening status does **not** affect the Dropped tab count
- Rejected screening status does **not** appear in `PipelineStageHistory`
- Moving a candidate out of Applied (via Shortlist) **does not clear** `screening_status` — it's preserved as historical data on the mapping record
- All Applied candidates are visible by default (`screeningFilter = 'ALL'`)

---

## Out of Scope

- Screening notes or comments
- Screened-by / screened-at audit trail
- Bulk classification actions
- Screening status on non-Applied stages
