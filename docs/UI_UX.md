# UI/UX Specification Document
## Digital Tracking & Optimization of Government Asset Maintenance (GovAsset)

**Document Version:** 1.0.0  
**Target Design Standard:** WCAG 2.2 Level AA Compliant  
**Design Persona:** Civic-Grade, Clean, High-Affordance, Utility-First  
**Supported Locales:** English (`en-IN`), Hindi (`hi-IN`)  

---

### 1. Product Design Principles & Philosophy

GovAsset is an operational civic utility platform built for high accountability, rapid comprehension, and extreme reliability under varying field conditions. It deliberately avoids decorative design trends such as glassmorphism, glowing neons, gratuitous hero illustrations, and bloated card widgets.

```
+-------------------------------------------------------------------------------+
| CORE DESIGN PILLARS                                                           |
+-------------------+-----------------------------------------------------------+
| 1. High Contrast  | 100% legible in direct tropical sunlight for field staff  |
|    & Legibility   | and citizens on low-nits budget smartphone displays.      |
+-------------------+-----------------------------------------------------------+
| 2. Information    | Operational queues prioritize dense, tabular, actionable  |
|    Density        | data over excessive whitespace and oversized cards.       |
+-------------------+-----------------------------------------------------------+
| 3. Zero-Ambiguity | Statuses, SLAs, and jurisdictions use standardized badges |
|    Affordances    | and explicit labels, eliminating subjective guessing.     |
+-------------------+-----------------------------------------------------------+
| 4. Defensive UX   | Destructive actions (rejections, disputes) require        |
|                   | explicit reasons and confirmation dialogs.                |
+-------------------+-----------------------------------------------------------+
| 5. Bandwidth-     | Lightweight CSS payloads, zero web font bloat, and fast  |
|    Aware          | skeleton screens optimized for spotty 3G/4G connections.  |
+-------------------+-----------------------------------------------------------+
```

---

### 2. Design Tokens & Design System Foundations

#### 2.1 Color Palette
The color system uses semantic, high-contrast tokens built on a neutral slate foundation with civic navy and municipal safety accents.

```
Semantic Color Hierarchy:
├── Primary / Civic Navy     : Brand, header navigation, active state accents
├── Neutral Palette (Slate)  : Backgrounds, borders, typography hierarchy
├── Success / Emerald        : Resolved status, SLA on-track, approval actions
├── Warning / Amber          : In-progress, SLA at-risk (< 25% remaining)
├── Danger / Crimson         : P1-Critical priority, SLA breached, rejections
└── Info / Cobalt            : Submitted status, informational callouts
```

| Token Name | Hex Code | Contrast vs Light BG (`#F8FAFC`) | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `color-civic-900` | `#0F172A` | `15.8:1` (Pass AAA) | Primary headings, main navigation headers, high-emphasis text |
| `color-civic-800` | `#1E293B` | `12.6:1` (Pass AAA) | Body text, table data cells, primary action button hover |
| `color-civic-700` | `#334155` | `9.1:1` (Pass AAA) | Secondary labels, table column headers, helper text |
| `color-civic-600` | `#475569` | `6.8:1` (Pass AA) | Muted text, disabled labels, icon fills |
| `color-civic-300` | `#CBD5E1` | `1.6:1` (UI Border) | Component borders, table row dividers, card borders |
| `color-civic-100` | `#F1F5F9` | `1.1:1` (Subtle BG) | Table alternate row fill, disabled inputs, badge backgrounds |
| `color-civic-50` | `#F8FAFC` | `1.0:1` (Canvas) | Page canvas background, modal backdrop base |
| `color-brand-blue`| `#1D4ED8` | `7.2:1` (Pass AAA) | Primary interactive buttons, hyperlinks, active tab indicators |
| `color-success-700`| `#15803D`| `5.2:1` (Pass AA) | "Resolved" status text, SLA "Complied" badges |
| `color-success-50` | `#F0FDF4` | `N/A` (Background) | Success callout banner background, resolved badge fill |
| `color-warning-700`| `#B45309`| `4.8:1` (Pass AA) | "In Progress" status text, SLA "At-Risk" alerts |
| `color-warning-50` | `#FFFBEB` | `N/A` (Background) | Warning callout banner background, at-risk badge fill |
| `color-danger-700` | `#B91C1C` | `6.1:1` (Pass AA) | "Breached" SLA badges, P1-Critical flags, rejection text |
| `color-danger-50` | `#FEF2F2` | `N/A` (Background) | Danger callout banner background, breach badge fill |

