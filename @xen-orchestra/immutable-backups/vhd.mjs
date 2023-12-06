import * as File from './file.mjs'
import * as Directory from './directory.mjs'
import  { dirname, resolve } from 'path'
import fs from 'node:fs/promises'


const ALIAS_MAX_PATH_LENGTH = 1024
const resolveRelativeFromFile = (file, path) => {
  if (file.startsWith('/')) {
    return resolve(dirname(file), path)
  }
  return resolve('/', dirname(file), path).slice(1)
}
function isVhdAlias(filename) {
    return filename.endsWith('.alias.vhd')
  }

 async function resolveVhdAlias(filename) {
    const {size} = await fs.stat(filename)
    if (size > ALIAS_MAX_PATH_LENGTH) {
    // seems reasonnable for a relative path
    throw new Error(`The alias file ${filename} is too big (${size} bytes)`)
    } 
  
    const aliasContent = (await fs.readFile(filename)).toString().trim()
    // also handle circular references and unreasonnably long chains
    if (isVhdAlias(aliasContent)) {
      throw new Error(`Chaining alias is forbidden ${filename} to ${aliasContent}`)
    }
    // the target is relative to the alias location
    return resolveRelativeFromFile(filename, aliasContent)
  }
  
export async function makeImmutable(vhdPath){
    if(vhdPath.endsWith('.alias.vhd')){
        const targetVhd = await resolveVhdAlias(vhdPath)
        await Directory.makeImmutable(targetVhd)
    }
    await File.makeImmutable(vhdPath)
    // also make the target immutable
}

export async function liftImmutability(vhdPath){
    if(vhdPath.endsWith('.alias.vhd')){
        const targetVhd = await resolveVhdAlias(vhdPath)
        await Directory.liftImmutability(targetVhd)
    }
    await File.liftImmutability(vhdPath)
    // also make the target immutable
}