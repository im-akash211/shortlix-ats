# Applicant Tracking System

**Product Requirements Document**

---

| | |
|---|---|
| **Document Type** | Product Requirements Document (PRD) |
| **Version** | 1.0 |
| **Prepared For** | Engineering & Product Team |
| **Audience** | Manager / Stakeholders / Development Team |
| **Status** | Draft – Pending Review |
| **Date** | February 2026 |

---

## 1. Project Overview

This document outlines the full product requirements for building a custom, standalone Applicant Tracking System (ATS). The system will replace the existing ZWAM/Shorthills ATS setup and will manage the complete recruitment lifecycle — from requisition creation through candidate sourcing, screening, interview scheduling, and final disposition.

The Naukri Resdex integration present in the existing system will be entirely removed. Instead, all candidate sourcing will be done manually by recruiters who upload candidate resumes directly into the platform.

### 1.1 Purpose

To build a self-contained, role-based ATS that gives hiring managers, recruiters, and administrators a unified platform to manage all recruitment activities without dependency on any third-party job portal or resume database.

### 1.2 Scope

- Custom web-based ATS application (browser-accessible)
- Full recruitment workflow: Requisition → Approval → Job Management → Candidate Sourcing (via manual upload) → Shortlisting → Interview Scheduling → Feedback → Disposition
- Role-based access control (Admin, Hiring Manager, Recruiter)
- Dashboard with real-time recruitment analytics
- No Naukri / Resdex or any third-party sourcing integration

### 1.3 Users & Roles

| **Role** | **Who They Are** | **Primary Actions** |
|---|---|---|
| Admin | Talent Acquisition team admin / system owner | Manage users, system config, global visibility |
| Hiring Manager | Department heads / business stakeholders | Create/approve requisitions, review candidates, give final sign-off |
| Recruiter | TA team members | Upload resumes, manage talent pool, schedule interviews, track pipeline |

---

## 2. System Architecture & Tech Considerations

This section captures the high-level technical considerations the development team must plan for. Final technology stack decisions rest with the engineering team, but the following constraints are established by requirements.

### 2.1 Access Model

- Web-based platform accessible via any modern browser
- SSO (Single Sign-On) as primary login method; email + password as fallback
- Session-based authentication with role enforcement on every page

### 2.2 Data Privacy

- All candidate data must be stored securely on company-owned infrastructure
- Resume files (PDF, DOCX) must be stored with access control (only authorized users can view/download)
- Audit logs must be maintained for all profile actions (viewed, moved, edited, rejected)

### 2.3 Resume Parsing

- On upload, the system must auto-parse resumes to extract: candidate name, email, phone, location, years of experience, current designation, skills
- Parsed data pre-fills the candidate profile form; recruiter can review and correct before saving
- Support for PDF and DOCX formats at minimum

### 2.4 Notifications

- Email notifications for: interview invites (to candidate and interviewer), requisition approval requests, feedback reminders
- In-app notification bell for: pending approvals, pending interview feedback, upcoming interviews

---

## 3. Recruitment Lifecycle — Stage-by-Stage Requirements

All features described below follow the exact sequence of the recruitment lifecycle. Each stage depends on successful completion of the previous one. The system must enforce these dependencies.

---

### STAGE 1 — Requisition Creation

#### 3.1 Requisition Creation

A requisition is the starting point of every hire. It captures what the company needs to hire for, who requested it, and what the priority and timelines are. Requisitions must be approved before a job is activated.

#### 3.1.1 Who Can Create a Requisition

- Hiring Managers and Admins can create requisitions
- Recruiters cannot create requisitions but can view approved ones assigned to them

#### 3.1.2 Requisition Form Fields

