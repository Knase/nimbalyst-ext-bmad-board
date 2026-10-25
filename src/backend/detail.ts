/**
 * Story details: pull the parts a person wants in the right-hand panel out of
 * the story file (v6) or leaf + plan (v7). Pure functions over file text.
 */
import { stripFrontmatter, tryReadText } from './fsutil';
import type { DetailSection, Story, StoryDetail } from '../shared/types';

const SUMMARY_TITLES = /^(story|description|intent|summary|user story)$/i;
const AC_TITLE = /acceptance criteria/i;
const TASKS_TITLE = /^tasks?(\s*[/&]\s*subtasks?)?$|^tasks?\s*&\s*acceptance$/i;

interface Section {
  level: number;
  title: string;
  body: string;
}

export function splitSections(markdown: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence ? /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (h) {
      if (cur) out.push(cur);
      cur = { level: h[1]!.length, title: h[2]!.trim(), body: '' };
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line;
    }
  }
  if (cur) out.push(cur);
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}

const clean = (s: string): string => s.replace(/<!--[\s\S]*?-->/g, '').trim();

/** List items (`1.`, `-`, `*`) with their continuation lines folded in. */
export function listItems(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*(?:\d+[.)]|[-*])\s+(?!\[[ xX]\]\s)(.*\S)\s*$/.exec(line);
    if (m) items.push(m[1]!);
    else if (items.length && /^\s{2,}\S/.test(line) && !/^\s*(?:\d+[.)]|[-*])\s/.test(line)) {
      items[items.length - 1] += ' ' + line.trim();
    }
  }
  return items;
}

export function checklist(body: string): Array<{ checked: boolean; text: string; depth: number }> {
  const out: Array<{ checked: boolean; text: string; depth: number }> = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*\S)\s*$/.exec(line);
    if (m) out.push({ checked: m[2]!.toLowerCase() === 'x', text: m[3]!, depth: Math.floor(m[1]!.replace(/\t/g, '  ').length / 2) });
  }
  return out;
}

/** v7 plans put "**Acceptance Criteria:**" as a bold label, not a heading. */
function afterLabel(body: string, label: RegExp): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => label.test(l));
  if (start < 0) return '';
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\*\*[^*]+:\*\*/.test(line.trim())) break;
    out.push(line);
  }
  return out.join('\n');
}

export function buildDetail(story: Story, files: Array<{ label: string; path: string }>): StoryDetail {
  let summary = '';
  const acceptance: string[] = [];
  const tasks: StoryDetail['tasks'] = [];
  const sections: DetailSection[] = [];

  for (const f of files) {
    const text = tryReadText(f.path);
    if (text === null) continue;
    const secs = splitSections(clean(stripFrontmatter(text)));
    for (const s of secs) {
      if (!summary && SUMMARY_TITLES.test(s.title) && s.body) summary = s.body;

      if (AC_TITLE.test(s.title)) {
        if (!acceptance.length) acceptance.push(...listItems(s.body));
        continue;
      }
      if (TASKS_TITLE.test(s.title)) {
        if (!tasks.length) tasks.push(...checklist(s.body));
        const labelled = afterLabel(s.body, /^\*\*Acceptance Criteria:?\*\*/i);
        if (labelled && !acceptance.length) acceptance.push(...listItems(labelled));
        continue;
      }
      if (SUMMARY_TITLES.test(s.title) || !s.body) continue;
      if (/^(dev agent record|file list|change log|plan change log|review triage log)$/i.test(s.title)) continue; // long agent logs
      sections.push({ title: s.title, body: s.body.length > 1800 ? s.body.slice(0, 1800) + '\n…' : s.body });
    }
  }
  return { storyId: story.id, file: story.file, summary, acceptance, tasks, sections: sections.slice(0, 12), files };
}
