export const isMetadataFile = filename => filename.endsWith('.json') && !filename.endsWith('.json.noncrypted.json')
export const isVhdFile = filename => filename.endsWith('.vhd')
export const isXvaFile = filename => filename.endsWith('.xva')
export const isXvaSumFile = filename => filename.endsWith('.xva.checksum')