| **Field** | **Type** | **Required** | **Notes** |
|---|---|---|---|
| Department | Dropdown | Yes | e.g. Backend, Full Stack, Data Engineering |
| Sub Vertical 1 | Dropdown | Yes | First-level role category (e.g. Frontend, DevOps) |
| Sub Vertical 2 | Dropdown | No | Second-level role sub-category |
| Requisition Title | Text Input | Yes | Becomes the job title once approved |
| Requisition Description (JD) | Rich Text Editor | Yes | Supports bold, bullets. AI-generate button available |
| Roles & Responsibilities | Rich Text Editor | Yes | AI-generate button available |
| Priority | Dropdown | Yes | Low / Medium / High / Critical |
| Employment Type | Dropdown | Yes | Permanent / Contract / Internship |
| Requisition Type | Dropdown | Yes | New Position / Backfill |
| Client Name | Text / Dropdown | No | Name of client if applicable |
| Location | Dropdown | Yes | City/Office location (e.g. Gurugram, Noida) |
| CTC Range (Min–Max) | Numeric Inputs | No | Expected salary band in LPA |
| Years of Experience (Min–Max) | Numeric Inputs | Yes | Expected experience range |
| Number of Positions | Numeric Input | Yes | Headcount for this requisition |
| Designation | Text Input | Yes | Expected seniority level/designation |
| Expected Start Date | Date Picker | Yes | Date recruiter should start sourcing |
| Mandatory Skills | Multi-Tag Input | Yes | Comma-separated or tag-style key skills |
| Desirable Skills | Multi-Tag Input | No | Nice-to-have skills |
| Hiring Manager Name | Autocomplete User | Yes | Must be an active user in system |
| Project Name | Text Input | No | Internal project name if applicable |
| Minimum Qualification | Dropdown | No | e.g. B.Tech, MBA, Any Graduate |
| Diversity Preference | Checkbox | No | Flag if female diversity hire preferred |
| Institute Preference | Checkbox Multi-select | No | e.g. IIT, NIT, Top Institutes |
| L1 Approver Email | Autocomplete User | Yes | Person who approves this requisition |

#### 3.1.3 AI-Assisted JD Generation

- A 'Generate' button next to Requisition Description and Roles & Responsibilities fields
- On click, the system uses the Requisition Title and selected skills to generate JD content
- Generated content is editable before saving
- This is a helper feature — the form can also be filled manually

#### 3.1.4 Requisition List View

- Two tabs: My Requisitions (created by me or assigned to me) and All Requisitions
- Columns: Requisition ID, Title, Status, Department, Created Date, Hiring Manager, Applies, Shortlists, Offers, Joined, Actions
- Status values: Draft, Pending Approval, Approved, Rejected, Closed
- 'Create Requisition' button prominently visible
- Filter option: 'Show only requisitions pending on me' (checkbox)
- Search by keyword across requisition title and description

---

### STAGE 2 — Requisition Approval

#### 3.2 Requisition Approval

Once a requisition is submitted, it enters an approval workflow before any hiring activity can begin. This ensures the hire is authorized by the appropriate authority.

#### 3.2.1 Approval Workflow

1. Hiring Manager submits the requisition and designates an L1 Approver
2. The L1 Approver receives an email notification and an in-app alert
3. The approver logs in, reviews the requisition details, and takes action: Approve or Reject
4. If approved, the requisition automatically transitions to an active Job and appears in the Jobs list
5. If rejected, the submitter is notified with the rejection reason and can edit and resubmit

#### 3.2.2 Approvals Dashboard (Manage Approvals Page)

- Accessible by the approver (Hiring Manager role or above)
- Shows three counters: Pending, Approved, Rejected
- List view with columns: Applicant/Req Name, Job Applied, Status, Source, Last Action Date, Actions
- Approver can click a requisition to open full details before approving
- Approval action logs timestamp, approver name, and any remarks

---

### STAGE 3 — Job Management

#### 3.3 Job Management

Once a requisition is approved, it becomes an active Job. Jobs are the entities recruiters work on for sourcing, uploading profiles, and tracking pipeline progress.

#### 3.3.1 Job List View

- Two tabs: My Jobs (created/collaborated) and All Jobs
- Filter by status: Open, Hidden, Closed, All
- Right-side filter panel: by Recruiter, Department, Hiring Manager, Location
- Each job card shows: Job ID, Title, Location, Date Created, Applies, Shortlists, Offers, Joined counts
- Action buttons per job: View, Add Profile, Collaborators

#### 3.3.2 Collaborators Feature

