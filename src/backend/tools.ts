/**
 * Panel-only tools. Each is a thin wrapper over board.ts that adds the host's
 * session list. Handlers re-read the files on every call (they are cheap and
 * the files are the source of truth).
 */
import { applyStatus, loadBoard, revOf, storyDetail } from './board';
import type { HostSessions, McpToolDef, OwnedSession } from './hostTypes';
import {
  PANEL_TOOLS,
  type BoardModel,
  type DetailRequest,
  type LoadRequest,
  type LoadResult,
  type RunRequest,
  type RunResponse,
  type SessionInfo,
  type SetStatusRequest,
  type SetStatusResponse,
  type StoryDetail,
} from '../shared/types';

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const PANEL_TOOL_DEFS: McpToolDef[] = [
  {
    name: PANEL_TOOLS.load,
    description: 'BMAD Board panel: load the board model for the workspace.',
    inputSchema: obj({ initiative: { type: 'string' }, since: { type: 'string' } }),
  },
  {
    name: PANEL_TOOLS.detail,
    description: 'BMAD Board panel: load one story\'s description, acceptance criteria and tasks.',
    inputSchema: obj({ storyId: { type: 'string' }, initiative: { type: 'string' } }, ['storyId']),
  },
  {
    name: PANEL_TOOLS.setStatus,
    description: 'BMAD Board panel: write one story status into the BMAD files.',
    inputSchema: obj({ storyId: { type: 'string' }, status: { type: 'string' }, initiative: { type: 'string' } }, ['storyId', 'status']),
  },
  {
    name: PANEL_TOOLS.run,
    description: 'BMAD Board panel: start a new agent session owned by the board.',
    inputSchema: obj(
      {
        ownerKey: { type: 'string' },
        name: { type: 'string' },
        prompt: { type: 'string' },
        model: { type: 'string' },
        provider: { type: 'string' },
        effortLevel: { type: 'string' },
      },
      ['ownerKey', 'name', 'prompt', 'model'],
    ),
  },
].map((t) => ({ ...t, scope: 'global' as const, panelOnly: true }));

export function splitModel(model: string, provider?: string): { provider: string; model: string } {
  if (provider) return { provider, model };
  const i = model.indexOf(':');
  return i > 0 ? { provider: model.slice(0, i), model: model.slice(i + 1) } : { provider: 'claude-code', model };
}

const text = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`"${name}" is required`);
  return v;
};
const optText = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function toSessionInfo(s: OwnedSession): SessionInfo {
  return {
    sessionId: s.sessionId,
    storyId: s.key,
    title: s.title,
    status: s.status,
    hasPendingPrompt: s.hasPendingPrompt,
    updatedAt: s.updatedAt,
  };
}

export async function listSessions(sessions: HostSessions | undefined): Promise<SessionInfo[]> {
  if (!sessions) return [];
  try {
    return (await sessions.listOwned())
      .filter((s) => s.sessionType === 'session' || !s.sessionType)
      .map(toSessionInfo);
  } catch {
    return [];
  }
}

/** Badge number: sessions that need the user (waiting for input / pending prompt). */
export function badgeFor(list: SessionInfo[]): { value: number | null; tone: 'default' | 'warning' } {
  const waiting = list.filter((s) => s.status === 'waiting_for_input' || s.hasPendingPrompt).length;
  if (waiting > 0) return { value: waiting, tone: 'warning' };
  const running = list.filter((s) => s.status === 'running').length;
  return running > 0 ? { value: 0, tone: 'default' } : { value: null, tone: 'default' };
}

export function createHandlers(workspacePath: string, sessions: HostSessions | undefined) {
  return {
    [PANEL_TOOLS.load]: async (p: Record<string, unknown>): Promise<LoadResult> => {
      const req = p as LoadRequest;
      const loaded = loadBoard(workspacePath, optText(req.initiative));
      const model: BoardModel = { ...loaded.model, sessions: await listSessions(sessions), rev: '' };
      model.rev = revOf({ ...model, rev: undefined });
      if (req.since && req.since === model.rev) return { unchanged: true, rev: model.rev };
      return { unchanged: false, model };
    },

    [PANEL_TOOLS.detail]: async (p: Record<string, unknown>): Promise<StoryDetail> => {
      const req = p as unknown as DetailRequest;
      return storyDetail(loadBoard(workspacePath, optText(req.initiative)), text(req.storyId, 'storyId'));
    },

    [PANEL_TOOLS.setStatus]: async (p: Record<string, unknown>): Promise<SetStatusResponse> => {
      const req = p as unknown as SetStatusRequest;
      return applyStatus(loadBoard(workspacePath, optText(req.initiative)), text(req.storyId, 'storyId'), text(req.status, 'status'));
    },

    [PANEL_TOOLS.run]: async (p: Record<string, unknown>): Promise<RunResponse> => {
      if (!sessions) throw new Error('The ai-sessions permission was not granted, so the board cannot start sessions.');
      const req = p as unknown as RunRequest;
      const { provider, model } = splitModel(text(req.model, 'model'), optText(req.provider));
      const res = await sessions.create({
        ownerKey: text(req.ownerKey, 'ownerKey'),
        name: text(req.name, 'name'),
        provider,
        model,
        prompt: text(req.prompt, 'prompt'),
        ...(optText(req.effortLevel) ? { effortLevel: req.effortLevel } : {}),
      });
      return { sessionId: res.sessionId };
    },
  };
}
