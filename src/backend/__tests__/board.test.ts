import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyStatus, loadBoard, storyDetail } from '../board';
import { badgeFor, createHandlers, splitModel } from '../tools';
import { editYamlLine } from '../fsutil';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bmad-board-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (rel: string, text: string): string => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  return p;
};

const SPRINT = `# generated
generated: 2026-01-01
development_status:
  epic-1: in-progress
  1-1-login: done
  1-2-logout: ready-for-dev # keep me
  epic-1-retrospective: optional
  epic-2: backlog
  2-1-cart: backlog
`;
const EPICS = `# Epics
## Epic 1: Accounts
### Story 1.1: Login
### Story 1.2: Logout
## Epic 2: Shop
### Story 2.1: Cart
### Story 2.2: Checkout
`;

function v6(): string {
  const sprint = put('_bmad-output/implementation-artifacts/sprint-status.yaml', SPRINT);
  put('_bmad-output/planning-artifacts/epics.md', EPICS);
  put(
    '_bmad-output/implementation-artifacts/1-2-logout.md',
    `# Story 1.2: Logout\n\n## Story\nAs a user I want to log out.\n\n## Acceptance Criteria\n1. Session ends\n2. Cookie cleared\n\n## Tasks / Subtasks\n- [x] Add endpoint\n  - [ ] Add test\n\n## Dev Agent Record\nlong log\n`,
  );
  return sprint;
}

const REAL_SPRINT = `generated: "2026-06-19"
project: printbox
story_location: _bmad-output/implementation-artifacts/stories

epic_priority:
  shipped:
    epics: [epic-a, epic-af]

development_status:

  epic-a: done

  epic-3: done

  epic-cm: in-progress
  cm-1-license-keys-free-cap: done
  cm-4-product-site-docs-privacy: review
  epic-cm-retrospective: done
  retro-cm-ai-1-prelaunch-gate-script: ready-for-dev

  ar-32-shared-file-hash-fix: done
  epic-af: done
  af-23a-the-tags-tab-follows-the-selection: in-progress
  retro-sp-ai-2-story-acs-schema-claim: review

  epic-sp: in-progress
  sp-1-counting-pre-pass: done

  epic-ar: done

  epic-mr: in-progress
  mr-14b-the-rp-card-retires: ready-for-dev
  mesh-markers-producer: done

  epic-pb: in-progress
  pb-01-protocol-spike-real-reports: in-progress
  epic-pb-retrospective: optional
`;