- Each job can have one or more recruiters assigned as Collaborators
- Only collaborators can access and work on a specific job
- Admin and the hiring manager can always see all jobs
- Collaborators are added by entering their registered email address
- A recruiter not added as collaborator cannot see or access the job

#### 3.3.3 Job Detail Page

- Full job description, skills, requirements visible
- Candidate pipeline view by stage (Applied, Shortlisted, Interview Scheduled, On Hold, Rejected)
- Quick actions: Add Profile, Upload Profile (bulk), Schedule Interview
- Resdex Search tab removed entirely — candidate sourcing is manual upload only

---

### STAGE 4 — Candidate Sourcing — Talent Pool & Profile Upload

#### 3.4 Candidate Sourcing & Profile Management

All candidate sourcing is done by recruiters through direct resume uploads. There is no integration with any external job portal. Recruiters upload resumes individually or in bulk, which are parsed and stored in the Talent Pool.

#### 3.4.1 Profile Upload Methods

| **Method** | **Description** | **When to Use** |
|---|---|---|
| Single Profile Upload (Add Profile) | Recruiter attaches one resume. System parses it and opens a form for the recruiter to verify and fill remaining details. | When adding one candidate at a time with full attention to detail |
| Quick Upload (Upload Profile) | Faster form with fewer mandatory fields. Resume parsing pre-fills what it can. | When recruiter is processing many profiles quickly |
| Bulk Upload via Excel Sheet | Recruiter uploads a structured Excel file with multiple candidate records. System processes each row as a new profile. | When onboarding a large batch of candidates from an external spreadsheet |

#### 3.4.2 Add Profile Form Fields

| **Field** | **Required** | **Notes** |
|---|---|---|
| Resume File (PDF/DOCX) | Yes | Uploaded file; triggers auto-parsing |
| Candidate Name | Yes | Auto-filled from resume parse |
| Email Address | Yes | Auto-filled; must be unique in system |
| Phone Number | Yes | Auto-filled from resume parse |
| Location (Current) | Yes | City |
| Total Experience (Years) | Yes | Numeric |
| Current Designation | No | Auto-filled from resume |
| Current Company | No | Auto-filled from resume |
| Source | Yes | e.g. Recruiter Upload, LinkedIn, Referral, Indeed, CareerSite |
| 10th Marks & Board | No | Educational details |
| 12th Marks & Board | No | Educational details |
| Undergraduate Marks & Degree | No | Educational details |
| Key Skills (Tags) | No | Auto-filled from resume; editable |
| CTC (Current) | No | In LPA |
| Notice Period | No | In days |
| Notes | No | Free text notes by recruiter |

#### 3.4.3 Bulk Excel Upload Format

- The system provides a downloadable Excel template with pre-defined column headers
- Required columns: Name, Email, Phone, Location, Experience (Years), Current Designation, Source
- Optional columns: Current Company, CTC, Notice Period, Key Skills
- On upload, system validates each row; invalid rows are flagged in an error report
- Successfully imported profiles appear in the Talent Pool immediately

#### 3.4.4 Talent Pool Search

- Central repository of all candidates uploaded into the system across all jobs
- Search by: Name, Email, Phone Number, Keyword
- Filter panel (right side): By Experience (Years), By Current Status, By Source
- Status filter options: Pending, Shortlisted, Rejected, Interview Scheduled, On Hold, Not Selected
- Source filter: Recruiter Upload, LinkedIn, Referral, Indeed, CareerSite, etc.
- Bulk Upload button accessible from this page

#### 3.4.5 Candidate Profile Actions

| **Action** | **Icon** | **Description** |
|---|---|---|
| View Resume | Eye icon | Opens uploaded resume file in a preview panel / new tab |
| Download Resume | Download icon | Downloads the resume file to the recruiter's system |
| Add Note | Note/Plus icon | Adds a timestamped free-text note to the candidate's profile (CTC discussion, rejection reason, etc.) |
| Edit Profile | Pencil icon | Opens the profile form to update any field (experience, education, skills, etc.) |
| Move | Move button | Moves the candidate to a different active job. Can carry history or start as fresh apply. Requires a reason. |

---

### STAGE 5 — Shortlisting

