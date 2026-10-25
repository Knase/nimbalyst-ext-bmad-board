/**
 * BMAD Board backend module (utility process, one per workspace).
 * Owns all file access and the board's agent sessions; the panel only calls
 * the panel-only tools registered here.
 */
import { badgeFor, createHandlers, listSessions, PANEL_TOOL_DEFS } from './backend/tools';
import type { ActivateCtx } from './backend/hostTypes';
import { PANEL_ID } from './shared/types';

const RECHECK_MS = 15_000;

export async function activate(ctx: ActivateCtx) {
  const { workspacePath, log, registerMcpTools, sessions, panels } = ctx.services;
  await registerMcpTools(PANEL_TOOL_DEFS);

  const handlers = createHandlers(workspacePath, sessions);

  // Gutter badge: how many board sessions need the user. Only sent on change.
  let last = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const publish = async (): Promise<void> => {
    if (!panels || !sessions) return;
    try {
      const b = badgeFor(await listSessions(sessions));
      const key = `${b.value}|${b.tone}`;
      if (key === last) return;
      await panels.setGutterBadge(PANEL_ID, b.value, { tone: b.tone });
      last = key;
    } catch (error) {
      log('warn', '[bmad-board] gutter badge update failed', { error: String(error) });
    }
  };
  const request = (): void => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void publish();
    }, 500);
  };
  const off = sessions?.onSettled(() => request());
  const interval = panels && sessions ? setInterval(request, RECHECK_MS) : null;
  void publish();

  const methods: Record<string, (params: unknown, methodCtx: unknown) => Promise<unknown>> = {};
  for (const [name, handler] of Object.entries(handlers)) {
    methods[name] = async (params, methodCtx) => {
      const caller = (methodCtx as { call?: { caller?: string } } | undefined)?.call?.caller;
      if (caller === 'agent') throw new Error(`${name} is only available to the BMAD Board panel`);
      const result = await handler((params && typeof params === 'object' ? params : {}) as Record<string, unknown>);
      if (name.endsWith('run') || name.endsWith('set_status')) request();
      return result;
    };
  }

  return {
    methods,
    deactivate: () => {
      off?.();
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    },
  };
}