describe('BMAD v6 with alphabetic epics (real-world sprint file)', () => {
  beforeEach(() => {
    put('_bmad-output/implementation-artifacts/sprint-status.yaml', REAL_SPRINT);
    // stale planning doc: numeric epics that the sprint no longer has
    put('_bmad-output/planning-artifacts/epics.md', '## Epic 1: Nothing Is Invisible\n### Story 1.1: Run scans\n### Story 1.2: Live progress\n## Epic 3: Old\n### Story 3.1: Old story\n');
    put('_bmad-output/implementation-artifacts/stories/cm-1-license-keys-free-cap.md', '# Story\n\n## Story\nKeys.\n');
  });

  it('places stories by prefix, retro rows by retro-<epic>-ai, orphans by position', () => {
    const b = loadBoard(root);
    const epicOf = (id: string) => b.model.stories.find((s) => s.id === id)!.epicId;
    expect(epicOf('cm-1-license-keys-free-cap')).toBe('epic-cm');
    expect(epicOf('retro-cm-ai-1-prelaunch-gate-script')).toBe('epic-cm');
    expect(epicOf('ar-32-shared-file-hash-fix')).toBe('epic-ar'); // prefix beats position (sits under epic-cm)
    expect(epicOf('retro-sp-ai-2-story-acs-schema-claim')).toBe('epic-sp'); // sits under epic-af
    expect(epicOf('mr-14b-the-rp-card-retires')).toBe('epic-mr');
    expect(epicOf('mesh-markers-producer')).toBe('epic-mr'); // no prefix: epic line above it
    expect(epicOf('pb-01-protocol-spike-real-reports')).toBe('epic-pb');
  });

  it('shows the sprint file, not the stale epics.md', () => {
    const b = loadBoard(root);
    expect(b.model.epics.map((e) => e.id)).toEqual(['epic-a', 'epic-3', 'epic-cm', 'epic-af', 'epic-sp', 'epic-ar', 'epic-mr', 'epic-pb']);
    expect(b.model.stories.some((s) => s.ref.startsWith('1.'))).toBe(false); // epic 1 is not in the sprint
    expect(b.model.stories.some((s) => s.ref === '3.1')).toBe(false); // epic-3 is done: its plan-only stories are not resurrected
    expect(b.model.epics.find((e) => e.id === 'epic-cm')).toMatchObject({ title: 'Epic CM', done: 1, total: 3, retrospective: 'done' });
    expect(b.model.stories.filter((s) => s.movable === false)).toHaveLength(0);
  });

  it('finds story files in story_location and keeps file order', () => {
    const b = loadBoard(root);
    expect(b.model.stories.find((s) => s.id === 'cm-1-license-keys-free-cap')!.file).toMatch(/stories\/cm-1-license-keys-free-cap\.md$/);
    expect(b.model.stories.find((s) => s.id === 'cm-4-product-site-docs-privacy')!.title).toBe('Product site docs privacy');
    expect(b.model.stories.map((s) => s.id).slice(0, 3)).toEqual(['cm-1-license-keys-free-cap', 'cm-4-product-site-docs-privacy', 'retro-cm-ai-1-prelaunch-gate-script']);
    expect(b.model.stories.find((s) => s.id.startsWith('retro-cm'))!.type).toBe('retro');
    expect(storyDetail(b, 'cm-1-license-keys-free-cap').summary).toBe('Keys.');
  });

  it('writes a status and bumps an alphabetic epic out of backlog', () => {
    put('_bmad-output/implementation-artifacts/sprint-status.yaml', 'development_status:\n  epic-pr: backlog\n  pr-3-cmds: backlog\n');
    const sprint = join(root, '_bmad-output/implementation-artifacts/sprint-status.yaml');
    expect(applyStatus(loadBoard(root), 'pr-3-cmds', 'in-progress').epicBumped).toBe('in-progress');
    expect(readFileSync(sprint, 'utf8')).toBe('development_status:\n  epic-pr: in-progress\n  pr-3-cmds: in-progress\n');
  });
});

