import { after, describe, it, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path, { basename } from 'node:path'
import { tmpdir } from 'node:os'
import { rimraf } from 'rimraf'
import { canBeMadeImmutable, getBackupChain, liftImmutability } from './vm.mjs'
import * as Backup from './backup.mjs'
import * as Directory from './directory.mjs'
import * as File from './file.mjs' 

async function touch(path){
    
    const time = new Date();
    await fs.utimes(path, time, time).catch(async function (err) {
        if ('ENOENT' !== err.code) {
            throw err;
        }
        let fh = await fs.open(filename, 'a');
        await fh.close();
    });
}


describe('immutable-backups/vm/getBackupChain', async () => {
    let tmp

    before(async () => {
        tmp = await fs.mkdtemp(path.join(tmpdir(), 'immutable-backups-tests'))
        try {

            await Promise.all([
                fs.writeFile(`${tmp}/1.json`, JSON.stringify({ mode: "full", jobId: 1 })),
                fs.writeFile(`${tmp}/2.json`, JSON.stringify({ mode: "full", jobId: 1 })),
                fs.writeFile(`${tmp}/5.json`, JSON.stringify({ mode: "full", jobId: 2 })),
                fs.writeFile(`${tmp}/4.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: false } })),
                fs.writeFile(`${tmp}/6.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } })),
                fs.writeFile(`${tmp}/7.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } })),
                fs.writeFile(`${tmp}/8.json`, JSON.stringify({ mode: "delta", jobId: 4, differentialVhds: { 1: false } })),
                fs.writeFile(`${tmp}/9.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: false } })),

            ])
        } catch (error) {
            console.error(error)
        }
    })

    after(async () => rimraf(tmp))


    it('build one node chain for full', async () => {
        for (const file of [1, 2, 5]) {
            const { ancestors, backup, descendants, ...other } = await getBackupChain(`${tmp}/${file}.json`)
            assert.equal(Object.keys(other).length, 0)
            assert.equal(ancestors, undefined)
            assert.equal(descendants, undefined)
            assert.notEqual(backup, undefined)
        }
    })

    it('build a one element chain for an isolated key', async () => {
        const { ancestors, backup, descendants, ...other } = await getBackupChain(`${tmp}/8.json`)
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 0)
        assert.equal(descendants.length, 0)
        assert.notEqual(backup, undefined)
    })

    it('build a one element chain for an childless key', async () => {
        const { ancestors, backup, descendants, ...other } = await getBackupChain(`${tmp}/9.json`)
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 0)
        assert.equal(descendants.length, 0)
        assert.notEqual(backup, undefined)
    })


    it('build a the full ancestor chain grand child', async () => {
        const { ancestors, backup, descendants, ...other } = await getBackupChain(`${tmp}/7.json`)
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 2)
        assert.equal(descendants.length, 0)
        assert.notEqual(backup, undefined)
    })

    it('build a the full ancestor chain child ', async () => {
        const { ancestors, backup, descendants, ...other } = await getBackupChain(`${tmp}/6.json`)
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 1)
        assert.equal(descendants.length, 1)
        assert.notEqual(backup, undefined)
    })

    it('build a the full ancestor chain child ', async () => {
        const { ancestors, backup, descendants, ...other } = await getBackupChain(`${tmp}/4.json`)
        assert.equal(Object.keys(other).length, 0)
        assert.equal(ancestors.length, 0)
        assert.equal(descendants.length, 2)
        assert.notEqual(backup, undefined)
    })

})


