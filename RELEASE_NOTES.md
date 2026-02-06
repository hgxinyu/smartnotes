# Release Notes

## 2026-02-06

### Highlights
- Reframed SmartNotes around two core record types: `notes` and `todos`.
- Added automatic intake routing so one user input can create note items and/or todo items.
- Kept image handling focused on notes so uploaded images are stored with note records.

### Labels System
- Added user-scoped labels that can be attached to both notes and todos.
- Added AI-powered automatic label suggestions during note/todo creation.
- Added manual label add/remove flows for notes and todos.
- Added centralized label management page at `/labels`.
- Added label explorer workflow: select a label and view all linked notes and todos.

### API and Backend
- Added labels APIs:
  - `GET/POST /api/labels`
  - `PATCH/DELETE /api/labels/[id]`
  - `GET /api/labels/[id]/items`
  - `POST/DELETE /api/notes/[id]/labels`
  - `POST/DELETE /api/todos/[id]/labels`
- Updated notes/todos APIs to return attached labels in responses.
- Added reusable label schema/bootstrap helpers to keep environments resilient.

### Database
- Added manual migration block for labels in `db/schema.sql`:
  - `labels`
  - `note_labels`
  - `todo_labels`
  - supporting indexes

### UI
- Added dedicated pages:
  - `/notes`
  - `/todos`
  - `/labels`
- Updated navigation to include Labels.
- Redesigned labels UI to a higher-level dashboard with summary metrics and drill-down.
- Improved `/todos` label UX:
  - Added a compact per-row `Tag` button at the end of each todo item.
  - Added inline tag panel to either select an existing label or create a new one.
  - Kept checkbox-first layout so checking off items remains the primary action.

## 2026-02-04

### Highlights
- Bootstrapped Next.js + Netlify + Neon setup for SmartNotes MVP.
- Added initial notes capture flow and auto-categorization groundwork.
- Added todo extraction from note content.
- Added auth/session flow with user-scoped data handling.
- Added foundational docs and environment templates.
