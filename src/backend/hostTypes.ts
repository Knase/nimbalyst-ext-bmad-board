/**
 * The slice of the host's backend API this module uses. Declared locally so the
 * module typechecks without depending on which SDK build exports these types.
 * Shapes follow @nimbalyst/extension-sdk 0.7.1 `types/backendSessions.d.ts`.
 */
export type SessionStatus = 'idle' | 'running' | 'waiting_for_input' | 'error' | 'interrupted';

export interface OwnedSession {
  sessionId: string;
  key: string;
  sessionType: string;
  title: string;
  status: SessionStatus;
  hasPendingPrompt: boolean;
  updatedAt: number;
}

export interface HostSessions {
  create(options: {
    ownerKey: string;
    name: string;
    provider: string;
    model: string;
    prompt?: string;
    effortLevel?: string;
  }): Promise<{ sessionId: string; queuedPromptId: string | null }>;
  listOwned(options?: { key?: string }): Promise<OwnedSession[]>;
  onSettled(handler: (event: { sessionId: string; ownerKey: string }) => void): () => void;
}

export interface HostPanels {
  setGutterBadge(panelId: string, value: number | null, options?: { tone?: 'default' | 'warning' }): Promise<void>;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: unknown;
  scope?: 'global' | 'editor';
  panelOnly?: boolean;
}

export interface ToolCallContext {
  sessionId: string | null;
  workspacePath: string;
  caller: 'agent' | 'panel' | 'voice';
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ActivateCtx {
  services: {
    workspacePath: string;
    dataDir?: string;
    log: (level: LogLevel, message: string, data?: unknown) => void;
    registerMcpTools: (tools: McpToolDef[]) => Promise<{ registered: string[] }>;
    sessions?: HostSessions;
    panels?: HostPanels;
  };
}
