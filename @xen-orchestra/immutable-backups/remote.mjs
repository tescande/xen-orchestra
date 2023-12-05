import fs from 'node:fs/promises' 
import * as Backup from './backup.mjs'
import path from 'node:path'
import  { createLogger } from '@xen-orchestra/log'

const { warn } = createLogger('xen-orchestra:immutable-backups:remote')

async function testRemote(remote){
    // check if we have a valid remote path, 
    // check if we can 
    //  create a file
    //  make it immutable
    //  fail to modify it
    //  fail to delete
    //  make it mutable, 
    //  modify it
    //  delete it succesfully
    // same tests on a directory
}


async function watchVmDirectory(vmPath){
    if(vmPath.endsWith('.lock')){
        console.log(vmPath, ' is lock dir, skip')
        return 
    }
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
                console.log('is json')
                const stat = await fs.stat(path.join(vmPath,filename))
                if(stat.ctimeMs === stat.mtimeMs){
                    console.log('just created')
                    // only make immutable unmodified files
                    await Backup.makeImmutable(path.join(vmPath,filename))
                }
            }
        } 
    }
      catch (err) {
        console.warn(err)
        // must not throw and stop the script
        // throw err;
        if(err.code !== 'ENOENT' && err.code !== 'EPERM' /* delete on windows */){
            watchVmDirectory(vmPath)
        }
      }
}


async function watchForNewVm(vmPath){
    // watch new VM 
    try{

        const watcher = fs.watch(vmPath);
        for await (const {filename} of watcher){
            watchVmDirectory(path.join(vmPath, filename))
                .catch(()=>{})
        } 
    }catch(err){
        console.warn(err)
        // must not throw and stop the script
        // throw err;
        if(err.code !== 'ENOENT'){
            // relaunch watcher on error
            watchVmDirectory(vmPath)
        }

    }
}

async function liftImmutability(remote){
    // list all VMs
    // list all backups : ensure we don't create cache files, since they 
    // probably won't be deletable by XO later 
    
    // for each VM 
    //  for each backup
    //      shouldBeimmutable = await Backup.shouldBeImmutable(backup,)
    //      with full hceck : should also check all the disk tree
    //      isImmutable = backup.isImmutable
    //      
    //      if !backup.isImmutable && shouldBeImmutable
    //           log error , this should have been handled by watcher 
    //      if backup.isImmutable && !shouldBeImmutable
    //          lift immutability
}

export async function watchRemote(remoteRootPath, duration, cronLiftImmutability){


    await testRemote()


    // add duration and watch status in the metadata.json of the remote 

    // watch the remote for any new VM metadata json file
    liftImmutability(remoteRootPath).catch(warn)
    const vmPath = path.join(remoteRootPath, 'xo-vm-backups')
    console.log(vmPath)

    watchForNewVm(vmPath).catch(warn)

    // watch existing VM
    const vms = await fs.readdir(vmPath)
    console.log({vms})
    for(const vm of vms){
        console.log('watch ', vm)
        watchVmDirectory(path.join(vmPath, vm))
            .catch(()=>{})
    }
}





/**
 * This try to attain the "governance mode" of object locking
 * 
 * What does it protect you against
 *  deletion by user before the end of retention period
 *  
 * 
 * What does it left unprotected
 * 
 *  an attacker modifying the files during upload 
 *  an attacker modifying the files after a disk upload , but before the full upload of the backup
 *  bit rot 
 * ====> theses 3 are mitigated by encryption. Bit rot can still occurs, but will be detected on restore
 *  an attacker with root access to your FS can lift immutability , and access the remote settings containing 
 *  the encryption key 
 * 
 * this is not enough to have compliance mode immutability
 */


watchRemote('/mnt/ssd/vhdblock/')