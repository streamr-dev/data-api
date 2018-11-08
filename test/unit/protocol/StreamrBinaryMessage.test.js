/* eslint-disable no-new */
const assert = require('assert')
const sinon = require('sinon')
const StreamrBinaryMessage = require('../../../src/protocol/StreamrBinaryMessage')

describe('StreamrBinaryMessage', () => {
    let version
    const streamId = 'streamId'
    const streamPartition = 0
    const msg = {
        foo: 'bar',
    }
    const timestamp = Date.now()
    const ttl = 100
    const signatureType = 1
    const signature = '0xcb1fa20f2f8e75f27d3f171d236c071f0de39e4b497c51b390306fc6e7e112bb415ecea1bd093320dd91fd91113748286711122548c52a15179822a014dc14931b'

    describe('version 28', () => {
        let bytes

        beforeEach(() => {
            version = 28
            bytes = new StreamrBinaryMessage(
                streamId, streamPartition, timestamp, ttl,
                StreamrBinaryMessage.CONTENT_TYPE_JSON, Buffer.from(JSON.stringify(msg), 'utf8'), signatureType, signature,
            ).toBytes()
        })

        describe('toBytes/fromBytes', () => {
            it('must not alter the field content', () => {
                const m = StreamrBinaryMessage.fromBytes(bytes)

                assert.equal(m.version, version)
                assert.equal(m.streamId, streamId)
                assert.equal(m.streamPartition, streamPartition)
                assert.equal(m.timestamp, timestamp)
                assert.equal(m.ttl, ttl)
                assert.equal(m.contentType, StreamrBinaryMessage.CONTENT_TYPE_JSON)
                assert.deepEqual(m.getContentParsed(), msg)
                assert.equal(m.signatureType, signatureType)
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
                    const m = StreamrBinaryMessage.fromBytes(bytes, true)

                    assert.equal(m.version, version)
                    assert.equal(m.streamId, streamId)
                    assert.equal(m.streamPartition, streamPartition)
                    assert.equal(m.timestamp, timestamp)
                    assert.equal(m.ttl, ttl)
                    assert.equal(m.contentType, StreamrBinaryMessage.CONTENT_TYPE_JSON)
                    assert(Buffer.isBuffer(m.content))
                    assert.equal(m.signatureType, signatureType)
                    assert.equal(m.signature, signature)

                    // Since the content was passed as a buffer, it should remain as is on toBytes()
                    m.toBytes()
                    assert.equal(JSON.parse.callCount, 0)
                    assert.equal(JSON.parse.callCount, 0)
                })
            })
        })

        describe('constructor', () => {
            it('must accept a buffer content', () => {
                new StreamrBinaryMessage(
                    streamId, streamPartition, timestamp, ttl,
                    StreamrBinaryMessage.CONTENT_TYPE_JSON, Buffer.from(JSON.stringify(msg), 'utf8'), signatureType, signature,
                )
            })

            it('must accept a string content', () => {
                new StreamrBinaryMessage(
                    streamId, streamPartition, timestamp, ttl,
                    StreamrBinaryMessage.CONTENT_TYPE_JSON, 'I AM A STRING', signatureType, signature,
                )
            })

            it('must throw if content is not a buffer or a string', () => {
                assert.throws(() => {
                    new StreamrBinaryMessage(
                        streamId, streamPartition, timestamp, ttl,
                        StreamrBinaryMessage.CONTENT_TYPE_JSON, {
                            iam: 'an object',
                        },
                    )
                })
            })
        })
    })
})
