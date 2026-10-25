/**
 * Small file helpers for the backend module. Everything is synchronous on
 * purpose: a read-modify-write that never yields keeps the window in which an
 * agent could write the same file as small as it can be.
 */
import { readFileSync, readdirSync, renameSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export function readText(path: string): string {
  const text = readFileSync(path, 'utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function tryReadText(path: string): string | null {
  try {
    return readText(path);
  } catch {
    return null;
  }
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function listDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

/** Write via a temp file in the same folder so a reader never sees half a file. */
export function writeFileAtomic(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

/** Folders never worth descending into when hunting for BMAD files. */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', 'var', 'generated', 'pub', 'static',
  '.next', '.cache', 'coverage', '__pycache__', '.venv', 'target', 'Pods', '.idea',
]);

export interface WalkOptions {
  maxDepth: number;
  /** Return true to collect the file. */
  match: (name: string, fullPath: string) => boolean;
  limit?: number;
}

/** Depth-limited search that skips heavy folders. Results are sorted for determinism. */
export function walkFind(root: string, opts: WalkOptions): string[] {
  const out: string[] = [];
  const limit = opts.limit ?? 50;
  const visit = (dir: string, depth: number): void => {
    if (out.length >= limit) return;
    for (const name of listDir(dir).sort()) {
      if (out.length >= limit) return;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (depth < opts.maxDepth && !SKIP_DIRS.has(name)) visit(full, depth + 1);
      } else if (opts.match(name, full)) {
        out.push(full);
      }
    }
  };
  if (isDir(root)) visit(root, 0);
  return out;
}


// ─── Frontmatter ───────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export type FmValue = string | number | boolean | Array<string | number | boolean>;

function scalar(raw: string): FmValue {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((p) => scalar(p) as string | number | boolean);
  }
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    if (v[0] === '"') {
      try {
        return String(JSON.parse(v));
      } catch {
        /* fall through to raw slice */
      }
    }
    return v.slice(1, -1).replace(/''/g, "'");
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

/** Strip a trailing ` # comment` from an unquoted value, or from after a quoted one. */
function stripComment(value: string): string {
  const v = value.trim();
  const quoted = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s+#.*$/.exec(v);
  if (quoted) return quoted[1]!;
  if (v.startsWith('"') || v.startsWith("'")) return v;
  const i = v.search(/\s#/);
  return i >= 0 ? v.slice(0, i).trim() : v;
}

/** Same lenient YAML subset BMAD's own tickets.py reads: `key: value`, inline lists, scalars. */
export function parseFrontmatter(text: string): Record<string, FmValue> {
  const m = FRONTMATTER_RE.exec(text);
  const out: Record<string, FmValue> = {};
  if (!m) return out;
  for (const line of m[1]!.split(/\r?\n/)) {
    if (/^\s/.test(line) || line.startsWith('- ')) continue; // block lists and continuations: skipped, like lenient tickets.py
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    out[line.slice(0, idx).trim()] = scalar(stripComment(line.slice(idx + 1)));
  }
  return out;
}

export function fmString(v: FmValue | undefined): string {
  return v === undefined || Array.isArray(v) ? '' : String(v);
}

export function stripFrontmatter(text: string): string {
  const m = FRONTMATTER_RE.exec(text);
  return m ? text.slice(m[0].length) : text;
}

/** JSON string literal: valid YAML double-quoted scalar for every title we meet. */
export const quoted = (s: string): string => JSON.stringify(s);

/**
 * Set, replace or delete top-level frontmatter keys without touching any other
 * line. A `null` value deletes the key. Values must already be formatted
 * (use `quoted` for free text). Creates the block when the file has none.
 */
export function editFrontmatter(text: string, values: Record<string, string | null>): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const m = FRONTMATTER_RE.exec(text);
  const lines = m ? m[1]!.split(/\r?\n/) : [];
  const rest = m ? text.slice(m[0].length) : text;

  for (const [key, value] of Object.entries(values)) {
    const idx = lines.findIndex((l) => new RegExp(`^${escapeRe(key)}\\s*:`).test(l));
    if (value === null) {
      if (idx >= 0) lines.splice(idx, 1);
      continue;
    }
    if (idx >= 0) {
      // Keep a trailing ` # comment` the template put there.
      const comment = /\s+#.*$/.exec(lines[idx]!.slice(lines[idx]!.indexOf(':') + 1));
      const hadQuoted = /^\s*["']/.test(lines[idx]!.slice(lines[idx]!.indexOf(':') + 1));
      lines[idx] = `${key}: ${value}${comment && !hadQuoted ? comment[0] : ''}`;
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return `---${eol}${lines.join(eol)}${eol}---${eol}${rest}`;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── sprint-status.yaml style lines ────────────────────────────────────────

export interface LineEdit {
  text: string;
  found: boolean;
  changed: boolean;
  previous?: string;
}

/**
 * Replace the value on `key: value  # comment`, keeping indentation, trailing
 * comment, line order and every other line byte-identical.
 */
export function editYamlLine(text: string, key: string, value: string): LineEdit {
  const re = new RegExp(`^(\\s*${escapeRe(key)}\\s*:\\s*)([^\\s#][^#]*?)(\\s*(?:#.*)?)$`, 'm');
  const m = re.exec(text);
  if (!m) return { text, found: false, changed: false };
  const previous = m[2]!.trim();
  if (previous === value) return { text, found: true, changed: false, previous };
  const next = text.slice(0, m.index) + `${m[1]}${value}${m[3]}` + text.slice(m.index + m[0].length);
  return { text: next, found: true, changed: true, previous };
}
