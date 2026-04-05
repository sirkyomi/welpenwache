import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}
const appVersion = process.env.APP_VERSION ?? packageJson.version
const gitCommitIdShort = resolveGitCommitIdShort()
const displayVersion = gitCommitIdShort ? `${appVersion}+${gitCommitIdShort}` : appVersion

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(displayVersion),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

function resolveGitCommitIdShort() {
  if (process.env.GIT_COMMIT_ID_SHORT) {
    return process.env.GIT_COMMIT_ID_SHORT.slice(0, 7)
  }

  try {
    return execSync('git rev-parse --short=7 HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return ''
  }
}
