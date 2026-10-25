/**
 * Types shared by the panel (renderer) and the backend module (utility process).
 * Plain data only: everything here crosses `callBackendTool` as JSON.
 */

export const EXTENSION_ID = 'dev.local.bmad-board';
/** Host namespaces backend tools as `<last segment of extension id>.<name>`. */
export const TOOL_NAMESPACE = 'bmad-board';
export const PANEL_ID = 'board';

export type BmadVersion = 'v6' | 'v7' | 'none';

export type ColumnId = 'backlog' | 'ready' | 'in-progress' | 'review' | 'built' | 'done';

export const COLUMN_LABEL: Record<ColumnId, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  'in-progress': 'In progress',
  review: 'Review',
  built: 'Built',
  done: 'Done',
};

export const COLUMNS_V6: ColumnId[] = ['backlog', 'ready', 'in-progress', 'review', 'done'];
export const COLUMNS_V7: ColumnId[] = ['backlog', 'ready', 'in-progress', 'review', 'built', 'done'];

export interface Story {
  /** Stable id used as the session owner key. v6: story key; v7: `<epic folder>:<entry id>`. */
  id: string;
  /** What `{ref}` expands to. v6: story key; v7: `<epic id>.<entry id>`. */
  ref: string;
  epicId: string;
  title: string;
  /** Raw status as it is written in the file. '' when none. */
  status: string;
  column: ColumnId;
  /** v7 `blocked` status: shown as a mark on the card in the In progress column. */
  blocked: boolean;
  blockedReason?: string;
  /** v7 `dropped`: hidden unless the filter asks for it. */
  dropped: boolean;
  /** Dependencies as display labels (v7 `after`). */
  after: string[];
  /** v7 entry type: story | spike | bug. */
  type?: string;
  risk?: string;
  /** Workspace-absolute path of the best file to open (story file, else plan, else leaf). */
  file?: string;
  /** v7: where the plan is or would be created. */
  planFile?: string;
  hasPlan: boolean;
  /** v6: false when the story is in epics.md but absent from sprint-status.yaml, so it cannot be moved. */
  movable: boolean;
  /** Why it cannot be moved, shown as a tooltip. */
  lockedReason?: string;
  /** Status string was not recognised for this BMAD version. */
  unknownStatus: boolean;
}

export interface Epic {
  id: string;
  /** What `{epic}` expands to: v6 epic number, v7 epic id (or folder name when unlisted). */
  num: string;
  title: string;
  /** v6 `epic-N` status / v7 epic file status. '' when none (derived below). */
  status: string;
  /** True when `status` was derived from the stories because the file has none. */
  statusDerived: boolean;
  storyIds: string[];
  done: number;
  total: number;
  /** v6: `epic-N-retrospective` value (optional | done). */
  retrospective?: string;
  file?: string;
  /** v7: epic file says `refined: false`. */
  refined?: boolean;
  /** v7: epic-level `after` as display labels. */
  after: string[];
}

export interface Banner {
  id: string;
  kind: 'info' | 'warning';
  message: string;
  /** Prompt to run in a new session when the user clicks the action. */
  action?: { label: string; promptSetting: 'migrate' | 'plan' };
}

export interface SessionInfo {
  sessionId: string;
  storyId: string;
  title: string;
  status: 'idle' | 'running' | 'waiting_for_input' | 'error' | 'interrupted';
  hasPendingPrompt: boolean;
  updatedAt: number;
}

export interface BoardModel {
  version: BmadVersion;
  projectRoot: string;
  outputRoot: string | null;
  /** v7 initiatives found in the output folder, and which one is shown. */
  initiatives: string[];
  activeInitiative: string | null;
  banners: Banner[];
  epics: Epic[];
  stories: Story[];
  sessions: SessionInfo[];
  /** Hash of everything above; the panel passes it back so unchanged polls cost nothing. */
  rev: string;
}

export type LoadResult = { unchanged: true; rev: string } | { unchanged: false; model: BoardModel };

export interface DetailSection {
  title: string;
  body: string;
}

export interface StoryDetail {
  storyId: string;
  file?: string;
  /** Longest "story / description / intent" paragraph block. */
  summary: string;
  acceptance: string[];
  tasks: Array<{ checked: boolean; text: string; depth: number }>;
  /** Everything else, in file order. */
  sections: DetailSection[];
  /** Files that make up this story (leaf, plan, story file) for the "open" list. */
  files: Array<{ label: string; path: string }>;
}

// ─── Panel-only backend tools ──────────────────────────────────────────────

export const PANEL_TOOLS = {
  load: 'panel_load',
  detail: 'panel_detail',
  setStatus: 'panel_set_status',
  run: 'panel_run',
} as const;

export type PanelToolKey = keyof typeof PANEL_TOOLS;

export const panelToolName = (key: PanelToolKey): string => `${TOOL_NAMESPACE}.${PANEL_TOOLS[key]}`;

export interface LoadRequest {
  /** v7: which initiative to show (default: `active_initiative`). */
  initiative?: string;
  /** Last rev the panel rendered. */
  since?: string;
}

