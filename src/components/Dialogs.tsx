import { useEffect, useState } from 'react';
import {
  COLUMNS_V6,
  COLUMNS_V7,
  COLUMN_LABEL,
  DEFAULT_SETTINGS,
  type BoardSettings,
  type BmadVersion,
  type ColumnId,
  type ColumnRule,
  type ContextAction,
} from '../shared/types';

export interface ConfirmSpec {
  title: string;
  /** Status that will be written, if any. */
  status?: string;
  /** The prompt a new session will start with, if any. */
  command?: string;
  /** The "don't ask again" box is hidden for destructive-looking steps. */
  allowDontAsk: boolean;
  confirmLabel: string;
  /** Offered when a command is attached: just change the status. */
  statusOnly?: () => void;
  run(dontAsk: boolean): void;
}

export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec; onClose(): void }) {
  const [dontAsk, setDontAsk] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        onClose();
        spec.run(dontAsk);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [spec, dontAsk, onClose]);

  return (
    <div className="bb-modal-backdrop" onMouseDown={onClose}>
      <div className="bb-modal" role="dialog" aria-label={spec.title} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{spec.title}</h2>
        {spec.status && <p>Status → <code>{spec.status}</code></p>}
        {spec.command && (
          <>
            <p>Starts a new agent session with:</p>
            <pre className="bb-cmd">{spec.command}</pre>
          </>
        )}
        {spec.allowDontAsk && spec.command && (
          <label className="bb-check">
            <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} /> Don't ask again (can be undone in settings)
          </label>
        )}
        <div className="bb-modal-actions">
          <button className="bb-btn" onClick={onClose}>Cancel</button>
          {spec.statusOnly && (
            <button className="bb-btn" onClick={() => { onClose(); spec.statusOnly?.(); }}>
              Only change status
            </button>
          )}
          <button className="bb-btn bb-btn-primary" onClick={() => { onClose(); spec.run(dontAsk); }}>
            {spec.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const MODELS = ['claude-code:sonnet', 'claude-code:opus', 'claude-code:haiku'];
const EFFORTS = ['', 'low', 'medium', 'high', 'xhigh', 'max'];

export function ModelSelect({ value, onChange, className }: { value: string; onChange(v: string): void; className?: string }) {
  const list = MODELS.includes(value) ? MODELS : [value, ...MODELS];
  return (
    <select className={className ?? 'bb-select'} value={value} onChange={(e) => onChange(e.target.value)} title="Model for sessions started from the board">
      {list.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}

function RuleRow({ col, rule, onChange }: { col: ColumnId; rule: ColumnRule; onChange(r: ColumnRule): void }) {
  return (
    <div className="bb-rule">
      <span className="bb-rule-col">{COLUMN_LABEL[col]}</span>
      <input className="bb-input bb-input-sm" value={rule.status} placeholder="status to write" onChange={(e) => onChange({ ...rule, status: e.target.value })} />
      <input className="bb-input" value={rule.command} placeholder="command (empty = status only)" onChange={(e) => onChange({ ...rule, command: e.target.value })} />
      <label className="bb-check" title="Always ask, even with 'don't ask'">
        <input type="checkbox" checked={Boolean(rule.forceConfirm)} onChange={(e) => onChange({ ...rule, forceConfirm: e.target.checked })} /> ask
      </label>
    </div>
  );
}

export function SettingsDialog({ settings, version, onSave, onClose }: {
  settings: BoardSettings;
  version: BmadVersion;
  onSave(s: BoardSettings): void;
  onClose(): void;
}) {
  const [s, setS] = useState<BoardSettings>(settings);
  const patch = (p: Partial<BoardSettings>) => setS((cur) => ({ ...cur, ...p }));
  const v7 = version === 'v7';
  const cols = v7 ? COLUMNS_V7 : COLUMNS_V6;
  const rules = v7 ? s.rulesV7 : s.rulesV6;
  const setRule = (col: ColumnId, r: ColumnRule) => patch(v7 ? { rulesV7: { ...s.rulesV7, [col]: r } } : { rulesV6: { ...s.rulesV6, [col]: r } });
  const setAction = (i: number, a: ContextAction) => patch({ actions: s.actions.map((x, j) => (j === i ? a : x)) });

  return (
    <div className="bb-modal-backdrop" onMouseDown={onClose}>
      <div className="bb-modal bb-modal-wide" role="dialog" aria-label="BMAD Board settings" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="bb-settings-scroll">
          <h3>Sessions</h3>
          <div className="bb-form">
            <label>Model <ModelSelect value={s.model} onChange={(model) => patch({ model })} /></label>
            <label>Effort
              <select className="bb-select" value={s.effort} onChange={(e) => patch({ effort: e.target.value })}>
                {EFFORTS.map((x) => <option key={x} value={x}>{x || 'default'}</option>)}
              </select>
            </label>
            <label className="bb-check"><input type="checkbox" checked={s.dontAsk} onChange={(e) => patch({ dontAsk: e.target.checked })} /> Don't ask before starting a command</label>
            <label className="bb-check"><input type="checkbox" checked={s.writeStatusBeforeRun} onChange={(e) => patch({ writeStatusBeforeRun: e.target.checked })} /> Write the status before launching the command</label>
            <label className="bb-check"><input type="checkbox" checked={s.showDropped} onChange={(e) => patch({ showDropped: e.target.checked })} /> Show dropped stories (v7)</label>
            <label>Poll every (ms)
              <input className="bb-input bb-input-sm" type="number" min={1000} step={500} value={s.pollMs} onChange={(e) => patch({ pollMs: Math.max(1000, Number(e.target.value) || DEFAULT_SETTINGS.pollMs) })} />
            </label>
          </div>

          <h3>Drop on a column ({version === 'none' ? 'v6' : version})</h3>
          <p className="bb-muted">Placeholders: {'{key} {ref} {epic} {file} {title}'}</p>
          {cols.map((c) => (
            <RuleRow key={c} col={c} rule={rules[c] ?? { status: '', command: '' }} onChange={(r) => setRule(c, r)} />
          ))}

          <h3>Right-click menu</h3>
          {s.actions.map((a, i) => (
            <div key={a.id + i} className="bb-rule">
              <input className="bb-input bb-input-sm" value={a.label} onChange={(e) => setAction(i, { ...a, label: e.target.value })} />
              <select className="bb-select" value={a.scope} onChange={(e) => setAction(i, { ...a, scope: e.target.value as ContextAction['scope'] })}>
                <option value="story">story</option>
                <option value="epic">epic</option>
              </select>
              <input className="bb-input" value={a.v6 ?? ''} placeholder="v6 command" onChange={(e) => setAction(i, { ...a, v6: e.target.value || undefined })} />
              <input className="bb-input" value={a.v7 ?? ''} placeholder="v7 command" onChange={(e) => setAction(i, { ...a, v7: e.target.value || undefined })} />
              <button className="bb-btn" onClick={() => patch({ actions: s.actions.filter((_, j) => j !== i) })} aria-label="Remove">✕</button>
            </div>
          ))}
          <button className="bb-btn" onClick={() => patch({ actions: [...s.actions, { id: `custom-${Date.now()}`, label: 'New action', scope: 'story', v6: '', v7: '' }] })}>+ Add action</button>

          <h3>Banner prompts</h3>
          <div className="bb-form">
            <label>Migrate (v6 → v7) <textarea className="bb-input" rows={2} value={s.migratePrompt} onChange={(e) => patch({ migratePrompt: e.target.value })} /></label>
            <label>Start planning <input className="bb-input" value={s.planPrompt} onChange={(e) => patch({ planPrompt: e.target.value })} /></label>
          </div>
        </div>
        <div className="bb-modal-actions">
          <button className="bb-btn" onClick={() => setS({ ...DEFAULT_SETTINGS })}>Reset to defaults</button>
          <span className="bb-spacer" />
          <button className="bb-btn" onClick={onClose}>Cancel</button>
          <button className="bb-btn bb-btn-primary" onClick={() => { onSave(s); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
