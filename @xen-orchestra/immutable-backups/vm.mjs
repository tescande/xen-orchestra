import fs from 'node:fs/promises' 

import * as Backup from './backup.mjs'
import * as File from './file.mjs'
import  { createLogger } from '@xen-orchestra/log'
import { basename, dirname, join, resolve } from 'node:path'

const { warn } = createLogger('xen-orchestra:immutable-backups:vm')

 
export async function getBackupChain(backupPath){
    const backupData = await fs.readFile(backupPath, 'utf-8')
    const backup = JSON.parse(backupData)
    backup._filename = backupPath
    
    if(Backup.isFullBackup(backup)){
        return{backup}
    }

    const paths = (await fs.readdir(dirname((backupPath))))
        // only backup meytadata, no cache, or folder
        .filter(filename=> filename.endsWith('.json'))
        // sorted by newest first 
        .sort()
        .reverse()
        // absolute path
        .map(file => resolve(dirname(backupPath), file))
    
    let ancestors = []
    let descendants = [] 
    let foundTarget = false
    for(const path of paths){
        if(basename(path) === basename(backupPath)){
            foundTarget = true
            if(Backup.isKeyBackup(backup)){
                break
            }
            continue
        }
        const backupData = await fs.readFile(path, 'utf-8')
        const otherBackup = JSON.parse(backupData)
        otherBackup._filename = path
        if(otherBackup.jobId !== backup.jobId){
            continue
        }

        if(foundTarget){
            ancestors.push(otherBackup)
            if(Backup.isKeyBackup(otherBackup)){
                break
            } 
        } else {
            if(Backup.isKeyBackup(otherBackup)){
                descendants = []
            } else {
                descendants.push(otherBackup)
            }
        }
    }
    return {ancestors, backup, descendants}
}


export async function canBeMadeImmutable(backupPath){
    // only unmodified files 
    const stat = await fs.stat(backupPath)

    const {ancestors, backup, descendants} = await  getBackupChain(backupPath)
    if(Backup.isFullBackup(backup)){
        return true
    }

    if(descendants.length > 0 ){
        const error = new Error(`file ${backupPath} is not the most recent backup of its job`)
        error.code = 'HAS_DESCENDANTS'
        throw error 
    }

    if(Backup.isKeyBackup(backup)){
        return true
    }

    let ancestorBackup
    while(ancestorBackup = ancestors.pop()){
        if(!await Backup.isImmutable(ancestorBackup)){ 
            const error = new Error(`ancestor ${ancestorBackup._fileName} of  ${backupPath} is mutable`)
            error.code = 'ANCESTOR_IS_MUTABLE'
            throw error    
        }
        if(Backup.isKeyBackup(ancestorBackup)){
            return true
        }
    }
 
    throw new ErrorEvent(`How can we have a differential backup without any ancestor  key backup ${backupPath}`)
}

/**
 * 
 * @param {*} basePath 
 * @param {*} async isStillInImmutabilityPeriod(path) => true| false
 */

export async function liftImmutability(basePath, isStillInImmutabilityPeriod){

    
    // list all files olders than immutabiltyDuration
    // check them from the older one to the more recent one 

    const backupPaths = (await fs.readdir(basePath))
        .filter(filename=> filename.endsWith('.json') )
        .map(file => resolve(basePath, file))
        .sort()
 

    backupPaths.sort()
    for(const path of backupPaths){
        // already mutable
        if(!await File.isImmutable(path)){
            continue
        } 
        if(await isStillInImmutabilityPeriod(path)){
            continue
        }

        // this may lead to reading multiple times the backups chains
        // but immutability will  only be lifted
        // when handling the most recent one of an incrementaljob
        const {ancestors, backup, descendants} = await getBackupChain(path)
        // can't lift immutability id descendants should still be protected
        if(descendants?.length > 0 ){
            continue
        }
        // make the full chain mutable
        await Promise.all([
            Backup.liftImmutability(backup), 
            ...(ancestors??[]).map(async ancestor => Backup.liftImmutability(ancestor))
        ])
    }


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

            if(filename.endsWith('.json')){
                const metadataPath = join(vmPath,filename)
                try{
                    const stat = await fs.stat(metadataPath)
                    if(stat.ctimeMs === stat.mtimeMs){
                        console.log('just created')
                    if(await canBeMadeImmutable(metadataPath)){
                        await Backup.makeImmutable(metadataPath) 
                    }  
                }
                }catch(err){
                    warn(err)
                }
            }
        } 
    }
      catch (err) {
        console.warn(err)
        // must not throw and stop the script
        // throw err;
        //if(err.code !== 'ENOENT' && err.code !== 'EPERM' /* delete on windows */){
            watch(vmPath)
        //}
      }
}
