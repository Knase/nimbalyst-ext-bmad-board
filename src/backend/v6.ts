/**
 * BMAD v6 adapter.
 *
 *   sprint-status.yaml  development_status: epic-N / N-M-slug / epic-N-retrospective
 *   epics.md            ## Epic N: Title   ### Story N.M: Title
 *   <dir>/N-M-slug.md   the story file, next to sprint-status.yaml
 *
 * Status lives only in sprint-status.yaml; the board edits one line there.
 */
import { dirname, join } from 'node:path';
import { editYamlLine, isFile, readText, writeFileAtomic } from './fsutil';
import type { ColumnId, Epic, Story } from '../shared/types';

export const V6_STORY_STATUSES = ['backlog', 'ready-for-dev', 'in-progress', 'review', 'done'] as const;
/** Older v6 builds wrote these; both mean "story file exists, not started". */
const V6_LEGACY_READY = new Set(['drafted', 'contexted']);

export function v6Column(status: string): { column: ColumnId; known: boolean } {
  switch (status) {
    case 'backlog':
      return { column: 'backlog', known: true };
    case 'ready-for-dev':
      return { column: 'ready', known: true };
    case 'in-progress':
      return { column: 'in-progress', known: true };
    case 'review':
      return { column: 'review', known: true };
    case 'done':
      return { column: 'done', known: true };
    default:
      return V6_LEGACY_READY.has(status) ? { column: 'ready', known: true } : { column: 'backlog', known: false };
  }
}

export interface SprintStory {
  key: string;
  /** Epic id as written after `epic-` (`3`, `cm`), or null when nothing places the story. */
  epic: string | null;
  slug: string;
  status: string;
  /** `retro-…` rows: retrospective action items. */
  retro: boolean;
}

export interface SprintEntries {
  /** Epic id -> status, in file order. */
  epics: Map<string, string>;
  retros: Map<string, string>;
  /** In file order. */
  stories: SprintStory[];
}

/**
 * Which epic a development_status key belongs to. Epic ids are numbers (`epic-3`) or
 * short words (`epic-cm`), so the rules are, in order:
 *  1. `retro-<epic>-ai-…`  -> that epic (retro action items)
 *  2. first key segment is a known epic id (`cm-1-x`, `3-1-x`, `pb-01-x`)
 *  3. a number-led key (`4-2-x`) -> epic 4, even when no `epic-4` line exists
 *  4. else the epic line most recently above it in the file
 */
export function epicOfKey(key: string, epics: Set<string>, lastEpic: string | null): string | null {
  const retro = /^retro-([A-Za-z0-9]+)-ai-/i.exec(key);
  if (retro && epics.has(retro[1]!.toLowerCase())) return retro[1]!.toLowerCase();
  const first = key.split('-')[0]!.toLowerCase();
  if (epics.has(first)) return first;
  if (/^\d+$/.test(first) && /^\d+-\d+/.test(key)) return first;
  return lastEpic;
}

export function parseSprintStatus(text: string): SprintEntries {
  const out: SprintEntries = { epics: new Map(), retros: new Map(), stories: [] };
  const rows: Array<{ key: string; status: string }> = [];
  let inDev = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^development_status\s*:/.test(line)) {
      inDev = true;
      continue;
    }
    if (inDev && /^\S/.test(line) && !line.startsWith('#')) inDev = false; // next top-level key
    if (!inDev) continue;
    const m = /^\s+([A-Za-z0-9_.-]+)\s*:\s*([A-Za-z0-9_-]+)\s*(?:#.*)?$/.exec(line);
    if (m) rows.push({ key: m[1]!, status: m[2]! });
  }

  // Epic lines first: stories are matched against the full set of epic ids.
  for (const { key, status } of rows) {
    let k;
    if ((k = /^epic-([A-Za-z0-9]+)$/.exec(key))) out.epics.set(k[1]!.toLowerCase(), status);
    else if ((k = /^epic-([A-Za-z0-9]+)-retrospective$/.exec(key))) out.retros.set(k[1]!.toLowerCase(), status);
  }
  const known = new Set(out.epics.keys());
  let last: string | null = null;
  for (const { key, status } of rows) {
    let k;
    if ((k = /^epic-([A-Za-z0-9]+)$/.exec(key))) {
      last = k[1]!.toLowerCase();
      continue;
    }
    if (/^epic-[A-Za-z0-9]+-retrospective$/.test(key)) continue;
    const retro = key.startsWith('retro-');
    const numbered = /^[A-Za-z0-9]+-\d+[a-z]?(?:-(.+))?$/i.exec(key);
    out.stories.push({
      key,
      epic: epicOfKey(key, known, last),
      slug: retro ? key.replace(/^retro-[a-z0-9]+-ai-\d*[a-z]*-?/i, '') : numbered?.[1] ?? key.replace(/^[A-Za-z0-9]+-\d+[a-z]?-?/i, ''),
      status,
      retro,
    });
  }
  return out;
}