#### 2.2 Typography Scale
Standard system font stack with multi-script Unicode support for English and Devanagari (Hindi):
`font-family: 'Inter', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`

| Style Level | Size (px / rem) | Line Height | Font Weight | Letter Spacing | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display H1** | `32px / 2.0rem` | `40px / 2.5rem` | `700` (Bold) | `-0.02em` | Portal landing headlines, public success screens |
| **Page H2** | `24px / 1.5rem` | `32px / 2.0rem` | `600` (SemiBold)| `-0.01em` | Section headers, modal titles, operational queue titles |
| **Section H3** | `18px / 1.125rem`| `26px / 1.625rem`| `600` (SemiBold)| `0` | Card titles, drawer headers, panel section labels |
| **Body Large** | `16px / 1.0rem` | `24px / 1.5rem` | `400` (Regular) | `0` | Form inputs, citizen long descriptions, primary body |
| **Body Medium** | `14px / 0.875rem`| `20px / 1.25rem` | `400` / `500` | `0` | Table data cells, dropdown items, filter labels |
| **Caption / Small**| `12px / 0.75rem`| `16px / 1.0rem` | `500` / `600` | `+0.01em`| Badges, SLA countdown timers, timestamp metadata |
| **Monospace** | `13px / 0.8125rem`| `18px / 1.125rem`| `600` (SemiBold)| `+0.04em`| Ticket Reference IDs (`GOV-2026-XXXXX`), GPS coordinates |

#### 2.3 Spacing, Radii, Shadows & Breakpoints
- **4px / 8px Modular Spacing Grid:** `space-1` (4px), `space-2` (8px), `space-3` (12px), `space-4` (16px), `space-6` (24px), `space-8` (32px), `space-12` (48px).
- **Border Radii:** Strictly bounded to prevent bubbly, juvenile aesthetics:
  - `radius-sm`: `4px` (Inputs, table rows, badges)
  - `radius-md`: `6px` (Buttons, modals, card containers)
  - `radius-lg`: `8px` (Main drawer panels, flyouts)
  - `radius-full`: `9999px` (Pill badges only)
