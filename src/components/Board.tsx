import { useState } from 'react';
import type { ColumnId, Epic, SessionInfo, Story } from '../shared/types';
import { COLUMN_LABEL } from '../shared/types';
import { SessionDot } from './Backlog';

export interface BoardProps {
  columns: ColumnId[];
  epics: Epic[];
  stories: Story[];
  sessions: SessionInfo[];
  selectedId: string | null;
  collapsed: Set<string>;
  onToggle(epicId: string): void;
  onSelect(storyId: string): void;
  onMove(story: Story, column: ColumnId): void;
  onStoryMenu(e: React.MouseEvent, story: Story): void;
  onEpicMenu(e: React.MouseEvent, epic: Epic): void;
}

interface DragState {
  id: string;
  epicId: string;
  from: ColumnId;
}

export function Board(p: BoardProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const byId = new Map(p.stories.map((s) => [s.id, s]));
  const lanes = p.epics.filter((e) => p.stories.some((s) => s.epicId === e.id));
  if (!lanes.length) return <div className="bb-empty">Nothing matches the filters.</div>;

  const cols = `repeat(${p.columns.length}, minmax(190px, 1fr))`;
  const cellKey = (epicId: string, col: ColumnId) => `${epicId}|${col}`;

  return (
    <div className="bb-board">
      <div className="bb-board-head" style={{ gridTemplateColumns: cols }}>
        {p.columns.map((c) => (
          <div key={c} className="bb-colhead">
            {COLUMN_LABEL[c]} <span className="bb-count">{p.stories.filter((s) => s.column === c).length}</span>
          </div>
        ))}
      </div>
      {lanes.map((epic) => {
        const open = !p.collapsed.has(epic.id);
        return (
          <section key={epic.id} className="bb-lane">
            <header className="bb-lane-head" onClick={() => p.onToggle(epic.id)} onContextMenu={(e) => p.onEpicMenu(e, epic)}>
              <span className="bb-caret">{open ? '▾' : '▸'}</span>
              <span className="bb-epic-num">{epic.num}</span> {epic.title}
              <span className="bb-count">{epic.done}/{epic.total}</span>
            </header>
            {open && (
              <div className="bb-lane-grid" style={{ gridTemplateColumns: cols }}>
                {p.columns.map((col) => {
                  const key = cellKey(epic.id, col);
                  const droppable = drag !== null && drag.epicId === epic.id && drag.from !== col;
                  const cards = p.stories.filter((s) => s.epicId === epic.id && s.column === col);
                  return (
                    <div
                      key={col}
                      className={`bb-cell${droppable ? ' bb-droppable' : ''}${over === key && droppable ? ' bb-over' : ''}`}
                      onDragOver={(e) => {
                        if (!droppable) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (over !== key) setOver(key);
                      }}
                      onDragLeave={() => setOver((o) => (o === key ? null : o))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const story = drag ? byId.get(drag.id) : undefined;
                        setOver(null);
                        setDrag(null);
                        if (story && droppable) p.onMove(story, col);
                      }}
                    >
                      {cards.map((s) => (
                        <article
                          key={s.id}
                          className={`bb-card${p.selectedId === s.id ? ' bb-selected' : ''}${s.dropped ? ' bb-dropped' : ''}${s.movable ? '' : ' bb-locked'}`}
                          draggable={s.movable}
                          title={s.movable ? undefined : s.lockedReason}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', s.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDrag({ id: s.id, epicId: s.epicId, from: s.column });
                          }}
                          onDragEnd={() => {
                            setDrag(null);
                            setOver(null);
                          }}
                          onClick={() => p.onSelect(s.id)}
                          onContextMenu={(e) => p.onStoryMenu(e, s)}
                        >
                          <div className="bb-card-top">
                            <span className="bb-ref">{s.ref}</span>
                            {s.type && s.type !== 'story' && <span className="bb-chip">{s.type}</span>}
                            {s.risk && <span className="bb-chip bb-chip-warn">{s.risk}</span>}
                            <span className="bb-spacer" />
                            <SessionDot sessions={p.sessions.filter((x) => x.storyId === s.id)} />
                          </div>
                          <div className="bb-card-title">{s.title}</div>
                          {(s.blocked || s.after.length > 0 || s.dropped) && (
                            <div className="bb-card-foot">
                              {s.blocked && <span className="bb-chip bb-chip-err" title={s.blockedReason}>blocked</span>}
                              {s.dropped && <span className="bb-chip">dropped</span>}
                              {s.after.length > 0 && <span className="bb-muted" title="Depends on">⤴ {s.after.join(', ')}</span>}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
