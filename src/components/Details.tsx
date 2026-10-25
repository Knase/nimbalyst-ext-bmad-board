import { useEffect, useState } from 'react';
import type { PanelHost } from '@nimbalyst/extension-sdk';
import type { Epic, SessionInfo, Story, StoryDetail } from '../shared/types';
import { errorText, type BoardClient } from './client';
import { StatusChip } from './Backlog';

export interface DetailsProps {
  host: PanelHost;
  client: BoardClient;
  story: Story | null;
  epic: Epic | null;
  sessions: SessionInfo[];
  initiative?: string;
  /** Changes whenever the files change, so the detail re-reads. */
  rev: string;
}

export function Details({ host, client, story, epic, sessions, initiative, rev }: DetailsProps) {
  const [detail, setDetail] = useState<StoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const storyId = story?.id ?? null;

  useEffect(() => {
    if (!storyId) {
      setDetail(null);
      return;
    }
    let live = true;
    client
      .detail({ storyId, initiative })
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setError(null);
      })
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [client, storyId, initiative, rev]);

  useEffect(() => setSessionId(null), [storyId]);

  if (!story) return <div className="bb-details bb-empty">Select a story.</div>;
  const Transcript = host.components?.SessionTranscript;

  return (
    <div className="bb-details">
      <h2 className="bb-d-title">
        <span className="bb-ref">{story.ref}</span> {story.title}
      </h2>
      <div className="bb-d-meta">
        <StatusChip story={story} />
        {epic && <span className="bb-muted">{epic.num} · {epic.title}</span>}
        {story.after.length > 0 && <span className="bb-muted">after {story.after.join(', ')}</span>}
      </div>
      {story.blocked && story.blockedReason && <div className="bb-note bb-note-err">Blocked: {story.blockedReason}</div>}
      {!story.movable && story.lockedReason && <div className="bb-note">{story.lockedReason}</div>}
      {error && <div className="bb-note bb-note-err">{error}</div>}

      {detail && (
        <>
          <div className="bb-d-files">
            {detail.files.map((f) => (
              <button key={f.path} className="bb-link" onClick={() => host.openFile(f.path)}>
                Open {f.label.toLowerCase()}
              </button>
            ))}
          </div>
          {detail.summary && <p className="bb-d-summary">{detail.summary}</p>}
          {detail.acceptance.length > 0 && (
            <>
              <h3>Acceptance criteria</h3>
              <ol className="bb-d-list">{detail.acceptance.map((a, i) => <li key={i}>{a}</li>)}</ol>
            </>
          )}
          {detail.tasks.length > 0 && (
            <>
              <h3>Tasks <span className="bb-count">{detail.tasks.filter((t) => t.checked).length}/{detail.tasks.length}</span></h3>
              <ul className="bb-d-tasks">
                {detail.tasks.map((t, i) => (
                  <li key={i} style={{ paddingLeft: t.depth * 16 }} className={t.checked ? 'bb-done' : ''}>
                    <span aria-hidden>{t.checked ? '☑' : '☐'}</span> {t.text}
                  </li>
                ))}
              </ul>
            </>
          )}
          {detail.sections.map((s, i) => (
            <details key={i} className="bb-d-section">
              <summary>{s.title}</summary>
              <pre>{s.body}</pre>
            </details>
          ))}
        </>
      )}

      <h3>Sessions {sessions.length > 0 && <span className="bb-count">{sessions.length}</span>}</h3>
      {sessions.length === 0 ? (
        <div className="bb-muted">None launched from the board for this story.</div>
      ) : (
        <ul className="bb-d-sessions">
          {sessions.map((s) => (
            <li key={s.sessionId} className={sessionId === s.sessionId ? 'bb-selected' : ''} onClick={() => setSessionId(sessionId === s.sessionId ? null : s.sessionId)}>
              <span className={`bb-dot bb-dot-${s.status === 'running' ? 'run' : s.status === 'waiting_for_input' || s.hasPendingPrompt ? 'wait' : 'idle'}`} />
              <span className="bb-session-title">{s.title || s.sessionId.slice(0, 8)}</span>
              <span className="bb-muted">{s.hasPendingPrompt ? 'needs answer' : s.status}</span>
            </li>
          ))}
        </ul>
      )}
      {sessionId && Transcript && (
        <div className="bb-transcript">
          <Transcript sessionId={sessionId} />
        </div>
      )}
    </div>
  );
}
