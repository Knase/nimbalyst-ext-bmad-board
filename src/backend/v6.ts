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

export interface SprintEntries {
  epics: Map<number, string>;
  retros: Map<number, string>;
  /** In file order. */
  stories: Array<{ key: string; epic: number; num: number; slug: string; status: string }>;
}

export function parseSprintStatus(text: string): SprintEntries {
  const out: SprintEntries = { epics: new Map(), retros: new Map(), stories: [] };
  let inDev = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^development_status\s*:/.test(line)) {
      inDev = true;
      continue;
    }
    if (inDev && /^\S/.test(line) && !line.startsWith('#')) inDev = false; // next top-level key
    if (!inDev) continue;
    const m = /^\s+([A-Za-z0-9_.-]+)\s*:\s*([A-Za-z0-9_-]+)\s*(?:#.*)?$/.exec(line);
    if (!m) continue;
    const [, key, status] = m as unknown as [string, string, string];
    let k;
    if ((k = /^epic-(\d+)$/.exec(key))) out.epics.set(Number(k[1]), status);
    else if ((k = /^epic-(\d+)-retrospective$/.exec(key))) out.retros.set(Number(k[1]), status);
    else if ((k = /^(\d+)-(\d+)(?:-(.+))?$/.exec(key))) {
      out.stories.push({ key, epic: Number(k[1]), num: Number(k[2]), slug: k[3] ?? '', status });
    }
  }
  return out;
}

export interface EpicsDoc {
  epics: Map<number, { title: string }>;
  stories: Map<string, { epic: number; num: number; title: string }>; // key "N.M"
}

export function parseEpicsMd(text: string): EpicsDoc {
  const doc: EpicsDoc = { epics: new Map(), stories: new Map() };
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = /^##\s+Epic\s+(\d+)\s*[:\-–—.]\s*(.+?)\s*$/i.exec(line))) {
      doc.epics.set(Number(m[1]), { title: m[2]! });
    } else if ((m = /^###\s+Story\s+(\d+)\.(\d+)\s*[:\-–—.]\s*(.+?)\s*$/i.exec(line))) {
      doc.stories.set(`${m[1]}.${m[2]}`, { epic: Number(m[1]), num: Number(m[2]), title: m[3]! });
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

export function loadV6(sprintFile: string, epicsText: string): V6Result {
  const sprint = parseSprintStatus(readText(sprintFile));
  const doc = parseEpicsMd(epicsText);
  const storyDir = dirname(sprintFile);

  const stories: Story[] = [];
  const seen = new Set<string>();

  for (const s of sprint.stories) {
    const fromDoc = doc.stories.get(`${s.epic}.${s.num}`);
    const column = v6Column(s.status);
    const file = join(storyDir, `${s.key}.md`);
    stories.push({
      id: s.key,
      ref: s.key,
      epicId: `epic-${s.epic}`,
      title: fromDoc?.title ?? (humanize(s.slug) || `Story ${s.epic}.${s.num}`),
      status: s.status,
      column: column.column,
      blocked: false,
      dropped: false,
      after: [],
      file: isFile(file) ? file : undefined,
      hasPlan: false,
      movable: true,
      unknownStatus: !column.known,
    });
    seen.add(`${s.epic}.${s.num}`);
  }

  // Stories planned in epics.md that sprint planning has not picked up yet.
  for (const [k, d] of doc.stories) {
    if (seen.has(k)) continue;
    stories.push({
      id: `${d.epic}-${d.num}-${slugify(d.title)}`,
      ref: k,
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

  stories.sort((a, b) => {
    const [ae, an] = numbers(a);
    const [be, bn] = numbers(b);
    return ae - be || an - bn;
  });

  const epicNums = new Set<number>([...sprint.epics.keys(), ...doc.epics.keys(), ...stories.map((s) => numbers(s)[0])]);
  const epics: Epic[] = [...epicNums]
    .sort((a, b) => a - b)
    .map((n) => {
      const id = `epic-${n}`;
      const mine = stories.filter((s) => s.epicId === id);
      const done = mine.filter((s) => s.column === 'done').length;
      const recorded = sprint.epics.get(n);
      const derived = !mine.length || mine.every((s) => s.column === 'backlog') ? 'backlog' : done === mine.length ? 'done' : 'in-progress';
      return {
        id,
        num: String(n),
        title: doc.epics.get(n)?.title ?? `Epic ${n}`,
        status: recorded ?? derived,
        statusDerived: recorded === undefined,
        storyIds: mine.map((s) => s.id),
        done,
        total: mine.length,
        retrospective: sprint.retros.get(n),
        after: [],
      };
    });

  return { epics, stories };
}

function numbers(s: Story): [number, number] {
  const m = /^(\d+)[-.](\d+)/.exec(s.id) ?? /^(\d+)[-.](\d+)/.exec(s.ref);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
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
    const m = /^(\d+)-/.exec(storyKey);
    if (m) {
      const epicEdit = editYamlLine(next, `epic-${m[1]}`, 'in-progress');
      if (epicEdit.found && epicEdit.changed && epicEdit.previous === 'backlog') {
        next = epicEdit.text;
        result.epicBumped = 'in-progress';
      }
    }
  }
  if (next !== text) writeFileAtomic(sprintFile, next);
  return result;
}
