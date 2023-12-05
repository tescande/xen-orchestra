import path from 'node:path'
import fs from 'node:fs/promises'
import * as Vhd from './vhd.mjs'
import * as File from './file.mjs'


export async function shouldBeImmutable(backup, immutabiltyDuration){ 
    //  full  => true if backup is younger than immutabiltyDuration
    //  incremental
    //      if  delta 
    //          get parent
    //           ca't make a delta immutable if parent is mutable
    //          return false if parent is not immutable
    //      return true if backup is younger than immutability duration
    //      // can't lift immutability if it means to unprotect a delta that should be protected
    //      return  some(descendants in immutability duration)
    

}

export async function makeImmutable(metdataPath){
    try{
        const metadataDir = path.dirname(metdataPath)
        const metadata = JSON.parse(await fs.readFile(metdataPath))
        if(metadata.xva !== undefined){
            if(metadata.mode !== 'full'){
                throw new Error(`got a backup with a xva path, but mode is not full ${metadata.mode}`)
            }
            console.log('make xva immutable ',path.resolve(metadataDir, metadata.xva))
            await Promise.all([
                File.makeImmutable(path.resolve(metadataDir, metadata.xva)),
                File.makeImmutable(path.resolve(metadataDir, metadata.xva+'.checksum')).catch(console.warn),
            ])
        } else if(metadata.vhds !== undefined){
            if(metadata.mode !== 'delta'){
                throw new Error(`got a backup without a xva path, but mode is not delta ${metadata.mode}`)
            }
            if(metadata.type === 'delta'){
                // get parent  backup
                // can be expected when activating immutability on a remote
                /*if(parentMetada.immutable !== true){
                    warn(`${metdataPath} can't be made immutavle since its parent is not immutable`)
                    return 
                }*/
            }
            await Promise.all(
                Object.values(metadata.vhds).map(vhdRelativePath=>{
                    console.log('make vhd immutable ',path.resolve(metadataDir, vhdRelativePath))
                    return Vhd.makeImmutable(path.resolve(metadataDir, vhdRelativePath))
                })
            )
        } else {
            throw new Error('File is not a metadata')
        }
        console.log('patch metadata')
        // create a medata.json.immutability file, non encrypted
        // that way we won't need the encryption key of the remote 
        // update metadata
        console.log('write metadata')
        await fs.writeFile(metdataPath+'.immutable.json', JSON.stringify({
            since: + new Date(),
            immutable: true, 
            to: null
        }))
        console.log('make metadata immutable')
        await 
        Promise.all([
            File.makeImmutable(metdataPath),
            File.makeImmutable(metdataPath+'.immutable.json')
        ])
        // purge cache
        console.log('snipe cache')
        await fs.unlink(path.resolve(metadataDir, 'cache.json.gz'))

    }catch(err){
        // should we try to undo immutability if we failed to apply it completly
        console.warn(err)
        // rename event is also launched on deletion
        if(err.code !== 'ENOENT'){
            throw err
        }
    }
    
    

}

// will only work if it's a full backup of it doesn't have any delta following
// this will ensure immutability period won't be shorter than set
// BUT it will lead to infinite chain if there is not full backup interval
export async function liftImmutability(){}