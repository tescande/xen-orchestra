
import { strictEqual } from 'node:assert'
import assert from 'node:assert'
import { VhdAbstract} from 'vhd-lib'
import { createFooter, createHeader } from 'vhd-lib/_createFooterHeader.js'
import _computeGeometryForSize from 'vhd-lib/_computeGeometryForSize.js'
import { DISK_TYPES, FOOTER_SIZE } from 'vhd-lib/_constants.js'
import { unpackFooter, unpackHeader } from 'vhd-lib/Vhd/_utils.js'
import { readChunk } from '@vates/read-chunk'




export class VhdCowd extends VhdAbstract{
  #esxi
  #datastore
  #parentFileName
  #path

  #header
  #footer

  #grainDirectory

  static async open(esxi, datastore, path) {
    const vhd = new VhdCowd(esxi, datastore, path)
    await vhd.readHeaderAndFooter()
    return vhd
  }
  constructor(esxi, datastore, path, parentFileName){
    super()
    this.#esxi = esxi
    this.#path = path
    this.#datastore = datastore
    this.#parentFileName = parentFileName
  }

  get header() {
    return this.#header
  }

  get footer() {
    return this.#footer
  }

  containsBlock(blockId) {
    assert.notEqual(this.#grainDirectory, undefined)
    // only check if a grain table exist for on of the sector of the block
    // the great news is that a grain size has 4096 entries of 512B = 2M
    // and a vhd block is also 2M
    // so we only need to check if a grain table exists (it's not created without data)
    return this.#grainDirectory.readInt32LE(blockId * 4 ) !== 0

  }

  async #read(start, end){
    return (await this.#esxi.download(this.#datastore, this.#path, `${start}-${end}`)).buffer()
  }

  async #readMultiple(ranges){
    let range = ranges.map(([start, end])=> `${start}-${end}`).join(',')
    return (await this.#esxi.download(this.#datastore, this.#path, range)).buffer()
  }

  async readHeaderAndFooter(checkSecondFooter = true) {

    const buffer = await this.#read(0, 2048)

    assert.strictEqual(buffer.slice(0,4).toString('ascii'),'COWD')
    assert.strictEqual(buffer.readInt32LE(4), 1) // version
    assert.strictEqual(buffer.readInt32LE(8), 3) // flags
    const sectorCapacity = buffer.readInt32LE(12)
    // const sectorGrainNumber = buffer.readInt32LE(16)
    assert.strictEqual(buffer.readInt32LE(20), 4) // grain directory position in sectors

    // const nbGrainDirectoryEntries = buffer.readInt32LE(24)
    // const nextFreeSector = buffer.readInt32LE(28)
    const size = sectorCapacity * 512
    // a grain directory entry represent a grain table
    // a grain table can adresse, at most 4096 grain of 512 B
    this.#header = unpackHeader(createHeader(Math.ceil(size / (4096 * 512 ))))
    this.#header.parentUnicodeName = this.#parentFileName
    const geometry = _computeGeometryForSize(size)
    const actualSize = geometry.actualSize
    this.#footer =  unpackFooter(createFooter(actualSize, Math.floor(Date.now() / 1000), geometry, FOOTER_SIZE, this.#parentFileName ? DISK_TYPES.DIFFERENCING : DISK_TYPES.DYNAMIC))

  }

  async readBlockAllocationTable() {
    const nbBlocks = this.header.maxTableEntries
    this.#grainDirectory = await this.#read(2048, 2048+nbBlocks*4 -1)
  }

  async readBlock(blockId){
    const sectorOffset = this.#grainDirectory.readInt32LE( blockId * 4)
    if(sectorOffset === 1){
      return Promise.resolve(Buffer.alloc(4096 * 512, 0))
    }
    const offset=  sectorOffset * 512

    const graintable = await this.#read(offset, offset + 2048 - 1)

    const buf = Buffer.concat([
      Buffer.alloc(512, 255), // vhd block bitmap,
      Buffer.alloc(512*4096, 0 ) // empty data
    ])

    // we have no guaranty that data are order or contiguous
    // let's construct ranges to limit the number of queries

    const fileOffsetToIndexInGrainTable = {}
    let nbNonEmptyGrain = 0
    for(let i=0;i < graintable.length / 4 ;i++){
      const grainOffset = graintable.readInt32LE( i * 4)
      if(grainOffset !==0){
        // non empty grain
        fileOffsetToIndexInGrainTable[grainOffset] = i
        nbNonEmptyGrain++
      }
    }
    // grain table exists but only contains empty grains
    if(nbNonEmptyGrain ===0){
      return {
        id: blockId,
        bitmap: buf.slice(0, this.bitmapSize),
        data: buf.slice(this.bitmapSize),
        buffer: buf,
      }
    }

    const offsets = Object.keys(fileOffsetToIndexInGrainTable).map(offset=>parseInt(offset))
    offsets.sort((a,b) => a-b)
    let startOffset = offsets[0]

    const ranges = []
    const OVERPROVISION = 3
    for(let i=1; i < offsets.length; i ++){
      if(offsets[i-1] + OVERPROVISION < offsets[i]){
        ranges.push({startOffset, endOffset: offsets[i-1]})
        startOffset = offsets[i]
      }
    }

    ranges.push({startOffset, endOffset: offsets[offsets.length-1]})

    for(const {startOffset, endOffset} of ranges){
      const startIndex = fileOffsetToIndexInGrainTable[startOffset]
      const startInBlock = startIndex * 512 + 512 /* block bitmap */
      const sectors =  await this.#read(startOffset*512,endOffset*512 - 1)
      // @todo : if overprovision > 1 , it may copy random data from the vmdk
      sectors.copy(buf,startInBlock)

    }
    return {
      id: blockId,
      bitmap: buf.slice(0, 512),
      data: buf.slice(512),
      buffer: buf,
    }
  }

}




// this file contains the disk metadata
export function parseDescriptor(text){
  const descriptorText = text.toString('ascii').replace(/\x00+$/, '') // eslint-disable-line no-control-regex
  strictEqual(descriptorText.substr(0,21), '# Disk DescriptorFile')
  const descriptorDict = {}
  const extentList = []
  const lines = descriptorText.split(/\r?\n/).filter(line => {
    return line.trim().length > 0 && line[0] !== '#'
  })
  for (const line of lines) {
    const defLine = line.split('=')
    // the wonky quote test is to avoid having an equal sign in the name of an extent
    if (defLine.length === 2 && defLine[0].indexOf('"') === -1) {
      descriptorDict[defLine[0].toLowerCase()] = defLine[1].replace(/['"]+/g, '')
    } else {
      const [_, access, sizeSectors, type, name, offset] = line.match(/([A-Z]+) ([0-9]+) ([A-Z]+) "(.*)" ?(.*)$/)
      extentList.push({access, sizeSectors, type, name, offset})
    }
  }
  strictEqual(extentList.length, 1, 'only one extent per vmdk is supported')
  return { ... descriptorDict, extent: extentList[0]}

}

// https://github.com/libyal/libvmdk/blob/main/documentation/VMWare%20Virtual%20Disk%20Format%20(VMDK).asciidoc#5-the-cowd-sparse-extent-data-file
// vmdk file can be only a descriptor, or a
export default function parseVmdk(raw){
  strictEqual(typeof raw, 'string')

  const descriptor = parseDescriptor(raw)
  const isFull = !descriptor.parentfilenamehint
  return {
    capacity: descriptor.extent.sizeSectors * 512,
    isFull,
    uid: descriptor.cid,
    fileName: descriptor.extent.name,
    parentId: descriptor.parentcid,
    parentFileName: descriptor.parentfilenamehint,
    vmdFormat: descriptor.extent.type,
    nameLabel: descriptor.extent.name
  }
}