describe('BMAD v6', () => {
  it('detects v6, groups epics and columns, keeps unplanned stories locked', () => {
    v6();
    const b = loadBoard(root);
    expect(b.model.version).toBe('v6');
    expect(b.model.epics.map((e) => [e.id, e.done, e.total])).toEqual([['epic-1', 1, 2], ['epic-2', 0, 2]]);
    const by = Object.fromEntries(b.model.stories.map((s) => [s.id, s]));
    expect(by['1-1-login']!.column).toBe('done');
    expect(by['1-2-logout']!.column).toBe('ready');
    expect(by['1-2-logout']!.title).toBe('Logout');
    const unplanned = b.model.stories.find((s) => s.ref === '2.2')!;
    expect(unplanned.movable).toBe(false);
    expect(unplanned.column).toBe('backlog');
  });

  it('writes one line, keeps comments, bumps epic from backlog', () => {
    const sprint = v6();
    const b = loadBoard(root);
    expect(applyStatus(b, '2-1-cart', 'in-progress').epicBumped).toBe('in-progress');
    const text = readFileSync(sprint, 'utf8');
    expect(text).toContain('  2-1-cart: in-progress\n');
    expect(text).toContain('  epic-2: in-progress\n');
    applyStatus(loadBoard(root), '1-2-logout', 'review');
    expect(readFileSync(sprint, 'utf8')).toContain('1-2-logout: review # keep me');
    expect(readFileSync(sprint, 'utf8')).toContain('# generated');
  });

  it('refuses foreign statuses and locked stories', () => {
    v6();
    const b = loadBoard(root);
    expect(() => applyStatus(b, '1-2-logout', 'built')).toThrow(/not a v6 status/);
    const locked = b.model.stories.find((s) => s.ref === '2.2')!;
    expect(() => applyStatus(b, locked.id, 'done')).toThrow(/sprint/i);
  });

  it('builds detail from the story file', () => {
    v6();
    const d = storyDetail(loadBoard(root), '1-2-logout');
    expect(d.summary).toContain('log out');
    expect(d.acceptance).toEqual(['Session ends', 'Cookie cleared']);
    expect(d.tasks).toEqual([
      { checked: true, text: 'Add endpoint', depth: 0 },
      { checked: false, text: 'Add test', depth: 1 },
    ]);
    expect(d.sections.find((s) => /dev agent/i.test(s.title))).toBeUndefined();
  });

  it('maps legacy drafted/contexted to Ready', () => {
    put('_bmad-output/implementation-artifacts/sprint-status.yaml', 'development_status:\n  epic-1: in-progress\n  1-1-a: drafted\n  1-2-b: contexted\n  1-3-c: weird\n');
    const b = loadBoard(root);
    expect(b.model.stories.map((s) => [s.column, s.unknownStatus])).toEqual([['ready', false], ['ready', false], ['backlog', true]]);
  });
});

const INIT = '_bmad-output/initiative-shop';
function v7(): void {
  put('_bmad/custom/config.user.toml', '[core]\nactive_initiative = "initiative-shop"\n');
  put(`${INIT}/tickets/tickets.toml`, '[[epic]]\nid = 1\nslug = "epic-cart"\ntitle = "Cart"\n\n[[epic]]\nid = 2\nslug = "epic-pay"\ntitle = "Payments"\nafter = [1]\n');
  put(`${INIT}/tickets/epic-cart/epic-cart.md`, '---\nstatus: in-progress\n---\n# Cart\n');
  put(
    `${INIT}/tickets/epic-cart/tickets/tickets.toml`,
    '[[entry]]\nid = 1\ntype = "story"\ntitle = "Add to cart"\n\n[[entry]]\nid = 2\ntype = "story"\ntitle = "Remove from cart"\nafter = [1]\n\n[[entry]]\nid = 3\ntype = "bug"\ntitle = "Cart total"\n',
  );
  put(`${INIT}/tickets/epic-cart/tickets/story-add-to-cart.md`, '---\nid: 1\ntitle: Add to cart\n---\n## Story\nAdd things.\n');
  put(
    `${INIT}/tickets/epic-cart/tickets/story-add-to-cart-plan.md`,
    '---\ntitle: Add to cart\nticket: 1\nstatus: blocked\nblocked_at: 2026-01-01\nblocked_reason: waiting on API\n---\n**Acceptance Criteria:**\n- works\n',
  );
  put(`${INIT}/tickets/epic-pay/tickets/tickets.toml`, '[[entry]]\nid = 1\ntype = "story"\ntitle = "Charge card"\n');
}

