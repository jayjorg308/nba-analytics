// Standalone vitest config — deliberately decoupled from the app's vite config
// (the domain tests are pure node; no react plugin or DOM needed).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // node by default; component tests opt into jsdom per-file via
    // `// @vitest-environment jsdom` docblocks.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
