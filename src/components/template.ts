import type { BmadVersion, Epic, Story } from '../shared/types';

export interface TemplateContext {
  version: BmadVersion;
  projectRoot: string;
  story?: Story;
  epic?: Epic;
}

/** Path relative to the project, with forward slashes, so prompts stay portable. */
export function relativeTo(root: string, path: string): string {
  const norm = (s: string) => s.replace(/\\/g, '/');
  const r = norm(root).replace(/\/+$/, '');
  const p = norm(path);
  return p.startsWith(r + '/') ? p.slice(r.length + 1) : p;
}

/**
 * Expand `{key}`, `{ref}`, `{epic}`, `{file}`, `{title}`. Unknown tokens stay
 * as typed so a typo is visible in the confirm dialog.
 *  - key:  v6 story key (`1-2-logout`), v7 `<epic>.<entry>`
 *  - ref:  `<epic>.<entry>` (v7) / story key (v6)
 *  - file: project-relative story file; falls back to key when none exists yet
 */
export function expandTemplate(template: string, ctx: TemplateContext): string {
  const { story, epic } = ctx;
  const key = story ? (ctx.version === 'v6' ? story.id : story.ref) : '';
  const values: Record<string, string> = {
    key,
    ref: story?.ref ?? '',
    epic: epic?.num ?? '',
    file: story ? (story.file ? relativeTo(ctx.projectRoot, story.file) : key) : '',
    title: story?.title ?? '',
  };
  return template.replace(/\{(key|ref|epic|file|title)\}/g, (_m, name: string) => values[name] ?? '');
}