/** `story_location` from the head of sprint-status.yaml (where story files live). */
export function parseStoryLocation(text: string): string | null {
  const m = /^story_location\s*:\s*["']?([^"'#\r\n]+?)["']?\s*(?:#.*)?$/m.exec(text);
  return m ? m[1]!.trim() : null;
}

export interface EpicsDoc {
  epics: Map<string, { title: string }>;
  /** Key `<epic>.<num>`, lower-case, leading zeros dropped. */
  stories: Map<string, { epic: string; num: string; title: string }>;
}

const normNum = (n: string): string => n.replace(/^0+(?=\d)/, '').toLowerCase();

export function parseEpicsMd(text: string): EpicsDoc {
  const doc: EpicsDoc = { epics: new Map(), stories: new Map() };
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = /^##\s+Epic\s+([A-Za-z0-9]+)\s*[:\-–—.]\s*(.+?)\s*$/i.exec(line))) {
      doc.epics.set(m[1]!.toLowerCase(), { title: m[2]! });
    } else if ((m = /^###\s+Story\s+([A-Za-z0-9]+)[.-](\d+[A-Za-z]?)\s*[:\-–—.]\s*(.+?)\s*$/i.exec(line))) {
      const epic = m[1]!.toLowerCase();
      doc.stories.set(`${epic}.${normNum(m[2]!)}`, { epic, num: normNum(m[2]!), title: m[3]! });
    }
  }
  return doc;
}

