import {after, describe, it, before} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { rimraf } from 'rimraf'
import { getBackupChain } from './vm.mjs'



describe('immutable-backups/vm/getBackupChain', async()=>{
    let tmp  
    
    before(async ()=>{
    tmp =  await fs.mkdtemp(path.join(tmpdir(),'immutable-backups-tests'))
    try{

        await Promise.all([
            fs.writeFile(`${tmp}/1.json` , JSON.stringify({mode: "full", jobId:1}) ),
            fs.writeFile(`${tmp}/2.json`, JSON.stringify({mode: "full", jobId:1}) ),
            fs.writeFile(`${tmp}/5.json`, JSON.stringify({mode: "full", jobId:2}) ),
            fs.writeFile(`${tmp}/4.json`, JSON.stringify({mode: "delta", jobId:3, differentialVhds:{1:false}}) ),
            fs.writeFile(`${tmp}/6.json`, JSON.stringify({mode: "delta", jobId:3, differentialVhds:{1:true}}) ),
            fs.writeFile(`${tmp}/7.json`, JSON.stringify({mode: "delta", jobId:3, differentialVhds:{1:true}}) ),
            fs.writeFile(`${tmp}/8.json`, JSON.stringify({mode: "delta", jobId:4, differentialVhds:{1:false}}) ),
            fs.writeFile(`${tmp}/9.json`, JSON.stringify({mode: "delta", jobId:3, differentialVhds:{1:false}}) ),

        ])
    }catch(error){
        console.error(error)
    }
})


    it('build one node chain for full', async ()=>{
        for(const file of [1,2,5]){
            const {ancestors, backup, descendants, ...other} = await getBackupChain(`${tmp}/${file}.json`)
            assert.equal(Object.keys(other).length, 0)
            assert.equal(ancestors, undefined)
            assert.equal(descendants, undefined)
            assert.notEqual(backup, undefined)
        }
    }) 

    it('build a one element chain for an isolated key', async ()=>{
        const {ancestors, backup, descendants, ...other} = await getBackupChain(`${tmp}/8.json`)  
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 0)
        assert.equal(descendants.length, 0)
        assert.notEqual(backup, undefined)
    })

    it('build a one element chain for an childless key', async ()=>{
        const {ancestors, backup, descendants, ...other} = await getBackupChain(`${tmp}/9.json`)  
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 0)
        assert.equal(descendants.length, 0)
        assert.notEqual(backup, undefined)
    })

    
    it('build a the full ancestor chain grand child', async ()=>{
        const {ancestors, backup, descendants, ...other} = await getBackupChain(`${tmp}/7.json`)  
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 2)
        assert.equal(descendants.length, 0)
        assert.notEqual(backup, undefined)
    })

    it('build a the full ancestor chain child ', async ()=>{
        const {ancestors, backup, descendants, ...other} = await getBackupChain(`${tmp}/6.json`)  
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 1)
        assert.equal(descendants.length, 1)
        assert.notEqual(backup, undefined)
    })
    
    it('build a the full ancestor chain child ', async ()=>{
        const {ancestors, backup, descendants, ...other} = await getBackupChain(`${tmp}/4.json`)  
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 0)
        assert.equal(descendants.length, 2)
        assert.notEqual(backup, undefined)
    })

})
/*
describe('immutable-backups/vm', async()=>{

    if('getBackupChain/ only return current for full', async()=>{

    })

    it('canBeMadeImmutable/do not lock modified files', async()=>{
    
    })

    it('canBeMadeImmutable/do not lock older files', async()=>{
    
    })

    it('canBeMadeImmutable/locks full', async()=>{})

    it('canBeMadeImmutable/lock a key backup alone ', async()=>{})
    it('canBeMadeImmutable/lock a delta backup with an immutable key backup ', async()=>{})
    it('canBeMadeImmutable/does not lock a delta backup with an mutable key backup ', async()=>{})
    
    it('canBeMadeImmutable/does not lock a backup with descendants', async()=>{})

    it('canBeMadeImmutable/does lock a chain,even if there is another ancestor mutable chain', ()=>{})
    it('canBeMadeImmutable/does lock a chain,even if there is a mutable chain in another job', ()=>{})
    

    it('liftImmutability/ lift on older full ', async()=>{})
    it('liftImmutability/ does not lift on recent full ', async()=>{})

    it('liftImmutability/ lift on incremental chain ', async()=>{})
    it('liftImmutability/ does not lift on incremental chain if children is recent', async()=>{})

    it('watch new backup',async ()=>{
        // only fire on on created json
    })

})
*/