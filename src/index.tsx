/**
 * BMAD Board: panel bundle. All file access and sessions live in the backend
 * module (dist/backend.js); the panel reaches it through `host.callBackendTool`.
 */
import './styles.css';
import { BoardPanel } from './components/BoardPanel';

export { BoardPanel };

export const panels = {
  board: { component: BoardPanel },
};

export async function activate(): Promise<void> {}

export async function deactivate(): Promise<void> {}