- **Elevation / Shadows:**
  - `shadow-subtle`: `0 1px 2px 0 rgba(15, 23, 42, 0.05)` (Cards, input fields)
  - `shadow-elevated`: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` (Modals, dropdowns)
- **Breakpoints:**
  - `sm`: `640px` (Mobile phones in landscape, large phones)
  - `md`: `768px` (Tablets, iPads)
  - `lg`: `1024px` (Laptops, desktop operations consoles)
  - `xl`: `1280px` (Standard desktop monitors)
  - `2xl`: `1536px` (Wide command-center screens)

---

### 3. Portal Visual Identity & Navigation Architectures

The three portals share design system primitives but have distinct layout frames optimized for their user personas:

```
+-------------------------------------------------------------------------------+
| PORTAL NAVIGATION ARCHITECTURES                                               |
+-------------------+-----------------------------------------------------------+
| 1. Citizen Portal | Top public masthead with National/Municipal Emblem +      |
|                   | Clean language switcher (EN/HI) + Large CTA "Report Issue"|
|                   | Mobile: Persistent bottom bar (Home, Track, My Complaints)|
+-------------------+-----------------------------------------------------------+
| 2. Gov Ops Portal | Persistent left-hand collapsible navigation sidebar +    |
|                   | Top utility bar (Ward/Dept context pill, Alerts, Profile) |
|                   | Main area: Sticky filter bar + high-density data grid     |
+-------------------+-----------------------------------------------------------+
| 3. Admin Portal   | Dual-tone executive sidebar (Dark Navy `#0B132B`) +       |
|                   | Top breadcrumb path + System Health status indicator      |
|                   | Main area: Tabbed administrative forms and metric tables  |
+-------------------+-----------------------------------------------------------+
```

---

### 4. Page-by-Page Detailed Specifications

#### 4.1 Portal A: Citizen Portal

##### 4.1.1 Public Landing & Tracking Page (`/` and `/track`)
- **Header:** Municipal Corporation logo, platform name ("GovAsset"), language toggle `[English | हिन्दी]`, "Sign In" link.
- **Hero Tracker Box (High-Affordance Utility):**
  - Instant Track input field: `[ Enter Reference Number, e.g., GOV-2026-00482 ]` + `[ Track Issue ]` button.
  - Quick Category shortcut cards: 6 square icon tiles (Roads, Streetlights, Water Supply, Sanitation, Public Parks, Other).
  - Prominent Primary CTA Button: `[ + Report a New Civic Problem ]` (Spans full width on mobile).

##### 4.1.2 Multi-Step Issue Submission Wizard (`/report`)
Structured as a 3-step progressive disclosure wizard to prevent cognitive overload:

```
Step 1: Location & Category  ───>  Step 2: Evidence & Description  ───>  Step 3: Citizen Verification
```

- **Step 1: Location & Category**
  - *Location Card:* "Use My Current Location" button with GPS spinner.
  - *Map Component:* Interactive Leaflet/OpenStreetMap preview. Draggable marker with tooltip: *"Drag pin to exact defect location"*.
  - *Address Input:* Pre-filled via reverse geocoding; editable text input for *"Street, House/Shop No., Landmark (Required)"*.
  - *Ward Indicator:* Auto-detected Ward badge: `[ Ward 28 - Kothrud ]` with a link to override manually if GPS is inaccurate.
  - *Category Picker:* Grid of radio cards with clear civic icons and bilingual subtitles.
- **Step 2: Evidence & Description**
  - *Photo Upload Dropzone:* Accepts up to 3 photographs.
    - Drag-and-drop zone with camera icon on desktop.
    - On mobile: Triggers native camera capture with a fallback to photo gallery.
    - Thumbnail row with file size indicators and `[Remove]` button.
    - Inline client-side auto-compression indicator: *"Compressing 4.2 MB -> 480 KB (WebP)... Ready"*.
  - *Problem Description:* Textarea (min 20, max 500 characters) with live character counter.
  - *Urgency / Safety Hazard Flag:* Checkbox: *"This poses an immediate public safety hazard (e.g., exposed live wire, deep trench on main road)"*.
- **Step 3: Citizen Verification & Submit**
  - *Mobile Number Input:* `[ +91 ] [ 10-digit mobile number ]`.
  - *OTP Verification:* Inline 4-digit OTP box if user is not logged in.
  - *Summary Review Box:* Compact review card displaying Location, Category, and Attached Photo thumbnails.
  - *Action Buttons:* `[ Back ]` (Outline) and `[ Submit Civic Complaint ]` (Solid Brand Blue).

##### 4.1.3 Complaint Tracking & Timeline View (`/track/[referenceNumber]`)
- **Reference Header:**
  - `GOV-2026-00482` (Large Monospace), Status Pill (`IN_PROGRESS`), Ward Badge (`Ward 28 - Kothrud`), Department (`Road Maintenance Dept`).
- **Interactive Stepper Timeline:**
  - Vertical timeline with 5 distinct milestones:
    1. *Submitted* (Date & Time)
    2. *Acknowledged & Triaged* (Assigned Priority: P2)
    3. *Work In Progress* (Field team dispatched)
    4. *Work Completed* (Under verification)
    5. *Verified & Resolved* (Final closure)
  - Public notes visible (e.g., *"Patching materials dispatched to site"*).
  - Citizen PII strictly absent; internal government remarks filtered out.
- **Before & After Visual Comparison Drawer (When Resolved):**
  - Side-by-side photo comparison slider comparing original citizen photo with field crew's "After" verification photo.
- **Dispute Resolution Panel (Active for 7 Days Post-Resolution):**
  - Prominent banner: *"Is the problem not fixed properly? You have 5 days left to dispute this resolution."*
  - `[ Dispute Resolution ]` button triggers modal requiring explanation and a new photo.

---

#### 4.2 Portal B: Government Operations Portal

```
+----------------------------------------------------------------------------------------------------+
| GOV OPS WORKBENCH LAYOUT                                                                           |
+------------------+---------------------------------------------------------------------------------+
| SIDEBAR          | TOP UTILITY BAR: [ Ward: 28-Kothrud v ]  [ Dept: Roads v ]   [ Alert (3) ] [User]|
| - Triage Queue   +---------------------------------------------------------------------------------+
| - Assigned Tasks | FILTER BAR: [ Search ID/Keyword ] [ Status v ] [ Priority v ] [ SLA Health v ]   |
| - Verifications  +---------------------------------------------------------------------------------+
| - Field Workers  | DATA TABLE                                                                      |
| - Ward Reports   | [ ] | Ref ID        | Category  | Location   | SLA Remaining | Priority | Action |
|                  | [ ] | GOV-2026-00482| Pothole   | Mayur Col. | 4h 12m (WARN) | P2-High  | Review |
|                  | [ ] | GOV-2026-00483| Paver Blk | Shivaji Rd | 42h (OK)      | P3-Med   | Review |
+------------------+---------------------------------------------------------------------------------+
```

##### 4.2.1 Operational Triage Inbox (`/ops/triage`)
- **Filter & Search Ribbon:**
  - Multi-select Category dropdown.
  - SLA Status Filter tabs: `All (42)`, `At Risk (6)`, `Breached (2)`, `Unassigned (14)`.
  - Full-text search matching Reference ID, Street Name, or Description.
- **High-Density Table View:**
  - Columns: Checkbox, Reference ID, Thumbnail, Category, Location/Ward, Submitted Age, SLA Remaining (Countdown Timer), Priority Badge, Actions.
  - Row Hover: Highlights row; clicking opens Side Drawer without navigating away.
  - Bulk Actions Toolbar (Appears on row selection): `[ Assign Supervisor ]`, `[ Export CSV ]`.

##### 4.2.2 Complaint Detail & Triage Drawer (`/ops/complaints/[id]`)
Sliding right-side drawer (width: 680px on desktop) providing complete contextual review:
- **Header:** Reference ID, Citizen Submission Time, Status Badge.
- **Tab 1: Overview & Location:**
  - Embedded map pin with satellite imagery toggle.
  - Citizen submitted photos with click-to-zoom modal.
  - Reverse-geocoded street address + Citizen landmark notes.
  - Citizen Contact Info: Masked (`+91 ******4819`) with `[ View Full Phone (Audited) ]` action.
- **Tab 2: Potential Duplicate Reports:**
  - System card: *"2 complaints found within 75 meters in the last 48 hours"*.
  - `[ Compare & Merge into Master Ticket ]` action button.
- **Action Footer (Sticky):**
  - `[ Reject / Invalid ]` (Triggers Reason Modal)
  - `[ Assign Field Worker / Crew ]` (Opens Assignment Picker)
  - `[ Save Internal Note ]` (Records private comment)

##### 4.2.3 Field Worker Mobile Task View (`/ops/field`)
Designed specifically for rugged smartphone use by field workers in outdoor conditions:
- **Header:** Simplified high-contrast black/yellow masthead: *"GovAsset Field Crew"*.
- **Task Card:**
  - Work Order ID, Defect Category, Exact Landmark.
  - `[ Open in Google Maps Navigation ]` one-tap external navigation button.
  - Target Completion Time badge (`Due Today by 4:00 PM`).
- **One-Tap Status Updaters:**
  - Button 1: `[ Mark On Site / Work Started ]` (Transitions ticket to `IN_PROGRESS`).
  - Button 2: `[ Capture "After" Photo & Complete ]`:
    - Opens native mobile camera.
    - Validates browser GPS is within 200m of the defect.
    - Prompts for brief material/work note (e.g., *"Cold mix asphalt applied, 2m x 1m"*).
    - `[ Submit for Supervisor Approval ]`.

##### 4.2.4 Supervisor Verification Drawer (`/ops/verifications`)
- Split-screen comparison view:
  - Left pane: Original Citizen "Before" photo with submission timestamp.
  - Right pane: Field Worker "After" photo with completion timestamp and GPS match score.
- Decision Actions:
  - `[ Approve & Mark Resolved ]` (Transitions ticket to `VERIFIED_RESOLVED`).
  - `[ Return for Rework ]`: Opens mandatory dialog requiring rework reason (e.g., *"Surface uneven, roll again"*) and new target deadline.

---

#### 4.3 Portal C: Platform Administrator Portal

##### 4.3.1 Administrative Dashboard & SLA Monitor (`/admin`)
- **Metric Cards (Key Civic Indicators):**
  - *Active Complaints:* Total pending across all wards.
  - *SLA Compliance Rate:* Percentage of complaints resolved within target time (with +/- weekly delta).
  - *Verification Backlog:* Work completed waiting for supervisor review $> 24$ hours.
  - *Dispute Rate:* Percentage of closed tickets disputed by citizens.
- **Ward SLA Compliance Heatmap / Table:**
  - Sortable table ranking Wards 1 through 32 by resolution speed, overdue counts, and rework frequency.

##### 4.3.2 Jurisdiction & Hierarchy Tree Editor (`/admin/jurisdictions`)
- Interactive tree view: `State -> Municipal Corporation -> Zones -> Wards`.
- Add/Edit Ward modal: Ward Number, Ward Name, PostGIS boundary polygon upload (GeoJSON), Assigned Zonal Officer.

##### 4.3.3 Category & SLA Threshold Configuration (`/admin/sla-matrix`)
- Interactive matrix mapping Category $\times$ Priority to SLA hours:
  - Example Row: `Potholes` | `P1 - Critical`: Response SLA `6 hrs`, Resolution SLA `24 hrs`.
  - Escalation Rule Configurator: *"If unresolved at 80% SLA, send SMS alert to Zonal Executive Engineer"*.

##### 4.3.4 User Directory & RBAC Assignment (`/admin/users`)
- User table with filtering by Role, Department, and Ward.
- "Invite Government Official" dialog: Name, Government Email, Mobile Phone, Role (`OFFICER`, `SUPERVISOR`, `FIELD_WORKER`), Jurisdiction Scope dropdowns.
- Instant Revocation / Suspend Toggle with confirmation modal.

##### 4.3.5 Audit Trail & Security Console (`/admin/audit-logs`)
- Filterable log table: Timestamp, Actor, Role, Event Type (`STATUS_CHANGE`, `ASSIGNMENT`, `PII_ACCESSED`, `AUTH_LOGIN`), Entity ID, IP Address, JSON Diff viewer.

---

### 5. Reusable Component Library & Interaction Specifications

```
+-------------------------------------------------------------------------------+
| REUSABLE COMPONENT INVENTORY                                                  |
+-------------------+-----------------------------------------------------------+
| 1. Status Badges  | Consistent color, border, and icon per lifecycle state.    |
| 2. Priority Flags | P1-Critical (Crimson) down to P4-Low (Slate).             |
| 3. Geo-Picker     | Map canvas + draggable pin + reverse geocoding readout.   |
| 4. Evidence Box   | Drag/drop, camera trigger, compression bar, thumbnail grid|
| 5. Stepper Time-  | Vertical audit path showing dates, roles, public remarks. |
|    line           |                                                           |
| 6. Data Grid      | Sticky headers, sortable columns, pagination, bulk select.|
+-------------------+-----------------------------------------------------------+
```

#### 5.1 Status Badge Specifications

| Status Key | Label Text | Background | Text Color | Border Color | Icon |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SUBMITTED` | Submitted | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` | `ClockIcon` |
| `TRIAGED` | Triaged | `#F5F3FF` | `#6D28D9` | `#DDD6FE` | `ClipboardCheckIcon` |
| `ASSIGNED` | Assigned | `#F0FDF4` | `#15803D` | `#BBF7D0` | `UserCheckIcon` |
| `IN_PROGRESS` | In Progress | `#FFFBEB` | `#B45309` | `#FDE68A` | `WrenchIcon` |
| `WORK_COMPLETED`| Completed (Pending) | `#ECFDF5` | `#047857` | `#A7F3D0` | `CheckCircleIcon` |
| `VERIFIED_RESOLVED`| Resolved | `#DCFCE7` | `#166534` | `#86EFAC` | `ShieldCheckIcon` |
| `REJECTED_INVALID` | Rejected | `#FEF2F2` | `#B91C1C` | `#FECACA` | `XCircleIcon` |
| `DISPUTED_REOPENED`| Disputed / Reopened | `#FFF1F2` | `#BE123C` | `#FECDD3` | `AlertTriangleIcon`|

