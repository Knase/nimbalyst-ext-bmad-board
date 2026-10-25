import type { PanelHost } from '@nimbalyst/extension-sdk';
import {
  panelToolName,
  type DetailRequest,
  type LoadRequest,
  type LoadResult,
  type RunRequest,
  type RunResponse,
  type SetStatusRequest,
  type SetStatusResponse,
  type StoryDetail,
} from '../shared/types';

export interface BoardClient {
  load(req: LoadRequest): Promise<LoadResult>;
  detail(req: DetailRequest): Promise<StoryDetail>;
  setStatus(req: SetStatusRequest): Promise<SetStatusResponse>;
  run(req: RunRequest): Promise<RunResponse>;
}

export function createClient(host: PanelHost): BoardClient {
  const call = <T>(key: 'load' | 'detail' | 'setStatus' | 'run', args: object): Promise<T> =>
    host.callBackendTool(panelToolName(key), args as Record<string, unknown>) as Promise<T>;
  return {
    load: (req) => call('load', req),
    detail: (req) => call('detail', req),
    setStatus: (req) => call('setStatus', req),
    run: (req) => call('run', req),
  };
}

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
