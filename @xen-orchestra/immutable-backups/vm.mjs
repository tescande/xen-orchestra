import fs from 'node:fs/promises'

import * as File from './file.mjs'
import * as Directory from './directory.mjs'
import { createLogger } from '@xen-orchestra/log'
import { extname, join } from 'node:path'
import { watchForExistingAndNew } from './newFileWatcher.mjs'

const { warn } = createLogger('xen-orchestra:immutable-backups:vm')

const WATCHED_FILE_EXTENSION = ['.json', '.xva', '.checksum']
// xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>/<uuid>.vhd
// xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>/data/<uuid.vhd>/bat|footer|header|blocks
async function waitForVhdDirectoryCompletion(vhdDirectoryPath) {
  const metadataStatus = {
    bat: false,
    footer: false,
    header: false,
  }
  const METADATA_FILES = ['bat', 'footer', 'header']
  await watchForExistingAndNew(vhdDirectoryPath, (pathInDirectory, _, watcher) => {
    if (METADATA_FILES.includes(pathInDirectory)) {
      metadataStatus[pathInDirectory] = true
      if (Object.values(metadataStatus).every(t => t)) {
        watcher.close()
        // will end the watcher, stop this loop and return
      }
    }
  })
}

async function watchVdiData(dataPath, immutabilityCachePath) {
  await watchForExistingAndNew(dataPath, async (pathInDirectory, isNew) => {
    const path = join(dataPath, pathInDirectory)
    if (isNew) {
      // @todo : add timeout
      await waitForVhdDirectoryCompletion(path, immutabilityCachePath)
      await Directory.makeImmutable(path, immutabilityCachePath)
    }
  })
}

async function watchVdi(vdiPath, immutabilityCachePath) {
  await watchForExistingAndNew(vdiPath, async (pathInDirectory, isNew) => {
    const path = join(vdiPath, pathInDirectory)
    if (pathInDirectory === 'data') {
      // vhd directory mode
      watchVdiData(path, immutabilityCachePath).catch(warn)
    } else {
      // alias or real vhd file
      if (isNew) {
        await File.makeImmutable(path, immutabilityCachePath)
      }
    }
  })
}

async function watchJob(jobPath, immutabilityCachePath) {
  await watchForExistingAndNew(jobPath, async jobId => {
    const vdiPath = join(jobPath, jobId)
    const stats = await fs.stat(vdiPath)
    if (stats.isDirectory()) {
      watchVdi(vdiPath, immutabilityCachePath).catch(warn)
    }
  })
}

async function watchVdis(vdisPath, immutabilityCachePath) {
  await watchForExistingAndNew(vdisPath, async jobId => {
    const path = join(vdisPath, jobId)
    const stats = await fs.stat(path)
    if (stats.isDirectory()) {
      watchJob(path, immutabilityCachePath).catch(warn)
    }
  })
}

export async function watch(vmPath, immutabilityCachePath) {
  await watchForExistingAndNew(vmPath, async (pathInDirectory, isNew) => {
    const path = join(vmPath, pathInDirectory)
    if (pathInDirectory === 'vdis') {
      watchVdis(path, immutabilityCachePath).catch(warn)
    } else {
      if (isNew && WATCHED_FILE_EXTENSION.includes(extname(pathInDirectory))) {
        await File.makeImmutable(path)
      }
    }
  })
}
