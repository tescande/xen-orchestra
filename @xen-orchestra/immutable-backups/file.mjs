import execa from 'execa'
import fs from 'node:fs/promises'

// this work only on linux like systems
// this could wokr on windwos : https://4sysops.com/archives/set-and-remove-the-read-only-file-attribute-with-powershell/

export async function makeImmutable(path){
    // make immutable
    // check file has not been modified 
    // if it has been modified before immut => 
    await  execa('chattr', ['+i', path])
    const {mtime, birthtime} = await fs.stat(path)
    if(mtime !== birthtime){
        await liftImmutability(path)
        throw new Error(`fil ${path} has been modified before being immutable`)
    }
}

export async function liftImmutability(path){
    return  execa('chattr', ['-i', path])
}

export async function isImmutable(path){
    throw new Error('not implemented')
}