#### 3.5 Shortlisting

Recruiters review uploaded candidate profiles against the job requirements and mark candidates as shortlisted, rejected, or on hold. The shortlisted candidates proceed to the interview stage.

#### 3.5.1 Shortlisting Actions

- From within a Job's candidate list, recruiter can set status for each profile
- Available statuses: Pending (default), Shortlisted, Rejected, On Hold
- Rejections and holds require a reason (selected from a predefined dropdown or free text)
- Shortlisted candidates move to the interview queue

#### 3.5.2 Shortlisting View

- Filterable candidate list within a Job by status
- Bulk action: select multiple profiles and change status in one action
- Notes added during shortlisting are visible to all collaborators on the job

---

### STAGE 6 — Interview Scheduling

#### 3.6 Interview Scheduling

Recruiters schedule interviews for shortlisted candidates. The system sends automated invites to both the candidate and the interviewer. Multiple interview rounds can be scheduled sequentially.

#### 3.6.1 Schedule Interview Form

| **Field** | **Options / Notes** |
|---|---|
| Interview Date | Date picker |
| Interview Mode | Virtual / Phone Call / Face-to-Face |
| Time Slot | Time picker (HH:MM AM/PM) |
| Feedback Form Type | Tech / Non-Tech / Custom forms (admin-defined) |
| Competencies to Evaluate | Multi-select from skills defined on the job; or 'Select All' |
| Interview Round | Round 1 (Evaluation Round 1 - Tech) / Round 2 / HR / Final |
| Interviewer Email | Autocomplete from registered user list (multiple interviewers supported) |
| Candidate Email | Auto-populated from profile (editable in case of correction) |

#### 3.6.2 Post-Scheduling Behaviour

- System sends calendar invite (ICS) + email to both candidate and interviewer
- Interview appears in the interviewer's 'My Interviews' section
- Interview appears in the recruiter's 'Scheduled by Me' section
- Status of candidate profile updates to 'Interview Scheduled'

#### 3.6.3 Interview Reschedule & Cancellation

- Recruiter can reschedule or cancel any upcoming interview
- On reschedule: updated invite sent to all parties
- On cancellation: cancellation notification sent to all parties; candidate status reverts to Shortlisted

---

### STAGE 7 — Interview Feedback & Disposition

#### 3.7 Interview Feedback & Disposition

After each interview, the interviewer must submit structured feedback through the system. Feedback drives the hiring decision. The recruiter then updates the final status of the candidate.

#### 3.7.1 Feedback Collection

- Each interviewer sees pending feedback requests in their 'My Interviews' view
- Feedback form fields: Rating per competency (1-5 scale), Overall Rating, Recommendation (Proceed / Hold / Reject), Comments
- Recruiter is notified when feedback is submitted
- Feedback is visible to collaborators on the job; optionally visible to hiring manager

#### 3.7.2 Candidate Disposition (Final Status)

| **Status** | **Meaning** | **Triggered By** |
|---|---|---|
| Selected | Candidate has cleared all rounds and is ready for offer | Recruiter / Hiring Manager |
| Rejected | Candidate did not clear one or more rounds | Recruiter based on feedback |
| On Hold | Candidate kept in reserve; not selected or rejected yet | Recruiter / Hiring Manager |
| Offered | Offer letter extended to the candidate | Out of scope for this ATS — tracked as a counter only |
| Joined | Candidate has joined the company | Out of scope for this ATS — tracked as a counter only |

> **Note:** Offer and Joining management is handled outside this ATS. The platform tracks these as numeric counts only (passed in from an external system or manually updated by admin).

---

## 4. Module-by-Module Feature Summary

### 4.1 Dashboard

The dashboard is the landing page after login. It gives every user a real-time overview of recruitment health.

| **Metric Card** | **Description** | **Filterable By** |
|---|---|---|
| Open Jobs | Total active job openings in system | Department, Location |
| Views | Candidate profiles accessed in the selected period | Weekly / Monthly / Quarterly |
| Applies | Total applications received against open jobs | Weekly / Monthly / Quarterly |
| Pending | Profiles awaiting shortlisting decision | Weekly / Monthly / Quarterly |
| Shortlists | Profiles marked shortlisted | Weekly / Monthly / Quarterly |
| Interviews | Total interviews scheduled | Weekly / Monthly / Quarterly |
| On Hold | Profiles currently on hold | Weekly / Monthly / Quarterly |
| Rejects | Total rejections (profile + interview combined) | Weekly / Monthly / Quarterly |

