import execa from 'execa'
import fs from 'node:fs/promises'

// this work only on linux like systems
// this could wokr on windwos : https://4sysops.com/archives/set-and-remove-the-read-only-file-attribute-with-powershell/

export async function makeImmutable(path){
    await  execa('chattr', ['+i', path])
}

export async function liftImmutability(path){
    console.log('lift', path)
    return  execa('chattr', ['-i', path])
}

export async function isImmutable(path){
    const {stdout} = await execa('lsattr', [path])
    const [flags] = stdout.split(' ')
    return flags.includes('i')
}
