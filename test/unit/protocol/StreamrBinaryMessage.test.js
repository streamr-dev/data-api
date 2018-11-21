/* eslint-disable no-new */
const assert = require('assert')
const sinon = require('sinon')
const StreamrBinaryMessage = require('../../../src/protocol/StreamrBinaryMessage')
const StreamrBinaryMessageV28 = require('../../../src/protocol/StreamrBinaryMessageV28')
const StreamrBinaryMessageV29 = require('../../../src/protocol/StreamrBinaryMessageV29')
const StreamrBinaryMessageFactory = require('../../../src/protocol/StreamrBinaryMessageFactory')

describe('StreamrBinaryMessage', () => {
    let version
    const streamId = 'streamId'
    const streamPartition = 0
    const msg = {
        foo: 'bar',
    }
    const timestamp = Date.now()
    const ttl = 100

    describe('version 28', () => {
        let bytes

        beforeEach(() => {
            version = 28
            bytes = new StreamrBinaryMessageV28(
                streamId, streamPartition, timestamp, ttl,
                StreamrBinaryMessage.CONTENT_TYPE_JSON, Buffer.from(JSON.stringify(msg), 'utf8'),
            ).toBytes()
        })

        describe('toBytes/fromBytes', () => {
            it('must not alter the field content', () => {
                const m = StreamrBinaryMessageFactory.fromBytes(bytes)

                assert.equal(m.version, version)
                assert.equal(m.streamId, streamId)
                assert.equal(m.streamPartition, streamPartition)
                assert.equal(m.timestamp, timestamp)
                assert.equal(m.ttl, ttl)
                assert.equal(m.contentType, StreamrBinaryMessage.CONTENT_TYPE_JSON)
                assert.deepEqual(m.getContentParsed(), msg)
            })

            describe('with sinon spys on JSON object', () => {
                beforeEach(() => {
                    sinon.spy(JSON, 'parse')
                    sinon.spy(JSON, 'stringify')
                })

                afterEach(() => {
                    JSON.parse.restore()
                    JSON.stringify.restore()
                })

                it('must not parse the content with contentAsBuffer=true', () => {
                    const m = StreamrBinaryMessageFactory.fromBytes(bytes, true)

                    assert.equal(m.version, version)
                    assert.equal(m.streamId, streamId)
                    assert.equal(m.streamPartition, streamPartition)
                    assert.equal(m.timestamp, timestamp)
                    assert.equal(m.ttl, ttl)
                    assert.equal(m.contentType, StreamrBinaryMessage.CONTENT_TYPE_JSON)
                    assert(Buffer.isBuffer(m.content))

                    // Since the content was passed as a buffer, it should remain as is on toBytes()
                    m.toBytes()
                    assert.equal(JSON.parse.callCount, 0)
                    assert.equal(JSON.parse.callCount, 0)
                })
            })
        })

        describe('constructor', () => {
            it('must accept a buffer content', () => {
                new StreamrBinaryMessageV28(
                    streamId, streamPartition, timestamp, ttl,
                    StreamrBinaryMessage.CONTENT_TYPE_JSON, Buffer.from(JSON.stringify(msg), 'utf8'),
                )
            })

            it('must accept a string content', () => {
                new StreamrBinaryMessageV28(
                    streamId, streamPartition, timestamp, ttl,
                    StreamrBinaryMessage.CONTENT_TYPE_JSON, 'I AM A STRING',
                )
            })

            it('must throw if content is not a buffer or a string', () => {
                assert.throws(() => {
                    new StreamrBinaryMessageV28(
                        streamId, streamPartition, timestamp, ttl,
                        StreamrBinaryMessage.CONTENT_TYPE_JSON, {
                            iam: 'an object',
                        },
                    )
                })
            })
        })
    })

    describe('version 29', () => {
        let bytes
        const address = '0xf915ed664e43c50eb7b9ca7cfeb992703ede55c4'
        const signatureType = 1
        const signature = '0xcb1fa20f2f8e75f27d3f171d236c071f0de39e4b497c51b390306fc6e7e112bb415ecea1bd093320dd91fd91113748286711122548c52a15179822a014dc14931b'

        beforeEach(() => {
            version = 29
            bytes = new StreamrBinaryMessageV29(
                streamId, streamPartition, timestamp, ttl,
                StreamrBinaryMessage.CONTENT_TYPE_JSON, Buffer.from(JSON.stringify(msg), 'utf8'), signatureType, address, signature,
            ).toBytes()
        })

        describe('toBytes/fromBytes', () => {
            it('must not alter the field content', () => {
                const m = StreamrBinaryMessageFactory.fromBytes(bytes)

                console.log(m)

                assert.equal(m.version, version)
                assert.equal(m.streamId, streamId)
                assert.equal(m.streamPartition, streamPartition)
                assert.equal(m.timestamp, timestamp)
                assert.equal(m.ttl, ttl)
                assert.equal(m.contentType, StreamrBinaryMessage.CONTENT_TYPE_JSON)
                assert.deepEqual(m.getContentParsed(), msg)
                assert.equal(m.signatureType, signatureType)
                assert.equal(m.address, address)
                assert.equal(m.signature, signature)
            })

            describe('with sinon spys on JSON object', () => {
                beforeEach(() => {
                    sinon.spy(JSON, 'parse')
                    sinon.spy(JSON, 'stringify')
                })

                afterEach(() => {
                    JSON.parse.restore()
                    JSON.stringify.restore()
                })

                it('must not parse the content with contentAsBuffer=true', () => {
                    const m = StreamrBinaryMessageFactory.fromBytes(bytes, true)

                    assert.equal(m.version, version)
                    assert.equal(m.streamId, streamId)
                    assert.equal(m.streamPartition, streamPartition)
                    assert.equal(m.timestamp, timestamp)
                    assert.equal(m.ttl, ttl)
                    assert.equal(m.contentType, StreamrBinaryMessage.CONTENT_TYPE_JSON)
                    assert(Buffer.isBuffer(m.content))
                    assert.equal(m.signatureType, signatureType)
                    assert.equal(m.address, address)
                    assert.equal(m.signature, signature)

                    // Since the content was passed as a buffer, it should remain as is on toBytes()
                    m.toBytes()
                    assert.equal(JSON.parse.callCount, 0)
                    assert.equal(JSON.parse.callCount, 0)
                })
            })
        })
    })
})