describe('BMAD v7', () => {
  it('detects v7, joins by frontmatter ids, flags blocked', () => {
    v7();
    const b = loadBoard(root);
    expect(b.model.version).toBe('v7');
    expect(b.model.activeInitiative).toBe('initiative-shop');
    const s1 = b.model.stories.find((s) => s.id === 'epic-cart:1')!;
    expect(s1.column).toBe('in-progress');
    expect(s1.blocked).toBe(true);
    expect(s1.blockedReason).toBe('waiting on API');
    expect(s1.ref).toBe('1.1');
    const s2 = b.model.stories.find((s) => s.id === 'epic-cart:2')!;
    expect(s2.column).toBe('backlog');
    expect(s2.after).toEqual(['1']);
    expect(b.model.epics.find((e) => e.id === 'epic-pay')!.after).toEqual(['1']);
    expect(b.model.epics.find((e) => e.id === 'epic-cart')!.status).toBe('in-progress');
  });

  it('writes status into the plan, clears blocked fields, creates a plan when missing', () => {
    v7();
    const plan = join(root, INIT, 'tickets/epic-cart/tickets/story-add-to-cart-plan.md');
    applyStatus(loadBoard(root), 'epic-cart:1', 'in-review');
    const text = readFileSync(plan, 'utf8');
    expect(text).toMatch(/status: in-review/);
    expect(text).not.toMatch(/blocked_/);
    expect(text).toContain('**Acceptance Criteria:**');

    applyStatus(loadBoard(root), 'epic-cart:2', 'in-progress');
    const created = join(root, INIT, 'tickets/epic-cart/tickets/story-remove-from-cart-plan.md');
    expect(existsSync(created)).toBe(true);
    expect(readFileSync(created, 'utf8')).toContain('ticket: 2');
    expect(loadBoard(root).model.stories.find((s) => s.id === 'epic-cart:2')!.column).toBe('in-progress');
  });

  it('prefers v7 and warns when an old sprint-status.yaml is around', () => {
    v7();
    v6();
    const b = loadBoard(root);
    expect(b.model.version).toBe('v7');
    expect(b.model.banners.map((x) => x.id)).toContain('legacy-sprint');
  });

  it('reads detail from leaf + plan', () => {
    v7();
    const d = storyDetail(loadBoard(root), 'epic-cart:1');
    expect(d.summary).toContain('Add things');
    expect(d.files.map((f) => f.label)).toEqual(expect.arrayContaining(['Story', 'Plan']));
  });
});

describe('empty project', () => {
  it('shows the planning banner', () => {
    const b = loadBoard(root);
    expect(b.model.version).toBe('none');
    expect(b.model.banners[0]!.action?.promptSetting).toBe('plan');
  });
});

describe('tools', () => {
  it('load returns unchanged when rev matches', async () => {
    v6();
    const h = createHandlers(root, undefined);
    const first = (await h.panel_load({})) as { unchanged: false; model: { rev: string } };
    expect(first.unchanged).toBe(false);
    const again = await h.panel_load({ since: first.model.rev });
    expect(again).toEqual({ unchanged: true, rev: first.model.rev });
  });

  it('splits provider:model and badges waiting sessions', () => {
    expect(splitModel('claude-code:sonnet')).toEqual({ provider: 'claude-code', model: 'sonnet' });
    expect(splitModel('sonnet')).toEqual({ provider: 'claude-code', model: 'sonnet' });
    const s = (status: 'running' | 'waiting_for_input', p = false) => ({ sessionId: 'x', storyId: 'a', title: '', status, hasPendingPrompt: p, updatedAt: 0 });
    expect(badgeFor([s('running')])).toEqual({ value: 0, tone: 'default' });
    expect(badgeFor([s('running'), s('waiting_for_input')])).toEqual({ value: 1, tone: 'warning' });
    expect(badgeFor([])).toEqual({ value: null, tone: 'default' });
  });

  it('run needs the sessions permission', async () => {
    const h = createHandlers(root, undefined);
    await expect(h.panel_run({ ownerKey: 'a', name: 'n', prompt: 'p', model: 'm' })).rejects.toThrow(/ai-sessions/);
  });
});

describe('editYamlLine', () => {
  it('only touches the matching key', () => {
    const r = editYamlLine('a:\n  1-1-x: backlog\n  1-1-xy: backlog\n', '1-1-x', 'done');
    expect(r.text).toBe('a:\n  1-1-x: done\n  1-1-xy: backlog\n');
  });
});
