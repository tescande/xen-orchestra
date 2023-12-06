

import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os';
import * as Vhd from './vhd.mjs'

describe('immutable-backups/file', async()=>{

    it('lock a vhd file', async()=>{
        const dir = await fs.mkdtemp(path.join(tmpdir(),'immutable-backups-tests'))
        const filePath = path.join( dir, 'test.vhd')
        await fs.writeFile(filePath, 'I am a real vhd, I swear')
        await Vhd.makeImmutable(filePath)
        await assert.rejects(()=>fs.unlink(filePath))
        await Vhd.liftImmutability(filePath)
        await  fs.unlink(filePath)
    })

    it('lock an alias to a vhd directory', async()=>{
        const dir = await fs.mkdtemp(path.join(tmpdir(),'immutable-backups-tests')) 
        const filePath = path.join( dir, 'test.alias.vhd')
        const vhdDir = path.join( dir, 'data.vhd')
        await fs.mkdir(vhdDir)
        await fs.writeFile(filePath, './data.vhd')
        await Vhd.makeImmutable(filePath)
        await assert.rejects(()=>fs.unlink(filePath))
        await assert.rejects(()=>fs.writeFile(path.join(vhdDir, 'test')))
        await Vhd.liftImmutability(filePath)
        await fs.writeFile(path.join(vhdDir, 'test'), 'data')
        await fs.unlink(path.join(vhdDir, 'test'))
        await fs.unlink(filePath) 
        await fs.rmdir(vhdDir) 
        
    })

    it('handle gracefully incorrect alias ', async()=>{
        const dir = await fs.mkdtemp(path.join(tmpdir(),'immutable-backups-tests')) 
        const filePath = path.join( dir, 'test.alias.vhd')
        const vhdDir = path.join( dir, 'data.vhd')
        await fs.mkdir(vhdDir)
        await fs.writeFile(filePath, Buffer.alloc(2000))
        await assert.rejects(()=>Vhd.makeImmutable(filePath))

        await fs.writeFile(filePath, 'another.alias.vhd')
        await assert.rejects(()=>Vhd.makeImmutable(filePath))
        
    })

    it('handle relative path ', async()=>{
        const dir = await fs.mkdtemp(path.join(tmpdir(),'immutable-backups-tests')) 
        process.chdir(dir)
        const filePath =  './test.alias.vhd'
        const vhdDir = './data.vhd'
        await fs.mkdir(vhdDir)
        await fs.writeFile(filePath, './data.vhd')
        await Vhd.makeImmutable(filePath)
        await assert.rejects(()=>fs.unlink(filePath))
        await assert.rejects(()=>fs.writeFile(path.join(vhdDir, 'test')))
        await Vhd.liftImmutability(filePath)
        await fs.writeFile(path.join(vhdDir, 'test'), 'data')
        await fs.unlink(path.join(vhdDir, 'test'))
        await fs.unlink(filePath) 
        await fs.rmdir(vhdDir) 
        
    })
})