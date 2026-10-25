/**
 * BMAD v7 (ticket tree) adapter. Mirrors what BMAD's own `tickets.py` does:
 *
 *   {output_folder}/{initiative}/tickets/tickets.toml          [[epic]] tables
 *   {initiative}/tickets/{epic-slug}/{epic-slug}.md            epic file (status, refined)
 *   {initiative}/tickets/{epic-slug}/tickets/tickets.toml      [[entry]] tables
 *   .../tickets/{type}-{slug}.md                               leaf file   (frontmatter `id`)
 *   .../tickets/{type}-{slug}-plan.md                          plan file   (frontmatter `ticket`, `status`)
 *
 * A story's status lives in its plan; an entry with no plan is "planned"
 * (Backlog). A leaf joins its entry through `id`, a plan through `ticket`,
 * never through the file name.
 */
import { closeSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import {
  editFrontmatter,
  fmString,
  isDir,
  isFile,
  listDir,
  parseFrontmatter,
  quoted,
  readText,
  tryReadText,
  writeFileAtomic,
  type FmValue,
} from './fsutil';
import type { ColumnId, Epic, Story } from '../shared/types';

export const V7_STATUSES = ['draft', 'ready-for-dev', 'in-progress', 'in-review', 'built', 'done', 'blocked', 'dropped'] as const;
const LEAF_NAME_RE = /^(story|spike|bug)-.+\.md$/;

export function v7Column(status: string): { column: ColumnId; known: boolean; blocked: boolean; dropped: boolean } {
  const base = { blocked: false, dropped: false };
  switch (status) {
    case '':
    case 'draft':
      return { column: 'backlog', known: true, ...base };
    case 'ready-for-dev':
      return { column: 'ready', known: true, ...base };
    case 'in-progress':
      return { column: 'in-progress', known: true, ...base };
    case 'blocked':
      return { column: 'in-progress', known: true, blocked: true, dropped: false };
    case 'in-review':
      return { column: 'review', known: true, ...base };
    case 'built':
      return { column: 'built', known: true, ...base };
    case 'done':
      return { column: 'done', known: true, ...base };
    case 'dropped':
      return { column: 'done', known: true, blocked: false, dropped: true };
    default:
      return { column: 'backlog', known: false, ...base };
  }
}

/** Port of tickets.py `title_slug`. */
export function titleSlug(title: string): string {
  const ascii = title.normalize('NFKD').replace(/[^\x00-\x7f]/g, '');
  const slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return slug || 'untitled';
}

type Raw = Record<string, unknown>;

interface EpicDesc {
  slug: string;
  num: string;
  title: string;
  after: unknown[];
  folder: string;
  epicFile: string;
  ticketsDir: string;
}

function readToml(path: string): Raw | null {
  const text = tryReadText(path);
  if (text === null) return null;
  try {
    return parseToml(text) as Raw;
  } catch {
    return null;
  }
}

const tables = (doc: Raw | null, name: string): Raw[] => {
  const v = doc?.[name];
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Raw[]) : [];
};

const idString = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());

export function afterLabel(item: unknown): string {
  if (typeof item === 'number' || typeof item === 'string') return String(item);
  if (item && typeof item === 'object') {
    const o = item as Raw;
    const target = o.epic !== undefined ? `epic ${o.epic}` : o.initiative !== undefined ? `initiative ${o.initiative}` : '';
    return o.needs ? `${target}: ${String(o.needs)}` : target;
  }
  return '';
}

export interface V7Result {
  epics: Epic[];
  stories: Story[];
  /** The initiative's tickets.toml lists child initiatives: a build needs one of them as the active initiative. */
  parentInitiative: boolean;
  /** Internal: per story, what a write needs. Keyed by story id. */
  writeInfo: Map<string, { planFile: string; ticket: string; title: string; leafFile?: string }>;
}

function describeEpics(initDir: string, initName: string, doc: Raw | null): { epics: EpicDesc[]; flat: boolean } {
  const base = join(initDir, 'tickets');
  const listed = tables(doc, 'epic');
  const entries = tables(doc, 'entry');

  // An initiative with no epics keeps [[entry]] tables of its own.
  if (!listed.length && entries.length) {
    return {
      flat: true,
      epics: [{
        slug: initName,
        num: initName,
        title: initName,
        after: [],
        folder: initDir,
        epicFile: join(initDir, `${initName}.md`),
        ticketsDir: base,
      }],
    };
  }

  const out: EpicDesc[] = listed.map((e) => {
    const slug = idString(e.slug);
    const folder = join(base, slug);
    return {
      slug,
      num: idString(e.id) || slug,
      title: typeof e.title === 'string' ? e.title : slug,
      after: Array.isArray(e.after) ? e.after : [],
      folder,
      epicFile: join(folder, `${slug}.md`),
      ticketsDir: join(folder, 'tickets'),
    };
  }).filter((e) => e.slug);

  // Epic folders on disk that tickets.toml does not list, like tickets.py reports.
  const known = new Set(out.map((e) => e.slug));
  for (const name of listDir(base).sort()) {
    if (known.has(name) || !/^epic-/.test(name) || !isDir(join(base, name))) continue;
    out.push({
      slug: name,
      num: name,
      title: name,
      after: [],
      folder: join(base, name),
      epicFile: join(base, name, `${name}.md`),
      ticketsDir: join(base, name, 'tickets'),
    });
  }
  return { epics: out, flat: false };
}

