# BMAD Board for Nimbalyst

A Jira-like board over your [BMAD](https://github.com/bmad-code-org/BMAD-METHOD) stories, inside [Nimbalyst](https://nimbalyst.com). Backlog with epics, a swimlane board, story details, and drag & drop that changes a story's status and starts the matching agent command in a new session.

Works with **BMAD v6** (`sprint-status.yaml`) and **v7** (ticket tree), detected per project. Permissions: `filesystem`, `ai`, plus a backend module (`ai-sessions`) that asks for consent on first use.

> Early version (0.1.0). Built against Extension SDK 0.7.1; covered by unit tests and a browser harness with synthetic v6/v7 fixtures. Not yet verified against a wide range of real BMAD projects. Issues welcome.

## Install

1. In Nimbalyst open **Settings → Extensions → Marketplace**.
2. Paste this repository's URL at the bottom of the Discover page.
3. Check **Settings → Extensions → Installed**: the extension is listed and enabled.
4. Open a BMAD project and press `⌘⌥B` (or use the gutter button). Approve the consent prompt for the backend module: it reads and writes BMAD files and starts agent sessions from the board.

Local development: enable **Extension Dev Tools** (Settings → Advanced), run `npm install && npm run build`, then ask Claude: *"Build and install my extension from /path/to/bmad-board"*.

## Version detection

| Found in project | Mode |
|---|---|
| `active_initiative` in `_bmad/custom/config.user.toml`, or `initiative-*/tickets/tickets.toml` | v7 |
| `sprint-status.yaml` (configured implementation folder, `_bmad-output/…`, then a search up to 3 levels deep, skipping `node_modules`, `vendor`, etc.) | v6 |
| Both | v7, plus a banner about the old `sprint-status.yaml` with a `bmad migrate method` action |
| Neither | empty state with a "Start planning" action (`/bmad-help`) |

## Views

- **Backlog**: collapsible epics with `done/total` progress, epic status, `after` dependencies, a marker for stories with an active session.
- **Board**: columns by status, epics as swimlanes. v6: Backlog · Ready · In progress · Review · Done. v7 adds Built; `blocked` shows as a mark in In progress; `dropped` is hidden unless enabled in settings.
- **Details** (right pane): description, acceptance criteria, tasks from the story/plan `.md`, files to open, sessions started from the board with their transcript.
- **Header**: filters (epic, status, initiative in v7) and a model picker for sessions started from the board.

## Drag & drop

Dropping a card on a column writes the status and, if the column has a command, starts it in a **new session** after a confirm dialog (**Run** / **Only change status** / **Cancel**, with "Don't ask again"). Cards move only within their own epic's lane. All rules are editable in ⚙ Settings.

| Version | Column | Status written | Command |
|---|---|---|---|
| v6 | Ready | by the command | `/bmad-create-story {key}` |
| v6 | In progress | `in-progress` | `/bmad-dev-story {file}` |
| v6 | Review | `review` | `/bmad-code-review {file}` |
| v6 | Done | `done` | none |
| v7 | In progress | `in-progress` | `/bmad-build {ref}` |
| v7 | Review | `in-review` | `/bmad-code-review {ref}` |
| v7 | Done | `done` | none (always confirms) |

Placeholders: `{key}` `{ref}` `{epic}` `{file}` `{title}`.

## Context menu

- **Story**: Send to Dev, Build, Create story, Code review, E2E tests, Move to…, Open file.
- **Epic**: Retrospective, Sprint status, Open epic file.

Each action starts a new session. Labels and command templates per BMAD version are editable in Settings.

## How files are changed

- **v6**: one line in `sprint-status.yaml`. Comments and order stay; the file is re-read right before writing; moving a story to `in-progress` also moves its epic out of `backlog`.
- **v7**: frontmatter of the story's `…-plan.md`, same effect as `tickets.py mark` (clears `blocked_*` fields unless the new status is `blocked`; creates a frontmatter-only plan if none exists; never touches the story file).
- Writes are atomic (temp file + rename). Stories listed only in `epics.md` (not yet in `sprint-status.yaml`) are shown locked until sprint planning adds them.

The board follows file changes by polling every 2.5 s (the SDK has no file-watch event), paused while the tab is hidden.

## Settings (⚙)

Model and effort for board sessions, "don't ask before running", write status before running, show dropped stories, poll interval, per-column rules, context-menu actions, and prompts for the banners.

## Limitations

- Cards show only sessions **started from the board**; the SDK lists only sessions an extension owns.
- Opening an arbitrary session in Agent mode is not possible from an extension.
- If your BMAD install names commands differently, or slash commands aren't expanded as the first message of a session, edit the templates in Settings (plain-language prompts work too).
- v7 support follows BMAD's `tickets.py` conventions and may need adjustments for unusual trees.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build      # vite build (panel + backend) + SDK bundle validation
```

`dist/` is committed so Nimbalyst can install straight from GitHub.

```
src/backend/      BMAD file logic (v6, v7, details), no host dependencies, tested
src/backend.ts    backend module: panel-only tools, sessions, gutter badge
src/components/   panel UI (Backlog, Board, Details, dialogs, settings)
src/shared/       types shared by panel and backend
```

## License

MIT License — see [LICENSE](LICENSE) for details.