- Recruitment Progress chart: visual bar/funnel showing All Candidates → Progressed → Shortlisted → Selected → Pending
- Actions Pending panel (right side): quick links to Approvals Pending, Interviews Pending
- Job Filters panel: filter dashboard stats by Designation, Hiring Manager, Department, Location, Recruiter, Job Visibility

### 4.2 Manage Jobs

- My Jobs / All Jobs tabs
- Status filter: Open / Hidden / Closed / All
- Per-job action buttons: View, Add Profile, Collaborators, Resdex Search (to be removed)
- Right-side filter panel: Recruiter, Department, Hiring Manager, Location
- Job card shows: ID, Title, Location, Date Created, Applies / Shortlists / Offers / Joined counts

### 4.3 Talent Pool

- 5,000+ profile repository searchable by keyword (name, email, phone)
- Advanced search by experience range, status, and source
- Each profile row: Name, Contact, Job Applied, Status, Source, Last Action Date, Move/Action buttons
- Profile actions: View, Download, Note, Edit, Move
- Bulk upload accessible from this screen

### 4.4 Manage Approvals

- Accessible by approvers (Hiring Managers and above)
- Counter tiles: Pending, Approved, Rejected
- List view of all requisitions pending approver action
- Approver can open full requisition detail before deciding

### 4.5 Manage Interviews

| **Tab** | **Description** |
|---|---|
| My Interviews | Interviews where the logged-in user is the interviewer. Shows: Pending Confirmation, Upcoming, Pending Feedback, Completed, Archived. |
| Scheduled by Me | Interviews scheduled by the logged-in recruiter. Shows pending feedback items for follow-up. |
| All Schedules | Admin/Manager view of all scheduled interviews. Filterable by date range, round, department. |

- Columns: Applicant, Job Title, Interviewers, Stage/Round, Scheduled Date & Time, Actions (View Feedback)
- Total interviews completed counter shown at the top

### 4.6 Manage Requisitions

- My Requisitions / All Requisitions tabs
- Create Requisition button
- List view with status, department, hiring manager, pipeline counts
- Filter: Show only requisitions pending on me
- Actions: View, Edit (if Draft), Clone

### 4.7 Settings / Admin

This module is accessible to Admin users only. Its primary use in day-to-day operations is user management.

#### Manage Users

- Add new user by entering their company email address
- Assign role: Admin / Hiring Manager / Recruiter
- Deactivate existing users
- View list of all active users with their roles

#### System Configuration (Admin Only)

- Manage Departments and Sub-Verticals (dropdown options)
- Manage Feedback Form Templates (Tech / Non-Tech / Custom)
- Configure Email Notification Templates
- Configure Offer/Join status update rules

---

## 5. Features Explicitly Removed from New Build

The following features exist in the current ZWAM ATS but will **NOT** be built into the new platform:

| **Removed Feature** | **Reason** |
|---|---|
| Naukri Resdex Integration | All candidate sourcing is now done via manual uploads. No external job portal integration required. |
| Resdex Search (per job) | Directly tied to Naukri integration. Removed along with it. |
| Direct Naukri Profile Import | Recruiter downloads from Naukri manually and uploads to the system. No API bridge. |
| Knockri Video Assessment Integration | Not in scope for the new build. |

---

## 6. Non-Functional Requirements

