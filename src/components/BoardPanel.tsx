import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PanelHostProps } from '@nimbalyst/extension-sdk';
import {
  COLUMNS_V6,
  COLUMNS_V7,
  COLUMN_LABEL,
  type BoardModel,
  type BoardSettings,
  type ColumnId,
  type ColumnRule,
  type ContextAction,
  type Epic,
  type Story,
} from '../shared/types';
import { Backlog } from './Backlog';
import { Board } from './Board';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { ConfirmDialog, ModelSelect, SettingsDialog, type ConfirmSpec } from './Dialogs';
import { Details } from './Details';
import { createClient, errorText } from './client';
import { loadSettings, saveSettings } from './settings';
import { expandTemplate } from './template';

type View = 'backlog' | 'board';
interface MenuState {
  x: number;
  y: number;
  title: string;
  items: MenuItem[];
}

const readView = (host: PanelHostProps['host']): View => {
  try {
    return host.storage.get<View>('view') === 'board' ? 'board' : 'backlog';
  } catch {
    return 'backlog';
  }
};

export function BoardPanel({ host }: PanelHostProps) {
  const client = useMemo(() => createClient(host), [host]);
  const [settings, setSettings] = useState<BoardSettings>(() => loadSettings(host));
  const [model, setModel] = useState<BoardModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => readView(host));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [epicFilter, setEpicFilter] = useState('');
  const [columnFilter, setColumnFilter] = useState('');
  const [initiative, setInitiative] = useState<string | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const revRef = useRef<string>('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const initiativeRef = useRef(initiative);
  initiativeRef.current = initiative;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  // ── loading: one fetch now, then poll (no file-watch event in the SDK) ────
  const reload = useCallback(async (force = false) => {
    try {
      const res = await client.load({ initiative: initiativeRef.current, since: force ? undefined : revRef.current || undefined });
      setError(null);
      if (res.unchanged) return;
      revRef.current = res.model.rev;
      setModel(res.model);
    } catch (e) {
      setError(errorText(e));
    }
  }, [client]);

  useEffect(() => {
    void reload(true);
  }, [reload, initiative]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void reload();
    }, settings.pollMs);
    const onVisible = () => !document.hidden && void reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload, settings.pollMs]);

  // ── right pane: the host shows the toggle in the panel chrome ─────────────
  useEffect(() => {
    host.setPanes?.({ right: { label: 'Details', collapsed: rightCollapsed } });
  }, [host, rightCollapsed]);
  useEffect(() => host.onPaneToggle?.((side) => side === 'right' && setRightCollapsed((c) => !c)), [host]);
  useEffect(() => () => host.setPanes?.(null), [host]);

  const setViewPersist = (v: View) => {
    setView(v);
    void host.storage.set('view', v).catch(() => undefined);
  };

  // ── derived data ──────────────────────────────────────────────────────────
  const version = model?.version ?? 'none';
  const columns = version === 'v7' ? COLUMNS_V7 : COLUMNS_V6;
  const epicById = useMemo(() => new Map((model?.epics ?? []).map((e) => [e.id, e])), [model]);
  const visibleStories = useMemo(
    () =>
      (model?.stories ?? []).filter(
        (s) =>
          (settings.showDropped || !s.dropped) &&
          (!epicFilter || s.epicId === epicFilter) &&
          (!columnFilter || s.column === columnFilter),
      ),
    [model, settings.showDropped, epicFilter, columnFilter],
  );
  const selected = model?.stories.find((s) => s.id === selectedId) ?? null;

  // ── running things ────────────────────────────────────────────────────────
  const startSession = useCallback(
    async (ownerKey: string, name: string, prompt: string) => {
      const st = settingsRef.current;
      try {
        await client.run({ ownerKey, name, prompt, model: st.model, ...(st.effort ? { effortLevel: st.effort } : {}) });
        flash('Session started');
        void reload(true);
      } catch (e) {
        flash(errorText(e));
      }
    },
    [client, flash, reload],
  );

  const writeStatus = useCallback(
    async (story: Story, status: string): Promise<boolean> => {
      try {
        const res = await client.setStatus({ storyId: story.id, status, initiative: initiativeRef.current });
        if (res.epicBumped) flash(`Epic moved to ${res.epicBumped}`);
        await reload(true);
        return true;
      } catch (e) {
        flash(errorText(e));
        return false;
      }
    },
    [client, flash, reload],
  );

  const changeSettings = useCallback(
    (next: BoardSettings) => {
      setSettings(next);
      void saveSettings(host, next).catch((e) => flash(`Could not save settings: ${errorText(e)}`));
    },
    [host, flash],
  );

  const ctxFor = useCallback(
    (story?: Story, epic?: Epic) => ({ version, projectRoot: model?.projectRoot ?? host.workspacePath, story, epic }),
    [version, model?.projectRoot, host.workspacePath],
  );

  /** Ask (unless told not to), then optionally write a status and start a session. */
  const launch = useCallback(
    (opts: { title: string; story?: Story; epic?: Epic; ownerKey: string; sessionName: string; template: string; status?: string; rule?: ColumnRule }) => {
      const st = settingsRef.current;
      const command = opts.template ? expandTemplate(opts.template, ctxFor(opts.story, opts.epic)) : '';
      const preWrite = opts.status && (!command || (st.writeStatusBeforeRun && !opts.rule?.statusByCommand));
      const go = async () => {
        if (opts.status && opts.story && preWrite) {
          if (!(await writeStatus(opts.story, opts.status))) return;
        }
        if (command) await startSession(opts.ownerKey, opts.sessionName, command);
      };
      const mustAsk = Boolean(opts.rule?.forceConfirm) || (!st.dontAsk && Boolean(command));
      if (!mustAsk) {
        void go();
        return;
      }
      setConfirm({
        title: opts.title,
        status: opts.status && preWrite ? opts.status : undefined,
        command: command || undefined,
        allowDontAsk: !opts.rule?.forceConfirm,
        confirmLabel: command ? 'Run' : 'Move',
        statusOnly: command && opts.status && opts.story && preWrite ? () => void writeStatus(opts.story!, opts.status!) : undefined,
        run: (dontAsk) => {
          if (dontAsk && !settingsRef.current.dontAsk) changeSettings({ ...settingsRef.current, dontAsk: true });
          void go();
        },
      });
    },
    [ctxFor, writeStatus, startSession, changeSettings],
  );

  const moveStory = useCallback(
    (story: Story, column: ColumnId) => {
      if (story.column === column) return;
      if (!story.movable) return flash(story.lockedReason ?? 'This story cannot be moved.');
      const st = settingsRef.current;
      const rules = version === 'v7' ? st.rulesV7 : st.rulesV6;
      const rule = rules[column];
      if (!rule || (!rule.status && !rule.command)) return flash(`No rule for ${COLUMN_LABEL[column]}. Set one in settings.`);
      launch({
        title: `${story.ref} → ${COLUMN_LABEL[column]}`,
        story,
        epic: epicById.get(story.epicId),
        ownerKey: story.id,
        sessionName: `${story.ref} ${story.title}`.slice(0, 80),
        template: rule.command,
        status: rule.status,
        rule,
      });
    },
    [version, launch, flash, epicById],
  );

  const runAction = useCallback(
    (action: ContextAction, story?: Story, epic?: Epic) => {
      const template = version === 'v7' ? action.v7 : action.v6;
      if (!template) return;
      const target = story ? `${story.ref} ${story.title}` : `${epic?.num ?? ''} ${epic?.title ?? ''}`;
      launch({
        title: `${action.label}: ${target}`.slice(0, 100),
        story,
        epic: epic ?? (story ? epicById.get(story.epicId) : undefined),
        ownerKey: story ? story.id : `epic:${epic?.id ?? 'board'}`,
        sessionName: `${action.label}: ${target}`.slice(0, 80),
        template,
      });
    },
    [version, launch, epicById],
  );

  const runBannerAction = (which: 'migrate' | 'plan', label: string) => {
    const prompt = which === 'migrate' ? settings.migratePrompt : settings.planPrompt;
    launch({ title: label, ownerKey: 'board', sessionName: label, template: prompt });
  };

  // ── context menus ─────────────────────────────────────────────────────────
  const storyMenu = (e: React.MouseEvent, story: Story) => {
    e.preventDefault();
    setSelectedId(story.id);
    const epic = epicById.get(story.epicId);
    const items: MenuItem[] = settings.actions
      .filter((a) => a.scope === 'story' && (version === 'v7' ? a.v7 : a.v6))
      .map((a) => ({ label: a.label, onSelect: () => runAction(a, story, epic) }));
    items.push({ separator: true, label: '' });
    items.push({
      label: 'Move to',
      disabled: !story.movable,
      children: columns.filter((c) => c !== story.column).map((c) => ({ label: COLUMN_LABEL[c], onSelect: () => moveStory(story, c) })),
    });
    if (story.file) items.push({ label: 'Open file', onSelect: () => host.openFile(story.file!) });
    setMenu({ x: e.clientX, y: e.clientY, title: `${story.ref} ${story.title}`, items });
  };

  const epicMenu = (e: React.MouseEvent, epic: Epic) => {
    e.preventDefault();
    const items: MenuItem[] = settings.actions
      .filter((a) => a.scope === 'epic' && (version === 'v7' ? a.v7 : a.v6))
      .map((a) => ({ label: a.label, onSelect: () => runAction(a, undefined, epic) }));
    if (epic.file) items.push({ label: 'Open epic file', onSelect: () => host.openFile(epic.file!) });
    if (!items.length) return;
    setMenu({ x: e.clientX, y: e.clientY, title: `${epic.num} ${epic.title}`, items });
  };

  const toggleEpic = (id: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // ── render ────────────────────────────────────────────────────────────────
  const selectedSessions = selected && model ? model.sessions.filter((s) => s.storyId === selected.id) : [];
  const empty = model !== null && model.version === 'none';

  return (
    <div className="bb-root">
      <header className="bb-header">
        <div className="bb-tabs" role="tablist">
          {(['backlog', 'board'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={`bb-tab${view === v ? ' bb-tab-on' : ''}`} onClick={() => setViewPersist(v)}>
              {v === 'backlog' ? 'Backlog' : 'Board'}
            </button>
          ))}
        </div>
        <select className="bb-select" value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)} aria-label="Epic filter">
          <option value="">All epics</option>
          {model?.epics.map((e) => <option key={e.id} value={e.id}>{e.num} · {e.title}</option>)}
        </select>
        <select className="bb-select" value={columnFilter} onChange={(e) => setColumnFilter(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {columns.map((c) => <option key={c} value={c}>{COLUMN_LABEL[c]}</option>)}
        </select>
        {version === 'v7' && model && model.initiatives.length > 0 && (
          <select
            className="bb-select"
            value={initiative ?? model.activeInitiative ?? ''}
            onChange={(e) => {
              revRef.current = '';
              setInitiative(e.target.value || undefined);
              setSelectedId(null);
            }}
            aria-label="Initiative"
          >
            {model.initiatives.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        <span className="bb-spacer" />
        <ModelSelect value={settings.model} onChange={(m) => changeSettings({ ...settings, model: m })} />
        <span className="bb-chip" title="Detected BMAD version">{version === 'none' ? 'no BMAD' : version}</span>
        <button className="bb-btn" onClick={() => void reload(true)} title="Reload from files">↻</button>
        <button className="bb-btn" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
      </header>

      {model?.banners.map((b) => (
        <div key={b.id} className={`bb-banner bb-banner-${b.kind}`}>
          <span>{b.message}</span>
          {b.action && (
            <button className="bb-btn" onClick={() => runBannerAction(b.action!.promptSetting, b.action!.label)}>
              {b.action.label}
            </button>
          )}
        </div>
      ))}
      {error && <div className="bb-banner bb-banner-error">{error}</div>}

      <div className="bb-body">
        <main className="bb-main">
          {!model && !error && <div className="bb-empty">Loading…</div>}
          {model && !empty && view === 'backlog' && (
            <Backlog
              epics={model.epics.filter((e) => !epicFilter || e.id === epicFilter)}
              stories={visibleStories}
              sessions={model.sessions}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={toggleEpic}
              onSelect={setSelectedId}
              onStoryMenu={storyMenu}
              onEpicMenu={epicMenu}
            />
          )}
          {model && !empty && view === 'board' && (
            <Board
              columns={columns}
              epics={model.epics}
              stories={visibleStories}
              sessions={model.sessions}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={toggleEpic}
              onSelect={setSelectedId}
              onMove={moveStory}
              onStoryMenu={storyMenu}
              onEpicMenu={epicMenu}
            />
          )}
          {empty && <div className="bb-empty">Nothing to show yet. Use the banner above to start planning.</div>}
        </main>
        {!rightCollapsed && !empty && (
          <aside className="bb-aside">
            <Details
              host={host}
              client={client}
              story={selected}
              epic={selected ? epicById.get(selected.epicId) ?? null : null}
              sessions={selectedSessions}
              initiative={initiative}
              rev={model?.rev ?? ''}
            />
          </aside>
        )}
      </div>

      {toast && <div className="bb-toast" role="status">{toast}</div>}
      {menu && <ContextMenu x={menu.x} y={menu.y} title={menu.title} items={menu.items} onClose={() => setMenu(null)} />}
      {confirm && <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />}
      {settingsOpen && <SettingsDialog settings={settings} version={version} onSave={changeSettings} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