const humanize = (slug: string): string => {
  const s = slug.replace(/-+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export interface V6Result {
  epics: Epic[];
  stories: Story[];
}

export interface LoadV6Options {
  /** Folders to look in for `<key>.md`, first hit wins. */
  storyDirs?: string[];
}

/**
 * sprint-status.yaml is the truth. epics.md only supplies titles, plus stories that
 * belong to a live (not done) sprint epic but are not in the sprint file yet. Epics and
 * stories that exist only in epics.md are NOT shown: that file is the plan, and it
 * outlives the sprint (a stale "Epic 1" next to a sprint full of `epic-cm` is noise).
 */
export function loadV6(sprintFile: string, epicsText: string, options: LoadV6Options = {}): V6Result {
  const sprint = parseSprintStatus(readText(sprintFile));
  const doc = parseEpicsMd(epicsText);
  const dirs = options.storyDirs?.length ? options.storyDirs : [dirname(sprintFile)];

  const findFile = (key: string): string | undefined => {
    for (const d of dirs) {
      const f = join(d, `${key}.md`);
      if (isFile(f)) return f;
    }
    return undefined;
  };

  const stories: Story[] = [];
  const seen = new Set<string>();

  for (const s of sprint.stories) {
    const epic = s.epic ?? 'other';
    const numbered = /^([A-Za-z0-9]+)-(\d+[A-Za-z]?)/.exec(s.key);
    const fromDoc = !s.retro && numbered ? doc.stories.get(`${numbered[1]!.toLowerCase()}.${normNum(numbered[2]!)}`) : undefined;
    const column = v6Column(s.status === 'optional' ? 'backlog' : s.status);
    stories.push({
      id: s.key,
      ref: s.key,
      epicId: `epic-${epic}`,
      title: fromDoc?.title ?? (humanize(s.slug) || s.key),
      status: s.status,
      column: column.column,
      blocked: false,
      dropped: false,
      after: [],
      type: s.retro ? 'retro' : undefined,
      file: findFile(s.key),
      hasPlan: false,
      movable: true,
      unknownStatus: !column.known && s.status !== 'optional',
    });
    if (numbered && !s.retro) seen.add(`${numbered[1]!.toLowerCase()}.${normNum(numbered[2]!)}`);
  }

  const sprintEmpty = sprint.epics.size === 0 && sprint.stories.length === 0;
  for (const [k, d] of doc.stories) {
    if (seen.has(k)) continue;
    const epicStatus = sprint.epics.get(d.epic);
    const live = sprintEmpty || (epicStatus !== undefined && epicStatus !== 'done');
    if (!live) continue;
    stories.push({
      id: `${d.epic}-${d.num}-${slugify(d.title)}`,
      ref: `${d.epic}.${d.num}`,
      epicId: `epic-${d.epic}`,
      title: d.title,
      status: '',
      column: 'backlog',
      blocked: false,
      dropped: false,
      after: [],
      hasPlan: false,
      movable: false,
      lockedReason: 'Not in sprint-status.yaml yet. Run sprint planning to add it, then it can be moved.',
      unknownStatus: false,
    });
  }

  // Epics in sprint-file order; then any epic only referenced by stories.
  const order: string[] = [...sprint.epics.keys()];
  for (const st of stories) {
    const id = st.epicId.slice('epic-'.length);
    if (!order.includes(id)) order.push(id);
  }
  if (sprintEmpty) for (const id of doc.epics.keys()) if (!order.includes(id)) order.push(id);

  const epics: Epic[] = order.map((id) => {
    const epicId = `epic-${id}`;
    const mine = stories.filter((s) => s.epicId === epicId);
    const done = mine.filter((s) => s.column === 'done').length;
    const recorded = sprint.epics.get(id);
    const derived = !mine.length || mine.every((s) => s.column === 'backlog') ? 'backlog' : done === mine.length ? 'done' : 'in-progress';
    return {
      id: epicId,
      num: id,
      title: doc.epics.get(id)?.title ?? (id === 'other' ? 'Other' : `Epic ${id.toUpperCase()}`),
      status: recorded ?? derived,
      statusDerived: recorded === undefined,
      storyIds: mine.map((s) => s.id),
      done,
      total: mine.length,
      retrospective: sprint.retros.get(id),
      after: [],
    };
  });

  return { epics, stories };
}

export interface V6WriteResult {
  epicBumped?: string;
}

/**
 * Set one story's status. Re-reads the file now, edits a single line, and, when
 * a story starts, pulls its epic out of `backlog` the same way the BMAD
 * workflows do. Comments and order are untouched.
 */
export function setStatusV6(sprintFile: string, storyKey: string, status: string): V6WriteResult {
  const text = readText(sprintFile);
  const edit = editYamlLine(text, storyKey, status);
  if (!edit.found) throw new Error(`"${storyKey}" is not in ${sprintFile}. Run sprint planning first.`);
  let next = edit.text;
  const result: V6WriteResult = {};

  if (status === 'in-progress') {
    const epic = parseSprintStatus(text).stories.find((s) => s.key === storyKey)?.epic;
    if (epic) {
      // The sprint file may spell the epic id in another case than the lower-cased one we hold.
      const spelled = new RegExp(`^\\s+(epic-${epic.replace(/[^A-Za-z0-9]/g, '')})\\s*:`, 'im').exec(next)?.[1];
      const epicEdit = spelled ? editYamlLine(next, spelled, 'in-progress') : null;
      if (epicEdit && epicEdit.found && epicEdit.changed && epicEdit.previous === 'backlog') {
        next = epicEdit.text;
        result.epicBumped = 'in-progress';
      }
    }
  }
  if (next !== text) writeFileAtomic(sprintFile, next);
  return result;
}
