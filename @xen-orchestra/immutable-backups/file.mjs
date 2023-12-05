import execa from 'execa'

// this work only on linux like systems
// this could wokr on windwos : https://4sysops.com/archives/set-and-remove-the-read-only-file-attribute-with-powershell/

export async function makeImmutable(path){
    return  execa('chattr', ['+i', path])
}

export async function liftImmutability(path){
    return  execa('chattr', ['-i', path])
}