describe('immutable-backups/vm/canBeMadeImmutable', async () => {
    let tmp

    before(async () => {
        tmp = await fs.mkdtemp(path.join(tmpdir(), 'immutable-backups-tests'))

        //mock.method(File, 'isImmutable', async (path) => parseInt(basename(path)) %2 ===0);
        try {

            await Promise.all([
                fs.writeFile(`${tmp}/01.json`, JSON.stringify({ mode: "full", jobId: 1 })),
                fs.writeFile(`${tmp}/02.json`, JSON.stringify({ mode: "full", jobId: 1 })),
                fs.writeFile(`${tmp}/05.json`, JSON.stringify({ mode: "full", jobId: 2 })),
                fs.writeFile(`${tmp}/04.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: false } })),
                fs.writeFile(`${tmp}/06.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } })),
                fs.writeFile(`${tmp}/07.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } })),
                fs.writeFile(`${tmp}/08.json`, JSON.stringify({ mode: "delta", jobId: 4, differentialVhds: { 1: false } })),
                fs.writeFile(`${tmp}/09.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: false } })),
                fs.writeFile(`${tmp}/10.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } })),

            ])
            await File.makeImmutable(`${tmp}/09.json`)
        } catch (error) {
            console.error(error)
        }
    })
    after(async () => {
        await Directory.liftImmutability(tmp)
        await rimraf(tmp)
    })


    it('one non modified full can be immutable', async () => {
        const canBeImmutable = await canBeMadeImmutable(`${tmp}/01.json`)
        assert.equal(canBeImmutable, true)
    })
    it('one ancestor can not be immutable', async () => {
        await assert.rejects(() => canBeMadeImmutable(`${tmp}/04.json`), { code: 'HAS_DESCENDANTS' })
    })
    it('child can not be immutable if it as descendants', async () => {
        await assert.rejects(() => canBeMadeImmutable(`${tmp}/06.json`), { code: 'HAS_DESCENDANTS' })
    })
    it('grand child can not be immutable if parents re mutable', async () => {
        await assert.rejects(() => canBeMadeImmutable(`${tmp}/07.json`), { code: 'ANCESTOR_IS_MUTABLE' })
    })
    it('can be made mutable if parent is immutable', async () => {
        assert.equal(await canBeMadeImmutable(`${tmp}/10.json`), true)
    })
})


describe('immutable-backups/vm/liftImmutability', async () => {
    let tmp

    before(async () => {
        tmp = await fs.mkdtemp(path.join(tmpdir(), 'immutable-backups-tests'))

        //mock.method(File, 'isImmutable', async (path) => parseInt(basename(path)) %2 ===0);
        try {

            await Promise.all([
                fs.writeFile(`${tmp}/1.xva`, 'I AM A XVA'), 
                fs.writeFile(`${tmp}/1.json`, JSON.stringify({ mode: "full", jobId: 1, xva:'1.xva'})), 
                fs.writeFile(`${tmp}/2.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: false }, vhds: {} })),
                fs.writeFile(`${tmp}/3.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } , vhds: {}})),
                fs.writeFile(`${tmp}/4.json`, JSON.stringify({ mode: "delta", jobId: 3, differentialVhds: { 1: true } , vhds: {}})),
                fs.writeFile(`${tmp}/5.json`, JSON.stringify({ mode: "delta", jobId: 4, differentialVhds: { 1: false }, vhds: {} })),

            ]) 
            await Directory.makeImmutable(tmp) 
        } catch (error) {
            console.error(error)
        }
    })
    after(async () => {
        await Directory.liftImmutability(tmp)
        await rimraf(tmp)
    })

    it('does nothing if files are to recent', async ()=>{
        const files=['1', '2', '3','4', '5'  ]
        await liftImmutability(tmp, ()=> true)
        for(const file of files){
            assert.equal(await File.isImmutable(`${tmp}/${file}.json`), true)
        }
    })


    it('lift if files are old enough', async ()=>{
        const files=['1', '2', '3','4', '5'  ]
        await liftImmutability(tmp, ()=> false)
        for(const file of files){
            console.log(`CHECK if immut is lifted${tmp}/${file}.json`, await File.isImmutable(`${tmp}/${file}.json`))
            assert.equal(await File.isImmutable(`${tmp}/${file}.json`), false)
        }
    })

    it('do not lift the chains with at least one that should still be protected', async ()=>{
        const files=['1', '2', '3','4', '5'  ]
        await liftImmutability(tmp, async path=> {
             
            return basename(path) === '4.json'
        })
        for(const file of files){ 
            // only the chain 2 3 4 will be immutable since 1 file of the chain should stay immutable
            const isImmutable = await File.isImmutable(`${tmp}/${file}.json`)
            const shouldBeImmutable =  ['2','3','4'].includes(file)
            assert.equal(isImmutable,shouldBeImmutable)
        }
    })

})
