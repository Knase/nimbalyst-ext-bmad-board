import type { Epic, SessionInfo, Story } from '../shared/types';
import { COLUMN_LABEL } from '../shared/types';

export interface BacklogProps {
  epics: Epic[];
  stories: Story[];
  sessions: SessionInfo[];
  selectedId: string | null;
  collapsed: Set<string>;
  onToggle(epicId: string): void;
  onSelect(storyId: string): void;
  onStoryMenu(e: React.MouseEvent, story: Story): void;
  onEpicMenu(e: React.MouseEvent, epic: Epic): void;
}

export function StatusChip({ story }: { story: Story }) {
  return (
    <span className={`bb-chip bb-col-${story.column}`} title={story.status || 'no status'}>
      {COLUMN_LABEL[story.column]}
      {story.blocked ? ' ⛔' : ''}
      {story.dropped ? ' (dropped)' : ''}
    </span>
  );
}

export function SessionDot({ sessions }: { sessions: SessionInfo[] }) {
  if (!sessions.length) return null;
  const waiting = sessions.some((s) => s.status === 'waiting_for_input' || s.hasPendingPrompt);
  const running = sessions.some((s) => s.status === 'running');
  const cls = waiting ? 'bb-dot bb-dot-wait' : running ? 'bb-dot bb-dot-run' : 'bb-dot';
  const label = waiting ? 'agent waits for you' : running ? 'agent running' : `${sessions.length} session(s)`;
  return <span className={cls} title={label} aria-label={label} />;
}

export function Backlog(p: BacklogProps) {
  const byEpic = new Map<string, Story[]>();
  for (const s of p.stories) {
    const list = byEpic.get(s.epicId) ?? [];
    list.push(s);
    byEpic.set(s.epicId, list);
  }
  const shown = p.epics.filter((e) => byEpic.has(e.id) || e.total === 0);
  if (!shown.length) return <div className="bb-empty">Nothing matches the filters.</div>;

  return (
    <div className="bb-backlog">
      {shown.map((epic) => {
        const stories = byEpic.get(epic.id) ?? [];
        const open = !p.collapsed.has(epic.id);
        const pct = epic.total ? Math.round((epic.done / epic.total) * 100) : 0;
        return (
          <section key={epic.id} className="bb-epic">
            <header
              className="bb-epic-head"
              onClick={() => p.onToggle(epic.id)}
              onContextMenu={(e) => p.onEpicMenu(e, epic)}
            >
              <span className="bb-caret">{open ? '▾' : '▸'}</span>
              <span className="bb-epic-title">
                <span className="bb-epic-num">{epic.num}</span> {epic.title}
              </span>
              {epic.refined === false && <span className="bb-chip bb-chip-warn" title="epic file says refined: false">unrefined</span>}
              {epic.after.length > 0 && <span className="bb-muted" title="Epic depends on">after {epic.after.join(', ')}</span>}
              <span className={`bb-chip bb-epic-status${epic.statusDerived ? ' bb-derived' : ''}`} title={epic.statusDerived ? 'derived from stories' : 'recorded'}>
                {epic.status || '—'}
              </span>
              <span className="bb-progress" title={`${epic.done}/${epic.total} done`}>
                <span className="bb-progress-bar" style={{ width: `${pct}%` }} />
              </span>
              <span className="bb-count">{epic.done}/{epic.total}</span>
            </header>
            {open && (
              <ul className="bb-stories">
                {stories.map((s) => (
                  <li
                    key={s.id}
                    className={`bb-story${p.selectedId === s.id ? ' bb-selected' : ''}${s.dropped ? ' bb-dropped' : ''}`}
                    onClick={() => p.onSelect(s.id)}
                    onContextMenu={(e) => p.onStoryMenu(e, s)}
                  >
                    <span className="bb-ref">{s.ref}</span>
                    {s.type && s.type !== 'story' && <span className="bb-chip">{s.type}</span>}
                    <span className="bb-story-title">{s.title}</span>
                    {s.after.length > 0 && <span className="bb-muted" title="Depends on">⤴ {s.after.join(', ')}</span>}
                    {!s.movable && <span className="bb-muted" title={s.lockedReason}>🔒</span>}
                    <SessionDot sessions={p.sessions.filter((x) => x.storyId === s.id)} />
                    <StatusChip story={s} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
