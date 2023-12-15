import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os';
import * as Backup from './backup.mjs'
import * as Directory from './directory.mjs'
import * as File from './file.mjs'


describe('immutable-backups/backup', async()=>{

    it('really lock and unlock a full backup', async()=>{
        const tmp = await fs.mkdtemp(path.join(tmpdir(), 'immutable-backups-tests'))
        await Promise.all([
            fs.writeFile(`${tmp}/full.json`, JSON.stringify({ mode: "full", jobId: 1 , xva: 'xva.xva'})),
            fs.writeFile(`${tmp}/xva.xva`, 'XVA FILE'),
            fs.writeFile(`${tmp}/xva.xva.checksum`, 'XVA CHEKSUM FILE'),
            fs.writeFile(`${tmp}/fullWithoutChecksum.json`, JSON.stringify({ mode: "full", jobId: 1 , xva: 'xva2.xva'})),
            fs.writeFile(`${tmp}/xva2.xva`, 'XVA FILE'), 
        ])


        await Backup.makeImmutable({ mode: "full", jobId: 1 , xva: 'xva.xva', _filename:`${tmp}/full.json`,})

        assert.equal(File.isImmutable(`${tmp}/full.json`), true)
        assert.equal(File.isImmutable(`${tmp}/xva.xva`), true)
        assert.equal(File.isImmutable(`${tmp}/xva.xva.checksum`), true)

        assert.equal(File.isImmutable(`${tmp}/fullWithoutChecksum.json`), false)
        assert.equal(File.isImmutable(`${tmp}/xva2.xva`), false)


        await Backup.makeImmutable({ mode: "full", jobId: 1 , xva: 'xva.xva', _filename:`${tmp}/fullWithoutChecksum.json`})

        assert.equal(File.isImmutable(`${tmp}/fullWithoutChecksum.json`), true)
        assert.equal(File.isImmutable(`${tmp}/xva2.xva`), true)


        await Backup.liftImmutability({ mode: "full", jobId: 1 , xva: 'xva.xva', _filename:`${tmp}/fullWithoutChecksum.json`})

        assert.equal(File.isImmutable(`${tmp}/fullWithoutChecksum.json`), false)
        assert.equal(File.isImmutable(`${tmp}/xva2.xva`), false)
        assert.equal(File.isImmutable(`${tmp}/full.json`), true)
        assert.equal(File.isImmutable(`${tmp}/xva.xva`), true)
        assert.equal(File.isImmutable(`${tmp}/xva.xva.checksum`), true)

        await Backup.liftImmutability({ mode: "full", jobId: 1 , xva: 'xva.xva', _filename:`${tmp}/fullWithoutChecksum.json`})

        assert.equal(File.isImmutable(`${tmp}/fullWithoutChecksum.json`), false)
        assert.equal(File.isImmutable(`${tmp}/xva2.xva`), false)
        assert.equal(File.isImmutable(`${tmp}/full.json`), false)
        assert.equal(File.isImmutable(`${tmp}/xva.xva`), false)
        assert.equal(File.isImmutable(`${tmp}/xva.xva.checksum`), false)
        await Directory.liftImmutability(tmp)
        await rimraf(tmp)
    
    })
    it('really lock an incremental backup', async()=>{
    
    })
    it('really detect full/incremental', async()=>{
    
    })
    it('really detect key/delta in incremental', async()=>{
    
    })
})