#### 5.2 Priority & Severity Indicators

| Priority Code | Label | Color Token | Visual Accent | Rule / Criteria |
| :--- | :--- | :--- | :--- | :--- |
| `P1` | Critical | `#B91C1C` (Crimson) | Solid red pill + Pulse Dot | Immediate hazard to human life or major civic paralysis. |
| `P2` | High | `#EA580C` (Orange) | Heavy orange outline | Major road blockage, continuous water main burst. |
| `P3` | Medium | `#D97706` (Amber) | Amber outline | Broken streetlight, overflowing garbage bin. |
| `P4` | Low | `#475569` (Slate) | Subtle gray pill | Faded road marking, aesthetic public park damage. |

---

### 6. Form Validation & Error Prevention

1. **Client-Side Validation (Immediate Feedback):**
   - Inputs validate `onBlur` (not aggressively on every keystroke) to prevent user anxiety.
   - Mobile Phone: Validates exact 10 digits beginning with 6, 7, 8, or 9 (`^[6-9]\d{9}$`).
   - Landmark / Address: Minimum 10 characters required.
2. **Defensive Rejection Handling:**
   - Officers cannot reject a complaint with a single click. The "Reject" action triggers a modal requiring:
     - Standardized Reason Code dropdown (e.g., `OUT_OF_JURISDICTION`, `PRIVATE_COLONY`, `DUPLICATE`, `INSUFFICIENT_DETAILS`).
     - Detailed explanation textarea (minimum 20 characters) that is directly communicated to the citizen.
