import path, { dirname } from 'node:path'
import fs from 'node:fs/promises'
import * as Vhd from './vhd.mjs'
import * as File from './file.mjs'
import  { createLogger } from '@xen-orchestra/log'

const { warn } = createLogger('xen-orchestra:immutable-backups:backup')

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
            immutable: true
        }))
        console.log('make metadata immutable')
        await Promise.all([
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


export async function liftFullBackupImmutability(metadataPath, backup){ 
    const metadataDir = dirname(metadataPath)
    console.log('make full backup mutable ',path.resolve(metadataDir, backup.xva))
    await Promise.all([
        File.liftImmutability(path.resolve(metadataDir, backup.xva)),
        File.liftImmutability(path.resolve(metadataDir, backup.xva+'.checksum')).catch(console.warn),
        File.makeImmutable(metadataPath),
        File.makeImmutable(metadataPath+'.immutable.json')
    ]) 
    await fs.unlink(metadataPath+'.immutable.json')
    await fs.unlink(path.resolve(dirname(metadataDir), 'cache.json.gz'))

}

export async function liftIncrementalBackupImmutability(metadataPath,backup){
    const metadataDir = dirname(metadataPath)
    await Promise.all(
        Object.values(backup.vhds).map(vhdRelativePath=>{
            console.log('make vhd mutable ',path.resolve(metadataDir, vhdRelativePath))
            return Vhd.liftImmutability(path.resolve(metadataDir, vhdRelativePath))
        })
    )
    await File.liftImmutability(metadataPath)
    await File.liftImmutability(metadataPath+'.immutable.json')
    await fs.unlink(metadataPath+'.immutable.json')
    await fs.unlink(path.resolve(dirname(metadataDir), 'cache.json.gz'))
}