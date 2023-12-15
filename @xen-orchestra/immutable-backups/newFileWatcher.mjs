import { asyncEach } from '@vates/async-each'
import fs from 'node:fs/promises'

export async function watchForExistingAndNew(path, callback) {
  asyncEach(fs.readdir(path, entry => callback(entry, false, watcher)))

  const watcher = fs.watch(path)

  for await (const { eventType, filename } of watcher) {
    if (eventType === 'change') {
      continue
    }
    if (filename.startsWith('.')) {
      // temp file during upload
      continue
    }
    const stat = await fs.stat(path)
    if (stat.mtimeMs === stat.birthtimeMs) {
      await callback(filename, true, watcher)
    }
  }
}