3. **Session Expiry Prevention:**
   - Operational forms automatically cache unsubmitted drafts to `localStorage`. If an officer's session times out mid-triage, input contents are restored upon re-authentication.

---

### 7. State Handling Specifications

```
+------------------+     +------------------+     +------------------+
|  LOADING STATE   |     |   EMPTY STATE    |     |   ERROR STATE    |
+------------------+     +------------------+     +------------------+
| Animated slate   |     | Clean civic icon |     | Clear error title|
| skeleton frames  |     | + friendly title |     | + code + retry   |
| matching layout  |     | + actionable CTA |     | button           |
+------------------+     +------------------+     +------------------+
```

1. **Loading State:**
   - Never use full-screen blank spinners.
   - Use layout-matching Skeleton Loaders (light gray pulsating rectangles `#E2E8F0` with a 1.5s wave animation).
2. **Empty State:**
   - Triage Queue Empty: Illustrated inbox icon + *"All clear for Ward 28! No pending complaints in your queue."* + `[ Refresh Queue ]` button.
   - Citizen History Empty: *"You have not reported any civic issues yet."* + Prominent `[ Report an Issue ]` button.
3. **Offline / Low-Connectivity State:**
   - Persistent top notification banner when offline: *"You are currently offline. New photo uploads will resume when connection is restored."*
   - Field Worker view queues completed work orders in IndexedDB and syncs automatically upon reconnect.
