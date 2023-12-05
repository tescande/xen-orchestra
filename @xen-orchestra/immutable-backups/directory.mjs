import execa from 'execa'
export async function makeImmutable(path){
    return  execa('chattr', ['+i', '-R', path])
}

export async function liftImmutability(path){
    return  execa('chattr', ['-i','-R', path])
}