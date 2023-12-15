import { join } from 'node:path'
import * as Directory from './file.mjs'
import { watchForExistingAndNew } from './newFileWatcher.mjs'

async function waitForCompletion(path) {
  await watchForExistingAndNew(path, (pathInDirectory, isNew, watcher) => {
    if (!isNew) {
      return
    }
    if (pathInDirectory === 'metadata.json') {
      watcher.close()
      // will end the watcher, stop this loop and return
    }
  })
}

export async function watch(basePath, immutabilityCachePath) {
  await watchForExistingAndNew(basePath, async (pathInDirectory, isNew) => {
    if (!isNew) {
      return
    }
    const path = join(basePath, pathInDirectory)
    await waitForCompletion(path)
    await Directory.makeImmutable(path, immutabilityCachePath)
  })
}