4. **403 Forbidden / Permission Denied State:**
   - Friendly civic guard screen: *"Access Restricted: You are assigned to Ward 28. To view complaints in Ward 14, contact your Zonal Administrator."* + `[ Return to My Ward ]`.

---

### 8. Accessibility & Keyboard Navigation (WCAG 2.2 AA)

1. **Focus Ring Standard:**
   - All interactive controls (buttons, links, inputs, checkboxes) feature an explicit, high-contrast focus indicator:
     `outline: 2px solid #1D4ED8; outline-offset: 2px;`
   - Focus rings are never suppressed (`outline: none` is forbidden unless replaced with an accessible ring).
2. **Keyboard Navigation & Trap Management:**
   - `Escape` key immediately closes all open modals, side drawers, and image lightboxes.
   - Modals trap tab focus inside the dialog; focus returns to the triggering button upon modal dismissal.
   - "Skip to Main Content" link provided as the first focusable element on every page.
3. **Screen Reader Announcements (`aria-live`):**
   - Dynamic status filter changes announce: `aria-live="polite"` (`"Showing 14 at-risk complaints for Ward 28"`).
   - Form submission errors announce: `aria-live="assertive"` (`"Form submission failed: Please attach at least one photo of the defect."`).

---

### 9. Motion & Animation Rules

- **Respect for User Preferences:**
  - Full support for `prefers-reduced-motion: reduce`. All transition durations drop to `0ms` when enabled.
- **Duration & Easing Tokens:**
  - `transition-fast`: `150ms cubic-bezier(0.4, 0, 0.2, 1)` (Button hover, checkbox toggle).
  - `transition-normal`: `250ms cubic-bezier(0.4, 0, 0.2, 1)` (Side drawer slide-in, modal fade).
  - No bouncing, spinning, or decorative physics animations are permitted in operational views.

---

### 10. Design Acceptance Checklist

Before any UI screen or component is approved for production release:
- [ ] Text contrast verified with automated checker to meet $\ge 4.5:1$ against its background.
- [ ] Mobile touch targets verified $\ge 48\text{px} \times 48\text{px}$.
- [ ] Tab order logically follows the visual DOM layout without getting stuck.
- [ ] Responsive behavior tested and validated at `360px` (low-end mobile), `768px` (tablet), `1280px` (laptop), and `1920px` (desktop).
- [ ] English and Hindi strings render cleanly without text truncation or broken line wraps.
- [ ] All forms provide explicit validation feedback upon submit and onBlur.
- [ ] Modals, drawers, and confirmation dialogs tested with keyboard `Tab` and `Escape`.
- [ ] Citizen PII is visibly masked on all public-facing and unprivileged operational views.
