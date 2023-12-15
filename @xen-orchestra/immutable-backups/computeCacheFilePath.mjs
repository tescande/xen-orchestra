import { basename } from 'node:path'
import { sha256 } from './directory.mjs'

export function computeCacheFilePath(path, immutabilityCachePath, isFile) {
  return path.join(immutabilityCachePath, `${sha256(path)}.${isFile ? 'file' : 'dir'}.${basename(path)}`)
}
