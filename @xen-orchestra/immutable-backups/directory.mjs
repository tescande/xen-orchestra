import execa from 'execa'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { computeCacheFilePath } from './computeCacheFilePath.mjs'

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

export async function makeImmutable(dirPath, immutabilityCachePath) {
  const cacheFileName = computeCacheFilePath(dirPath, immutabilityCachePath, false)
  await fs.writeFile(cacheFileName, dirPath)
  await execa('chattr', ['+i', '-R', dirPath])
  await execa('chattr', ['+i', cacheFileName])
}

export async function liftImmutability(dirPath, immutabilityCachePath) {
  const cacheFileName = computeCacheFilePath(dirPath, immutabilityCachePath, false)
  await execa('chattr', ['-i', cacheFileName])
  await execa('chattr', ['-i', '-R', dirPath])
  await fs.unlink(cacheFileName)
}
