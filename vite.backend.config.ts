import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

// Backend module -> dist/backend.js. Runs in an Electron utility process (Node),
// so pure-JS deps (smol-toml) are bundled; node builtins stay external.
export default defineConfig({
  mode: 'production',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/backend.ts'),
      formats: ['es'],
      fileName: () => 'backend.js',
    },
    rollupOptions: {
      external: [/^node:/, ...builtinModules, /^@nimbalyst\//],
      output: { inlineDynamicImports: true },
    },
    target: 'node18',
    outDir: 'dist',
    emptyOutDir: false, // the panel build writes index.js here too
    sourcemap: true,
    minify: false,
  },
});