export function loadV7(outputFolder: string, initiative: string): V7Result {
  const initDir = join(outputFolder, initiative);
  const rootDoc = readToml(join(initDir, 'tickets', 'tickets.toml'));
  const result: V7Result = { epics: [], stories: [], parentInitiative: false, writeInfo: new Map() };

  if (tables(rootDoc, 'initiative').length && !tables(rootDoc, 'epic').length && !tables(rootDoc, 'entry').length) {
    result.parentInitiative = true;
    return result;
  }

  const { epics: descs, flat } = describeEpics(initDir, initiative, rootDoc);

  for (const desc of descs) {
    const doc = flat ? rootDoc : readToml(join(desc.ticketsDir, 'tickets.toml'));
    const entries = tables(doc, 'entry');

    // Index leaves and plans by their frontmatter, not by file name.
    const leaves = new Map<string, { file: string; fm: Record<string, FmValue> }>();
    const plans = new Map<string, { file: string; fm: Record<string, FmValue> }>();
    for (const name of listDir(desc.ticketsDir).sort()) {
      if (!LEAF_NAME_RE.test(name)) continue;
      const file = join(desc.ticketsDir, name);
      const text = tryReadText(file);
      if (text === null) continue;
      const fm = parseFrontmatter(text);
      if ('ticket' in fm) plans.set(idString(fm.ticket), { file, fm });
      else if ('id' in fm) leaves.set(idString(fm.id), { file, fm });
    }

    const taken = new Set<string>([...leaves.values()].map((l) => l.file.split(/[\\/]/).pop()!.replace(/\.md$/, '')));
    const earlierNoFile: string[] = [];
    const storyIds: string[] = [];

    for (const entry of entries) {
      const id = idString(entry.id);
      if (!id) continue;
      const type = typeof entry.type === 'string' ? entry.type : 'story';
      const title = typeof entry.title === 'string' ? entry.title : `Entry ${id}`;
      const leaf = leaves.get(id);
      const plan = plans.get(id);

      // tickets.py leaf_stem: the leaf's own stem, else <type>-<slug>, + -<id> on a clash.
      let stem: string;
      if (leaf) {
        stem = leaf.file.split(/[\\/]/).pop()!.replace(/\.md$/, '');
      } else {
        stem = `${type}-${titleSlug(title)}`;
        const clash = taken.has(stem) || earlierNoFile.includes(stem);
        if (clash) stem = `${stem}-${id}`;
        earlierNoFile.push(`${type}-${titleSlug(title)}`);
      }
      const planFile = plan?.file ?? join(desc.ticketsDir, `${stem}-plan.md`);

      const status = fmString(plan?.fm.status) || fmString(leaf?.fm.status);
      const col = v7Column(status);
      const afterRaw = leaf && Array.isArray(leaf.fm.after) ? leaf.fm.after : Array.isArray(entry.after) ? entry.after : [];
      const storyId = `${desc.slug}:${id}`;

      result.stories.push({
        id: storyId,
        ref: flat ? id : `${desc.num}.${id}`,
        epicId: desc.slug,
        title,
        status,
        column: col.column,
        blocked: col.blocked,
        blockedReason: col.blocked ? fmString(plan?.fm.blocked_reason) || undefined : undefined,
        dropped: col.dropped,
        after: afterRaw.map(afterLabel).filter(Boolean),
        type,
        risk: typeof entry.risk === 'string' ? entry.risk : undefined,
        file: leaf?.file ?? (plan ? plan.file : undefined),
        planFile,
        hasPlan: Boolean(plan),
        movable: true,
        unknownStatus: !col.known,
      });
      result.writeInfo.set(storyId, { planFile, ticket: id, title, leafFile: leaf?.file });
      storyIds.push(storyId);
    }

    const mine = result.stories.filter((s) => storyIds.includes(s.id));
    const live = mine.filter((s) => !s.dropped);
    const done = live.filter((s) => s.column === 'done').length;
    const epicFm = isFile(desc.epicFile) ? parseFrontmatter(readText(desc.epicFile)) : {};
    const recorded = fmString(epicFm.status);
    const derived = !live.length || live.every((s) => s.column === 'backlog') ? 'backlog' : done === live.length ? 'done' : 'in-progress';

    result.epics.push({
      id: desc.slug,
      num: desc.num,
      title: desc.title,
      status: recorded || derived,
      statusDerived: !recorded,
      storyIds,
      done,
      total: live.length,
      retrospective: isFile(join(desc.folder, `${desc.slug}-retrospective.md`)) ? 'done' : undefined,
      file: isFile(desc.epicFile) ? desc.epicFile : undefined,
      refined: epicFm.refined === false ? false : true,
      after: desc.after.map(afterLabel).filter(Boolean),
    });
  }
  return result;
}

export interface V7WriteInput {
  planFile: string;
  ticket: string;
  title: string;
  status: string;
}

/**
 * Same effect as `tickets.py mark`: edit the plan's frontmatter, or create a
 * plan holding only frontmatter when the ticket has none. Blocked fields are
 * cleared unless the new status is `blocked`. Never touches the leaf file.
 */
export function setStatusV7(input: V7WriteInput): { created: boolean } {
  if (!(V7_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error(`"${input.status}" is not a v7 status (${V7_STATUSES.join(', ')})`);
  }
  if (isFile(input.planFile)) {
    const text = readText(input.planFile);
    const values: Record<string, string | null> = { status: input.status };
    if (input.status !== 'blocked') {
      values.blocked_at = null;
      values.blocked_reason = null;
    }
    const next = editFrontmatter(text, values);
    if (next !== text) writeFileAtomic(input.planFile, next);
    return { created: false };
  }
  const ticket = /^\d+$/.test(input.ticket) ? input.ticket : quoted(input.ticket);
  const body = `---\ntitle: ${quoted(input.title)}\nticket: ${ticket}\nstatus: ${input.status}\n---\n`;
  const fd = openSync(input.planFile, 'wx'); // refuses to clobber a file that appeared meanwhile
  try {
    writeSync(fd, body);
  } finally {
    closeSync(fd);
  }
  return { created: true };
}
