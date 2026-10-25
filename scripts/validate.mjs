// Validates the built extension the way Nimbalyst does on load.
// Imports the SDK's validator by file path: the package root also pulls in
// editor code that needs the host's @nimbalyst/runtime, which only exists inside the app.
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mod = await import(pathToFileURL(resolve(root, 'node_modules', '@nimbalyst', 'extension-sdk', 'dist', 'validate.js')).href);
const result = await mod.validateExtensionBundle(resolve(root, 'dist'));
mod.printValidationResult(result);
process.exit(result.valid ? 0 : 1);