| **Category** | **Requirement** |
|---|---|
| Performance | Page load time under 3 seconds for all list views with up to 10,000 records |
| Scalability | System must support at least 10,000 candidate profiles and 500 concurrent users without degradation |
| Security | All data encrypted in transit (HTTPS/TLS). User passwords hashed. Role enforcement server-side. |
| Resume Storage | Uploaded resumes stored in a secure file store (e.g. S3 or equivalent). Not served directly from the database. |
| Browser Compatibility | Must work on Chrome, Edge, and Safari (latest two versions) |
| Responsiveness | Functional on desktop (minimum 1280px wide). Mobile view is a nice-to-have, not required. |
| Audit Logs | All candidate status changes, resume accesses, and user management actions must be logged with timestamp and actor |
| Uptime | 99% uptime during business hours (9 AM to 9 PM IST, Monday to Saturday) |
| Data Export | Recruiters must be able to export candidate lists to Excel/CSV from any list view |
| Email Delivery | Transactional emails (invites, approvals) must be delivered within 2 minutes of trigger |

---

## 7. End-to-End Workflow Summary

The following table summarises the complete recruitment workflow in sequence, showing who does what and what the system does in response.

| **Step** | **Actor** | **Action** | **System Response** |
|---|---|---|---|
| 1 | Hiring Manager | Creates a Requisition (fills form, submits to L1 Approver) | Saves as 'Pending Approval'; sends notification to L1 Approver |
| 2 | L1 Approver (Hiring Manager) | Reviews and Approves/Rejects requisition | If approved: creates active Job. If rejected: notifies submitter. |
| 3 | Admin / Recruiter | Adds Collaborators to the Job | Collaborators gain access to the job and its candidate pipeline |
| 4 | Recruiter | Uploads candidate resumes (Single / Quick / Bulk Excel) | Resumes parsed, profiles created, appear in Talent Pool and Job pipeline |
| 5 | Recruiter | Reviews profiles and sets status: Shortlisted / Rejected / On Hold | Status updated, counters on dashboard refreshed |
| 6 | Recruiter | Schedules interview for shortlisted candidates | Invite emails sent to candidate and interviewer; interview appears in both parties' dashboards |
| 7 | Interviewer | Conducts interview and submits feedback form | Feedback saved; recruiter notified; candidate status auto-updates |
| 8 | Recruiter / HM | Sets final disposition: Selected / Rejected / On Hold | Candidate status finalised; dashboard stats updated |
| 9 | Recruiter | Marks Offered / Joined (manual update or external system sync) | Offer and Joined counters incremented on dashboard and requisition list |

---

## 8. Assumptions & Constraints

### 8.1 Assumptions

- All users are company employees with company email addresses. No external recruiter portal.
- Candidates do not directly interact with this system. This is a backend recruiter tool only.
- A separate careers portal (job application page) is out of scope for this build.
- Offer letters and onboarding documentation are managed in a separate system.
- Interview feedback forms will be predefined before go-live by the Admin.
- The system will be deployed on company infrastructure or a private cloud.

### 8.2 Constraints

- No Naukri / LinkedIn / Indeed API integration in this version
- Bulk Excel upload requires a specific template format provided by the system
- The platform is English-only in this version
- Multi-currency support is not required; all CTC values in INR Lakhs

### 8.3 Out of Scope (Future Phases)

- Candidate-facing job portal / self-apply feature
- Offer letter generation within the ATS
- Onboarding workflow
- Third-party job board integrations (LinkedIn, Indeed, etc.)
- Mobile native app
- Advanced AI screening / resume scoring

---

## 9. Feature Priority & Delivery Phasing

The following phasing plan is recommended. Phase 1 must be complete before recruitment can begin on the new platform.

| **Phase** | **Features** | **Priority** |
|---|---|---|
| Phase 1 — Core (MVP) | User login (SSO + email), Role management, Requisition creation + approval workflow, Job creation and listing, Single & bulk profile upload, Talent pool search, Basic shortlisting (status management), Dashboard (core metrics) | Critical |
| Phase 2 — Interview Workflow | Interview scheduling with email invites, My Interviews / Scheduled by Me views, Feedback form submission, Candidate disposition (Selected / Rejected) | High |
| Phase 3 — Analytics & Productivity | Full dashboard with all charts and filters, Recruitment Progress funnel chart, Data export (Excel/CSV), Profile move across jobs, Collaborator management | Medium |
| Phase 4 — Admin & Polish | Full settings module, Notification templates, Audit logs, Performance optimisation, Edge case handling | Low (Post-Launch) |

---

*— End of Document —*

