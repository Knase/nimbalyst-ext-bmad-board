import type { PanelHost } from '@nimbalyst/extension-sdk';
import { mergeSettings, type BoardSettings } from '../shared/types';

const KEY = 'settings.v1';

export function loadSettings(host: PanelHost): BoardSettings {
  try {
    return mergeSettings(host.storage.getGlobal<Partial<BoardSettings>>(KEY));
  } catch {
    return mergeSettings(undefined);
  }
}

export async function saveSettings(host: PanelHost, s: BoardSettings): Promise<void> {
  await host.storage.setGlobal(KEY, s);
}
