import fs from 'node:fs/promises' 

import * as Backup from './backup.mjs'
import  { createLogger } from '@xen-orchestra/log'
import { dirname, join, resolve } from 'node:path'
const { warn } = createLogger('xen-orchestra:immutable-backups:vm')

const NONCRYPTED_METADATA_SUFFIX = '.noncrypted.json'

export async function canBeMadeImmutable(backupPath){
    try {
    // only unmodified files 
    const stat = await fs.stat(backupPath)
    if(stat.ctimeMs !== stat.mtimeMs){
        return false
    }
    const backupData = await fs.readFile(backupPath)
    const backup = JSON.parse(backupData)
    if(backup.mode === 'full'){
        return true
    }

    const list = {}
    fs.readdir(dirname((backupPath)))
        .filter(filename=> filename.endsWith(NONCRYPTED_METADATA_SUFFIX) )
        .sort()
        .map(file => resolve(dirname(backupPath), file))
        .forEach(file =>{
            if(file.endsWith(NONCRYPTED_METADATA_SUFFIX)){
                const baseName = file.substring(0, file.length -NONCRYPTED_METADATA_SUFFIX.length)
                if(list[baseName] === undefined){
                    warn(`immutable file ${file} is present without backup data`,{file, baseName})
                    return 
                }
                list[baseName] = true
            } else {
                list[file] = false
            }
        }) 
        .reverse()
    const paths = Object.keys(list)
    const mostRecentBackupPath = paths.shift()
    if(mostRecentBackupPath !== backupPath){
        // there are some more recent backup in this folder
        // either the immutale process laggued or it crashed
        // in both case it is unsafe to ignore it 
        throw new Error(`More recent backup than ${backupPath} exists , like ${mostRecentBackupPath }`,{backupData, paths, last: mostRecentBackupPath})
    }

    // a full incremental without child can become immutable 
    if(backup.type === 'full'){
        return true
    }
    
    for(const [path, isImmutable] of Object.entries(list)){
        const backupData = await fs.readFile(path)
        const backup = JSON.parse(backupData)
        if(backup.mode === 'full'){
            // don't care of the past full backup
            continue
        }
        // mutable in the parent chain, can't make any descendant immutable  
        if(isImmutable === false){
            return false
        }
        // that is a key backup of an incremental backup job
        // no need to go back more 
        if(backup.type === 'full'){
            return isImmutable
        }
    }
    // either we found a full, or we check all the backups
    // the older incremental is a always full , even if the metadata says it's not
    // since it have been merged with older full and incremental
    // and the full chain was immutable
    return true

    }catch(error){
        warn(error)
        return false
    }
}


export async function liftImmutability(basePath, immutabiltyDuration){
    const list = {}
    fs.readdir(basePath)
        .filter(filename=> filename.endsWith('.json') )
        .sort()
        .map(file => resolve(basePath, file))
        .forEach(file =>{
            if(file.endsWith(NONCRYPTED_METADATA_SUFFIX)){
                const baseName = file.substring(0, file.length -NONCRYPTED_METADATA_SUFFIX.length)
                if(list[baseName] === undefined){
                    warn(`immutable file ${file} is present without backup data`,{file, baseName})
                    return 
                }
                list[baseName] = true
            } else {
                list[file] = false
            }
        })
        .reverse()
    let chain = []
    for( const [path, isImmutable] of Object.entries(list)){
        if(!isImmutable){
            continue // in theory we could break here
        }
        const backupData = await fs.readFile(path)
        const backup = JSON.parse(backupData)
        const stat = await fs.stat(path) 
        if(backup.mode === 'full'){
            if(new Date() - stat.ctimeMs > immutabiltyDuration){
                await Backup.liftFullBackupImmutability(backup)
            }
            continue
        }

        chain.push({path, stat, backup})
        if(backup.mode === 'full'){
            if(new Date() - stat.ctimeMs > immutabiltyDuration){
                await Promise.all(
                    chain.map(({backup})=>Backup.liftIncrementalBackupImmutability(backup)) 
                )
            } 
            // start a new chain 
            chain =[] 
        }
    }
    // handle the oldest chain 
    await Promise.all(
        chain.map(({backup})=>Backup.liftIncrementalBackupImmutability(backup)) 
    )

}


export async function watch(vmPath){
    console.log('watchVmDirectory', vmPath)
    try {
        const watcher = fs.watch(vmPath);
        for await (const {eventType, filename} of watcher){
            if(eventType === 'change'){
                continue
            }
            if(filename.startsWith('.')){
                // temp file during upload
                continue
            }
            console.log({eventType, filename})
            // ignore modified metadata (merge , became immutable , deleted  )

            if(filename.endsWith('.noncrypted.json')){
                console.log('is non crytped json')
                const metadataPath = join(vmPath,filename)
                const stat = await fs.stat(metadataPath)
                if(stat.ctimeMs === stat.mtimeMs){
                    console.log('just created')
                    if(await canBeMadeImmutable(metadataPath)){
                        await Backup.makeImmutable(metadataPath) 
                    }  
                }
            }
        } 
    }
      catch (err) {
        console.warn(err)
        // must not throw and stop the script
        // throw err;
        if(err.code !== 'ENOENT' && err.code !== 'EPERM' /* delete on windows */){
            watch(vmPath)
        }
      }
}