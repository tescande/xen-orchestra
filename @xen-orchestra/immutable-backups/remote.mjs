import fs from 'node:fs/promises' 
import * as Vm from './vm.mjs'
import * as File from './file.mjs'
import path from 'node:path'
import  { createLogger } from '@xen-orchestra/log'

const { warn } = createLogger('xen-orchestra:immutable-backups:remote')

async function test(remote){

    await fs.readdir(remote)

    const testPath = path.join(remote, '.test-immut')
    // cleanup
    try{
        await File.liftImmutability(testPath)
        await fs.unlink(testPath)
    } catch(err){}
    // can create , modify and delete a file 
    await fs.writeFile(testPath,`test immut ${new Date()}`)
    await fs.writeFile(testPath,`test immut change 1 ${new Date()}`)
    await fs.unlink(testPath)

    // cannot modify or delete an immutable file 
    await fs.writeFile(testPath,`test immut ${new Date()}`)
    await File.makeImmutable(testPath)
    try{
        await fs.writeFile(testPath,`test immut change 2  ${new Date()}`)
        await fs.unlink(testPath)
        throw new Error(`breach of contract : succeed in modifying and deleteing an immutable file`)
    }catch(error){
        if(error.code !== 'EPERM'){
            throw error
        }
    }
    // can modify and delete a file after lifting immutability
    await File.liftImmutability(testPath) 
    await fs.writeFile(testPath,`test immut change 3 ${new Date()}`)
    await fs.unlink(testPath)
}





async function watchForNewVm(vmPath){
    // watch new VM 
    try{

        const watcher = fs.watch(vmPath);
        for await (const {filename} of watcher){
            if(filename.endsWith('.lock')){
                console.log(filename, ' is lock dir, skip')
                continue 
            }
            // @todo : should only watch unwatched VM
            Vm.watch(path.join(vmPath, filename))
                .catch(()=>{})
        } 
    }catch(err){
        console.warn(err)
        // must not throw and stop the script
        // throw err;
        if(err.code !== 'ENOENT'){
            // relaunch watcher on error
            Vm.watch(vmPath)
        }

    }
}

async function liftImmutability(remoteRootPath, immutabilityDuration){
    const vmPath = path.join(remoteRootPath, 'xo-vm-backups')
    const vms = await fs.readdir(vmPath)
    console.log({vms})
    for(const vm of vms){
        console.log('watch ', vm)
        Vm.liftImmutability(path.join(vmPath, vm), immutabilityDuration)
    }

    // @todo : should also lift pool/xo  backups
}

export async function watchRemote(remoteRootPath, immutabilityDuration){

    await test()

    // add duration and watch status in the metadata.json of the remote 
    await fs.writeFile(path.join(remoteRootPath,'immutable.json', JSON.stringify({
        since: + new Date(),
        immutable: true,
        duration: immutabilityDuration
    })))
    // watch the remote for any new VM metadata json file
    const vmPath = path.join(remoteRootPath, 'xo-vm-backups')

    watchForNewVm(vmPath)

    // watch existing VM
    // @todo : should also lift pool/xo  backups
    const vms = await fs.readdir(vmPath)
    console.log({vms})
    for(const vm of vms){
        console.log('watch ', vm)
        if(vmPath.endsWith('.lock')){
            console.log(vmPath, ' is lock dir, skip')
            continue 
        }
        Vm.watch(path.join(vmPath, vm))
    }

    setInterval(async ()=>{
        await liftImmutability(remoteRootPath,immutabilityDuration)
    }, 60*60*1000)
}


/**
 * This try to attains the "governance mode" of object locking
 * 
 * What does it protect you against ? 
 *  deletion by user before the end of retention period
 *  
 * 
 * What does it left unprotected
 * 
 *  an user modifying the files during upload 
 *  an user modifying the files after a disk upload , but before the full upload of the backup
 *  bit rot 
 * ====> theses 3 are mitigated by authenticated encryption. Modification will be detected on restore and fail.
 * 
 *  an user with root access to your FS can lift immutability , and access the remote settings containing 
 *  the encryption key 
 * 
 */


watchRemote('/mnt/ssd/vhdblock/')