/**
 * Locating BMAD in a project: merged config, output folder, version detection.
 *
 * v7 reads `[core]` from the merged TOML config (`_bmad/config.toml`, then
 * `_bmad/custom/config.toml`, then `_bmad/custom/config.user.toml`, later wins),
 * which is what BMAD's own tickets.py does. v6 keeps `output_folder` and
 * `implementation_artifacts` in `_bmad/bmm/config.yaml`.
 */
import { isAbsolute, join, resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { isDir, isFile, listDir, readText, tryReadText, walkFind } from './fsutil';
import type { BmadVersion } from '../shared/types';

export interface BmadConfig {
  projectRoot: string;
  outputFolder: string;
  activeInitiative: string | null;
  implementationArtifacts: string | null;
  planningArtifacts: string | null;
  /** Any `_bmad/**` config file was found. */
  hasConfig: boolean;
}

export const DEFAULT_OUTPUT = '_bmad-output';

function substitute(value: string, projectRoot: string): string {
  const v = value.replace(/\{project-root\}/g, projectRoot);
  return isAbsolute(v) ? v : resolve(projectRoot, v);
}

function readTomlCore(path: string): Record<string, unknown> {
  const text = tryReadText(path);
  if (text === null) return {};
  try {
    const doc = parseToml(text) as Record<string, unknown>;
    const core = doc.core;
    return core && typeof core === 'object' ? (core as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** `key: value` lines of a flat YAML config; good enough for `output_folder` and friends. */
function readYamlFlat(path: string): Record<string, string> {
  const text = tryReadText(path);
  const out: Record<string, string> = {};
  if (text === null) return out;
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+):\s*(.+?)\s*(?:#.*)?$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return out;
}

export function loadConfig(projectRoot: string): BmadConfig {
  const bmad = join(projectRoot, '_bmad');
  const tomlFiles = [
    join(bmad, 'config.toml'),
    join(bmad, 'method', 'config.toml'),
    join(bmad, 'custom', 'config.toml'),
    join(bmad, 'custom', 'config.user.toml'),
  ];
  const yamlFiles = [join(bmad, 'core', 'config.yaml'), join(bmad, 'bmm', 'config.yaml')];

  let core: Record<string, unknown> = {};
  let hasConfig = false;
  for (const f of tomlFiles) {
    if (isFile(f)) hasConfig = true;
    core = { ...core, ...readTomlCore(f) };
  }
  let yaml: Record<string, string> = {};
  for (const f of yamlFiles) {
    if (isFile(f)) hasConfig = true;
    yaml = { ...yaml, ...readYamlFlat(f) };
  }

  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const outputRaw = str(core.output_folder) ?? str(yaml.output_folder) ?? DEFAULT_OUTPUT;
  const implRaw = str(yaml.implementation_artifacts) ?? str(core.implementation_artifacts);
  const planRaw = str(yaml.planning_artifacts) ?? str(core.planning_artifacts);

  return {
    projectRoot,
    outputFolder: substitute(outputRaw, projectRoot),
    activeInitiative: str(core.active_initiative),
    implementationArtifacts: implRaw ? substitute(implRaw, projectRoot) : null,
    planningArtifacts: planRaw ? substitute(planRaw, projectRoot) : null,
    hasConfig,
  };
}

export interface Detection {
  version: BmadVersion;
  config: BmadConfig;
  /** v6 sprint file, when one exists (also set in `v7` mode when both are present). */
  sprintFile: string | null;
  /** v7 initiative folder names (direct children of the output folder with tickets/tickets.toml). */
  initiatives: string[];
  /** Both v6 and v7 markers were found. */
  legacySprintAlongsideV7: boolean;
}

export function findSprintFile(config: BmadConfig): string | null {
  const direct = [
    config.implementationArtifacts ? join(config.implementationArtifacts, 'sprint-status.yaml') : null,
    join(config.outputFolder, 'implementation-artifacts', 'sprint-status.yaml'),
    join(config.projectRoot, DEFAULT_OUTPUT, 'implementation-artifacts', 'sprint-status.yaml'),
  ];
  for (const p of direct) if (p && isFile(p)) return p;

  const inOutput = walkFind(config.outputFolder, { maxDepth: 4, match: (n) => n === 'sprint-status.yaml', limit: 1 });
  if (inOutput[0]) return inOutput[0];
  const inRoot = walkFind(config.projectRoot, { maxDepth: 3, match: (n) => n === 'sprint-status.yaml', limit: 1 });
  return inRoot[0] ?? null;
}

export function findInitiatives(outputFolder: string): string[] {
  return listDir(outputFolder)
    .filter((name) => /^initiative-/.test(name) && isFile(join(outputFolder, name, 'tickets', 'tickets.toml')))
    .sort();
}

export function detect(projectRoot: string): Detection {
  const config = loadConfig(projectRoot);
  const sprintFile = findSprintFile(config);
  const initiatives = isDir(config.outputFolder) ? findInitiatives(config.outputFolder) : [];
  const isV7 = config.activeInitiative !== null || initiatives.length > 0;
  const version: BmadVersion = isV7 ? 'v7' : sprintFile ? 'v6' : 'none';
  return { version, config, sprintFile, initiatives, legacySprintAlongsideV7: isV7 && sprintFile !== null };
}

/** Locate `epics.md` (or a sharded `epics/` folder) next to the planning artifacts. */
export function findEpicsText(config: BmadConfig, sprintFile: string | null): string {
  const candidates: string[] = [];
  if (config.planningArtifacts) candidates.push(config.planningArtifacts);
  candidates.push(join(config.outputFolder, 'planning-artifacts'));
  if (sprintFile) candidates.push(join(sprintFile, '..', '..', 'planning-artifacts'));

  for (const dir of candidates) {
    const file = join(dir, 'epics.md');
    if (isFile(file)) return readText(file);
    const sharded = join(dir, 'epics');
    if (isDir(sharded)) {
      const parts = listDir(sharded)
        .filter((n) => n.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((n) => tryReadText(join(sharded, n)) ?? '');
      if (parts.some((p) => p.trim())) return parts.join('\n\n');
    }
  }
  const found = walkFind(config.outputFolder, { maxDepth: 4, match: (n) => n === 'epics.md', limit: 1 });
  return found[0] ? (tryReadText(found[0]) ?? '') : '';
}
