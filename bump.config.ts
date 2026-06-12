import { defineConfig } from 'bumpp'

export default defineConfig({
  files: [
    'package.json',
    'src/manifest.json',
  ],
  commit: 'chore(release): v%s',
  tag: 'v%s',
  push: true,
})
