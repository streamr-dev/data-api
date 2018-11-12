const Int64 = require('node-int64')
const BufferMaker = require('buffermaker')
const BufferReader = require('buffer-reader')

const VERSION = 28 // 0x1C
const VERSION_SIGNED = 29 // 0x1D
const CONTENT_TYPE_JSON = 27 // 0x1B

const SIGNATURE_TYPE_NONE = 0
const SIGNATURE_TYPE_ETH = 1

function ensureBuffer(content) {
    if (Buffer.isBuffer(content)) {
        return content
    } else if (typeof content === 'string') {
        return Buffer.from(content, 'utf8')
    }

    throw new Error(`Unable to convert content to a Buffer! Type is: ${typeof content}`)
}

function hexToBytes(hex) {
    const hexToParse = hex.startsWith('0x') ? hex.substr(2) : hex
    let bytes
    let c
    for (bytes = [], c = 0; c < hexToParse.length; c += 2) {
        bytes.push(parseInt(hexToParse.substr(c, 2), 16))
    }
    return bytes
}

function bytesToHex(bytes) {
    let hex
    let i
    for (hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16))
        hex.push((bytes[i] & 0xF).toString(16))
    }
    return `0x${hex.join('')}`
}

function bytesBuf(buf, byteArray) {
    let newBuf = buf
    let i
    for (i = 0; i < byteArray.length; i++) {
        newBuf = newBuf.UInt8(byteArray[i])
    }
    return newBuf
}

class StreamrBinaryMessage {
    constructor(streamId, streamPartition, timestamp, ttl, contentType, content, signatureType, address, signature) {
        this.version = signatureType ? VERSION_SIGNED : VERSION
        this.streamId = streamId
        this.streamPartition = streamPartition
        this.timestamp = (timestamp instanceof Date ? timestamp.getTime() : timestamp)
        this.ttl = ttl
        this.contentType = contentType
        this.content = ensureBuffer(content)
        this.signatureType = signatureType
        this.address = address
        this.signature = signature
    }

    toBytes() {
        if (this.contentType === CONTENT_TYPE_JSON) {
            return this.toBufferMaker(new BufferMaker()).make()
        }
        throw new Error(`I don't know how to encode content type ${this.contentType}`)
    }

    toBufferMaker(bufferMaker) {
        const streamIdBuf = new BufferMaker().string(this.streamId).make()
        const contentBuf = ensureBuffer(this.content)

        let buf = bufferMaker
        // byte 0: version (1 byte)
            .Int8(this.version)
        // 1: timestamp (8)
            .Int64BE(this.timestamp)
        // 9: ttl (4)
            .Int32BE(this.ttl)
        // 13: streamIdLength (1)
            .UInt8(streamIdBuf.length)
        // 14: streamId (variable length)
            .string(this.streamId)
        // 14 + streamIdLength: streamPartition (1)
            .UInt8(this.streamPartition)
        // 15 + streamIdLength: contentType (1)
            .Int8(this.contentType)
        // 16 + streamIdLength: contentLength (4)
            .Int32BE(contentBuf.length)
        // 20 + streamIdLength: content (variable length)
            .string(contentBuf)
        if (this.version === VERSION_SIGNED) {
            // 20 + streamIdLength + contentLength: signatureType (1)
            buf = buf.Int8(this.signatureType)
            if (this.signatureType === SIGNATURE_TYPE_ETH) {
                // 21 + streamIdLength + contentLength: address (20)
                buf = bytesBuf(buf, hexToBytes(this.address))
                // 41 + streamIdLength + contentLength: signature (65)
                buf = bytesBuf(buf, hexToBytes(this.signature))
            }
        }
        return buf
    }

    getContentBuffer() {
        return this.content
    }

    getContentAsString() {
        return this.getContentBuffer().toString('utf8')
    }

    getContentLength() {
        return this.getContentBuffer().length
    }

    getContentParsed() {
        if (!this.contentParsed) {
            if (this.contentType === 27) {
                // JSON content type
                this.contentParsed = JSON.parse(this.content.toString('utf8'))
            } else {
                throw new Error(`decode: Invalid content type: ${this.contentType}`)
            }
        }

        return this.contentParsed
    }
}

/* static */ StreamrBinaryMessage.CONTENT_TYPE_JSON = CONTENT_TYPE_JSON
/* static */ StreamrBinaryMessage.SIGNATURE_TYPE_NONE = SIGNATURE_TYPE_NONE

/* static */ StreamrBinaryMessage.fromBytes = (buf) => {
    const reader = buf instanceof BufferReader ? buf : new BufferReader(buf)
    const version = reader.nextInt8()

    if (version === VERSION || version === VERSION_SIGNED) {
        this.version = version
        const ts = new Int64(reader.nextBuffer(8)).valueOf()
        const ttl = reader.nextInt32BE()
        const streamIdLength = reader.nextUInt8()
        const streamId = reader.nextString(streamIdLength, 'UTF-8')
        const streamPartition = reader.nextUInt8()
        const contentType = reader.nextInt8()
        const contentLength = reader.nextInt32BE()
        const content = reader.nextBuffer(contentLength)
        let signatureType
        let address
        let signature
        if (version === VERSION_SIGNED) {
            signatureType = reader.nextInt8()
            if (signatureType === SIGNATURE_TYPE_ETH) {
                address = bytesToHex(reader.nextBuffer(20)) // an Ethereum address is 20 bytes.
                signature = bytesToHex(reader.nextBuffer(65)) // an Ethereum signature is 65 bytes.
            } else if (signatureType !== SIGNATURE_TYPE_NONE) {
                throw new Error(`Unknown signature type: ${signatureType}`)
            }
        }
        return new StreamrBinaryMessage(streamId, streamPartition, ts, ttl, contentType, content, signatureType, address, signature)
    }
    throw new Error(`Unknown version: ${version}`)
}

module.exports = StreamrBinaryMessage