export interface DetailRequest {
  storyId: string;
  initiative?: string;
}

export interface SetStatusRequest {
  storyId: string;
  /** Raw status to write, in the vocabulary of the detected version. */
  status: string;
  initiative?: string;
}

export interface SetStatusResponse {
  ok: true;
  /** Epic status bumped as a side effect (v6: backlog -> in-progress). */
  epicBumped?: string;
}

export interface RunRequest {
  /** Session owner key: the story id, or `epic:<id>` for epic actions, or `board`. */
  ownerKey: string;
  name: string;
  prompt: string;
  /** `provider:model` or a bare model for claude-code. */
  model: string;
  provider?: string;
  effortLevel?: string;
}

export interface RunResponse {
  sessionId: string;
}

// ─── Settings (panel side, stored with host.storage) ───────────────────────

/** What dropping a card on a column does. */
export interface ColumnRule {
  /** Raw status to write. Empty: do not write. */
  status: string;
  /** Prompt template for a new session. Empty: status only. */
  command: string;
  /** Ask before running. Always asked when `forceConfirm`. */
  forceConfirm?: boolean;
  /** The command writes the status itself; do not pre-write `status` before launching it. */
  statusByCommand?: boolean;
}

export type ColumnRules = Partial<Record<ColumnId, ColumnRule>>;

/** One entry of the right-click menu. `v6`/`v7` are prompt templates; missing = not offered. */
export interface ContextAction {
  id: string;
  label: string;
  scope: 'story' | 'epic';
  v6?: string;
  v7?: string;
}

export interface BoardSettings {
  /** `provider:model`. See README: "Default" is claude-code's sonnet. */
  model: string;
  effort: string;
  /** Skip the confirm dialog before launching a command (global "don't ask"). */
  dontAsk: boolean;
  /** Write the status before launching the column's command (spec B4). */
  writeStatusBeforeRun: boolean;
  pollMs: number;
  showDropped: boolean;
  /** Show epics whose status is `done` (hidden by default: they bury the live work). */
  showDoneEpics: boolean;
  rulesV6: ColumnRules;
  rulesV7: ColumnRules;
  actions: ContextAction[];
  /** Prompt for the "old sprint-status.yaml" banner. */
  migratePrompt: string;
  /** Prompt for the empty state. */
  planPrompt: string;
}

export const DEFAULT_SETTINGS: BoardSettings = {
  model: 'claude-code:sonnet',
  effort: '',
  dontAsk: false,
  writeStatusBeforeRun: true,
  pollMs: 2500,
  showDropped: false,
  showDoneEpics: false,
  rulesV6: {
    backlog: { status: 'backlog', command: '' },
    ready: { status: 'ready-for-dev', command: '/bmad-create-story {key}', statusByCommand: true },
    'in-progress': { status: 'in-progress', command: '/bmad-dev-story {file}' },
    review: { status: 'review', command: '/bmad-code-review {file}' },
    done: { status: 'done', command: '' },
  },
  rulesV7: {
    backlog: { status: 'draft', command: '' },
    ready: { status: 'ready-for-dev', command: '' },
    'in-progress': { status: 'in-progress', command: '/bmad-build {ref}' },
    review: { status: 'in-review', command: '/bmad-code-review {ref}' },
    built: { status: 'built', command: '' },
    done: { status: 'done', command: '', forceConfirm: true },
  },
  actions: [
    { id: 'dev', label: 'Send to Dev', scope: 'story', v6: '/bmad-dev-story {file}', v7: '/bmad-build {ref}' },
    { id: 'build', label: 'Build', scope: 'story', v7: '/bmad-build {ref}' },
    { id: 'create', label: 'Create story', scope: 'story', v6: '/bmad-create-story {key}' },
    { id: 'review', label: 'Code review', scope: 'story', v6: '/bmad-code-review {file}', v7: '/bmad-code-review {ref}' },
    { id: 'e2e', label: 'E2E tests', scope: 'story', v6: '/bmad-qa-generate-e2e-tests {key}', v7: '/bmad-qa-generate-e2e-tests {ref}' },
    { id: 'retro', label: 'Retrospective', scope: 'epic', v6: '/bmad-retrospective {epic}', v7: '/bmad-retrospective {epic}' },
    { id: 'sprint', label: 'Sprint status', scope: 'epic', v6: '/bmad-sprint-status', v7: '/bmad-help' },
  ],
  migratePrompt:
    'Run `bmad migrate method` to migrate this project from the BMAD v6 method module to v7, then summarise what changed and what is left to do by hand.',
  planPrompt: '/bmad-help',
};

/** Merge stored settings over defaults, one level deep for the rule maps. */
export function mergeSettings(stored: Partial<BoardSettings> | undefined): BoardSettings {
  const s = stored ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    rulesV6: { ...DEFAULT_SETTINGS.rulesV6, ...(s.rulesV6 ?? {}) },
    rulesV7: { ...DEFAULT_SETTINGS.rulesV7, ...(s.rulesV7 ?? {}) },
    actions: Array.isArray(s.actions) && s.actions.length > 0 ? s.actions : DEFAULT_SETTINGS.actions,
  };
}
