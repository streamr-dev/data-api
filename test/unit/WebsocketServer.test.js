const assert = require('assert')
const events = require('events')
const sinon = require('sinon')
const encoder = require('../../src/MessageEncoder')
const StreamrBinaryMessage = require('../../src/protocol/StreamrBinaryMessage')
const StreamrBinaryMessageWithKafkaMetadata = require('../../src/protocol/StreamrBinaryMessageWithKafkaMetadata')
const WebsocketServer = require('../../src/WebsocketServer')

const MockSocket = require('./test-helpers/MockSocket')

describe('WebsocketServer', () => {
    let server
    let wsMock
    let streamFetcher
    let realtimeAdapter
    let historicalAdapter
    let latestOffsetFetcher
    let mockSocket

    beforeEach(() => {
        realtimeAdapter = new events.EventEmitter()
        realtimeAdapter.subscribe = sinon.stub()
        realtimeAdapter.subscribe.callsArgAsync(2)
        realtimeAdapter.unsubscribe = sinon.spy()

        historicalAdapter = {
            getLast: sinon.spy(),
            getAll: sinon.spy(),
            getFromOffset: sinon.spy(),
            getOffsetRange: sinon.spy(),
            getFromTimestamp: sinon.spy(),
            getTimestampRange: sinon.spy(),
        }

        latestOffsetFetcher = {
            fetchOffset() {
                return Promise.resolve(0)
            },
        }

        streamFetcher = {
            authenticate(streamId, authKey) {
                return new Promise(((resolve, reject) => {
                    if (authKey === 'correct') {
                        resolve(true)
                    } else {
                        reject(new Error(403))
                    }
                }))
            },
        }

        // Mock socket.io
        wsMock = new events.EventEmitter()

        // Mock the socket
        mockSocket = new MockSocket()

        // Create the server instance
        server = new WebsocketServer(wsMock, realtimeAdapter, historicalAdapter, latestOffsetFetcher, streamFetcher)
    })

    function kafkaMessage() {
        const streamId = 'streamId'
        const partition = 0
        const timestamp = new Date(1491037200000)
        const ttl = 0
        const contentType = StreamrBinaryMessage.CONTENT_TYPE_JSON
        const content = {
            hello: 'world',
        }
        const msg = new StreamrBinaryMessage(streamId, partition, timestamp, ttl, contentType, Buffer.from(JSON.stringify(content), 'utf8'))
        return new StreamrBinaryMessageWithKafkaMetadata(msg.toBytes(), 2, 1, 0)
    }

    describe('on socket connection', () => {
        let mockSocket2

        beforeEach(() => {
            mockSocket2 = new MockSocket()
            wsMock.emit('connection', mockSocket)
            wsMock.emit('connection', mockSocket2)
        })

        it('listens to connected sockets "message" event', () => {
            assert.equal(mockSocket.listenerCount('message'), 1)
            assert.equal(mockSocket2.listenerCount('message'), 1)
        })

        it('listens to connected sockets "close" event', () => {
            assert.equal(mockSocket.listenerCount('close'), 1)
            assert.equal(mockSocket2.listenerCount('close'), 1)
        })

        it('increments connection counter', () => {
            assert.equal(server.connectionCounter, 2)
        })
    })

    describe('on resend request', () => {
        it('emits a resending event before starting the resend', (done) => {
            historicalAdapter.getAll = sinon.stub()
            historicalAdapter.getAll.callsArgWithAsync(2, kafkaMessage())

            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                sub: 'sub',
                type: 'resend',
                resend_all: true,
            })

            setTimeout(() => {
                const payload = {
                    stream: 'streamId',
                    partition: 0,
                    sub: 'sub',
                }
                const expectedMsg = JSON.stringify([0, encoder.BROWSER_MSG_TYPE_RESENDING, '', payload])
                assert.deepEqual(mockSocket.sentMessages[0], expectedMsg)
                done()
            })
        })

        it('adds the subscription id to messages', (done) => {
            historicalAdapter.getAll = sinon.stub()
            historicalAdapter.getAll.callsArgWithAsync(2, kafkaMessage())

            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                sub: 'sub',
                type: 'resend',
                resend_all: true,
            })

            setTimeout(() => {
                const expectedMsg = JSON.stringify([
                    0,
                    encoder.BROWSER_MSG_TYPE_UNICAST,
                    'sub',
                    [28, 'streamId', 0, 1491037200000, 0, 2, 1, 27, JSON.stringify({
                        hello: 'world',
                    })],
                ])
                assert.deepEqual(mockSocket.sentMessages[1], expectedMsg)
                done()
            })
        })

        it('emits a resent event when resend is complete', (done) => {
            historicalAdapter.getAll = function (streamId, streamPartition, messageHandler, onDone) {
                messageHandler(kafkaMessage())
                onDone()
            }

            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                sub: 'sub',
                type: 'resend',
                resend_all: true,
            })

            setTimeout(() => {
                const expectedMsg = JSON.stringify([
                    0, encoder.BROWSER_MSG_TYPE_RESENT, '', {
                        stream: 'streamId', partition: 0, sub: 'sub',
                    },
                ])
                assert.deepEqual(mockSocket.sentMessages[2], expectedMsg)
                done()
            })
        })

        it('emits no_resend if there is nothing to resend', (done) => {
            historicalAdapter.getAll = sinon.stub()
            historicalAdapter.getAll.callsArgAsync(3)

            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                sub: 'sub',
                type: 'resend',
                resend_all: true,
            })

            setTimeout(() => {
                const expectedMsg = JSON.stringify([
                    0, encoder.BROWSER_MSG_TYPE_NO_RESEND, '', {
                        stream: 'streamId', partition: 0, sub: 'sub',
                    },
                ])
                assert.deepEqual(mockSocket.sentMessages[0], expectedMsg)
                done()
            })
        })

        describe('socket sends resend request with resend_all', () => {
            it('requests all messages from historicalAdapter', (done) => {
                wsMock.emit('connection', mockSocket)
                mockSocket.receive({
                    type: 'resend',
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    sub: 7,
                    resend_all: true,
                })

                setTimeout(() => {
                    sinon.assert.calledWith(historicalAdapter.getAll, 'streamId', 0)
                    done()
                })
            })
        })

        describe('socket sends resend request with resend_from', () => {
            it('requests messages from given offset from historicalAdapter', (done) => {
                wsMock.emit('connection', mockSocket)
                mockSocket.receive({
                    type: 'resend',
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    sub: 7,
                    resend_from: 333,
                })

                setTimeout(() => {
                    sinon.assert.calledWith(historicalAdapter.getFromOffset, 'streamId', 0, 333)
                    done()
                })
            })
        })

        describe('socket sends resend request with resend_from AND resend_to', () => {
            it('requests messages from given range from historicalAdapter', (done) => {
                wsMock.emit('connection', mockSocket)
                mockSocket.receive({
                    type: 'resend',
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    sub: 7,
                    resend_from: 7,
                    resend_to: 10,
                })

                setTimeout(() => {
                    sinon.assert.calledWith(historicalAdapter.getOffsetRange, 'streamId', 0, 7, 10)
                    done()
                })
            })
        })

        describe('socket sends resend request with resend_from_time', () => {
            it('requests messages from given timestamp from historicalAdapter', (done) => {
                const timestamp = Date.now()
                wsMock.emit('connection', mockSocket)
                mockSocket.receive({
                    type: 'resend',
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    sub: 7,
                    resend_from_time: timestamp,
                })

                setTimeout(() => {
                    sinon.assert.calledWith(historicalAdapter.getFromTimestamp, 'streamId', 0, timestamp)
                    done()
                })
            })
        })

        describe('socket sends resend request with resend_last', () => {
            it('requests last N messages from historicalAdapter', (done) => {
                wsMock.emit('connection', mockSocket)
                mockSocket.receive({
                    type: 'resend',
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    sub: 7,
                    resend_last: 10,
                })

                setTimeout(() => {
                    sinon.assert.calledWith(historicalAdapter.getLast, 'streamId', 0, 10)
                    done()
                })
            })
        })
    })

    describe('on resend request with invalid key', () => {
        beforeEach(() => {
            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'wrong',
                sub: 'sub',
                type: 'resend',
                resend_all: true,
            })
        })

        it('sends only error message to socket', (done) => {
            setTimeout(() => {
                assert.deepEqual(mockSocket.sentMessages, [JSON.stringify([
                    0, encoder.BROWSER_MSG_TYPE_ERROR, '',
                    'Failed to request resend from stream streamId and partition 0: 403',
                ])])
                done()
            })
        })

        it('historicalAdapter is not called', (done) => {
            setTimeout(() => {
                sinon.assert.notCalled(historicalAdapter.getAll)
                done()
            })
        })
    })

    describe('message broadcasting', () => {
        it('emits messages received from Redis to those sockets according to streamId', (done) => {
            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                realtimeAdapter.emit('message', kafkaMessage().toArray(), 'streamId', 0)
            })

            setTimeout(() => {
                assert.deepEqual(mockSocket.sentMessages[1], JSON.stringify([
                    0,
                    encoder.BROWSER_MSG_TYPE_BROADCAST,
                    '',
                    [28, 'streamId', 0, 1491037200000, 0, 2, 1, 27, JSON.stringify({
                        hello: 'world',
                    })],
                ]))
                done()
            })
        })
    })

    describe('on invalid subscribe request', () => {
        beforeEach(() => {
            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                type: 'subscribe',
            })
        })

        it('emits error', (done) => {
            setTimeout(() => {
                const msg = JSON.parse(mockSocket.sentMessages[0])
                assert.equal(
                    msg[1], // message type
                    encoder.BROWSER_MSG_TYPE_ERROR,
                )
                const content = msg[3]
                assert(content.error !== undefined)
                done()
            })
        })
    })

    describe('on subscribe request', () => {
        beforeEach(() => {
            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })
        })

        it('creates the Stream object with default partition', (done) => {
            setTimeout(() => {
                assert(server.getStreamObject('streamId', 0) != null)
                done()
            })
        })

        it('creates the Stream object with given partition', (done) => {
            const socket2 = new MockSocket()
            wsMock.emit('connection', socket2)
            socket2.receive({
                stream: 'streamId',
                partition: 1,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                assert(server.getStreamObject('streamId', 1) != null)
                done()
            })
        })

        it('subscribes to the realtime adapter', (done) => {
            setTimeout(() => {
                sinon.assert.calledWith(realtimeAdapter.subscribe, 'streamId', 0)
                done()
            })
        })

        it('emits \'subscribed\' after subscribing', (done) => {
            setTimeout(() => {
                assert.deepEqual(mockSocket.sentMessages[0], JSON.stringify([
                    0, encoder.BROWSER_MSG_TYPE_SUBSCRIBED, '', {
                        stream: 'streamId', partition: 0,
                    },
                ]))
                done()
            })
        })

        it('does not resubscribe to realtimeAdapter on new subscription to same stream', (done) => {
            const socket2 = new MockSocket()
            wsMock.emit('connection', socket2)
            socket2.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                sinon.assert.calledOnce(realtimeAdapter.subscribe)
                done()
            })
        })
    })

    describe('on subscribe request with invalid key', () => {
        beforeEach(() => {
            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'wrong',
                type: 'subscribe',
            })
        })

        it('does not create the Stream object with default partition', (done) => {
            setTimeout(() => {
                assert(server.getStreamObject('streamId', 0) == null)
                done()
            })
        })

        it('does not subscribe to the realtime adapter', (done) => {
            setTimeout(() => {
                sinon.assert.notCalled(realtimeAdapter.subscribe)
                done()
            })
        })

        it('sends error message to socket', (done) => {
            setTimeout(() => {
                assert.equal(mockSocket.sentMessages[0], JSON.stringify([0, encoder.BROWSER_MSG_TYPE_ERROR, '',
                    'Not authorized to subscribe to stream streamId and partition 0']))
                done()
            })
        })
    })

    describe('unsubscribe', () => {
        beforeEach((done) => {
            // connect
            wsMock.emit('connection', mockSocket)

            // subscribe
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            // unsubscribe
            setTimeout(() => {
                mockSocket.receive({
                    stream: 'streamId',
                    partition: 0,
                    type: 'unsubscribe',
                })
                done()
            })
        })

        it('emits a unsubscribed event', () => {
            assert.deepEqual(mockSocket.sentMessages[mockSocket.sentMessages.length - 1], JSON.stringify([
                0, encoder.BROWSER_MSG_TYPE_UNSUBSCRIBED, '', {
                    stream: 'streamId', partition: 0,
                },
            ]))
        })

        it('unsubscribes from realtimeAdapter if there are no more sockets on the stream', () => {
            sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId', 0)
        })

        it('removes stream object if there are no more sockets on the stream', () => {
            assert(server.getStreamObject('streamId', 0) == null)
        })

        it('does not unsubscribe from realtimeAdapter if there are sockets remaining on the stream', (done) => {
            realtimeAdapter.unsubscribe = sinon.spy()

            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                const socket2 = new MockSocket()
                wsMock.emit('connection', socket2)
                socket2.receive({
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    type: 'subscribe',
                })

                setTimeout(() => {
                    sinon.assert.notCalled(realtimeAdapter.unsubscribe)
                    done()
                })
            })
        })

        it('does not remove stream object if there are sockets remaining on the stream', (done) => {
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                const socket2 = new MockSocket()
                wsMock.emit('connection', socket2)
                socket2.receive({
                    stream: 'streamId',
                    partition: 0,
                    authKey: 'correct',
                    type: 'subscribe',
                })

                setTimeout(() => {
                    assert(server.getStreamObject('streamId', 0) != null)
                    done()
                })
            })
        })
    })

    describe('subscribe-unsubscribe-subscribe', () => {
        it('should work', (done) => {
            // connect
            wsMock.emit('connection', mockSocket)

            // subscribe
            mockSocket.receive({
                stream: 'streamId',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                // unsubscribe
                mockSocket.receive({
                    stream: 'streamId',
                    partition: 0,
                    type: 'unsubscribe',
                })

                setTimeout(() => {
                    // subscribed
                    mockSocket.receive({
                        stream: 'streamId',
                        partition: 0,
                        authKey: 'correct',
                        type: 'subscribe',
                    })

                    setTimeout(() => {
                        assert.deepEqual(mockSocket.sentMessages, [
                            JSON.stringify([0, encoder.BROWSER_MSG_TYPE_SUBSCRIBED, '', {
                                stream: 'streamId', partition: 0,
                            }]),
                            JSON.stringify([0, encoder.BROWSER_MSG_TYPE_UNSUBSCRIBED, '', {
                                stream: 'streamId', partition: 0,
                            }]),
                            JSON.stringify([0, encoder.BROWSER_MSG_TYPE_SUBSCRIBED, '', {
                                stream: 'streamId', partition: 0,
                            }]),
                        ])
                        done()
                    })
                })
            })
        })
    })

    describe('disconnect', () => {
        beforeEach((done) => {
            wsMock.emit('connection', mockSocket)
            mockSocket.receive({
                stream: 'streamId',
                partition: 6,
                authKey: 'correct',
                type: 'subscribe',
            })
            mockSocket.receive({
                stream: 'streamId',
                partition: 4,
                authKey: 'correct',
                type: 'subscribe',
            })
            mockSocket.receive({
                stream: 'streamId2',
                partition: 0,
                authKey: 'correct',
                type: 'subscribe',
            })

            setTimeout(() => {
                mockSocket.disconnect()
                done()
            })
        })

        it('unsubscribes from realtimeAdapter on streams where there are no more connections', () => {
            sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId', 6)
            sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId', 4)
            sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId2', 0)
        })

        it('decrements connection counter', () => {
            assert.equal(server.connectionCounter, 0)
        })
    })

    describe('createStreamObject', () => {

        let stream

        afterEach(() => {
            if (stream) {
                clearTimeout(stream.stateTimeout);
            }
        })

        it('should return an object with the correct id, partition and state', () => {
            stream = server.createStreamObject('streamId', 3)
            assert.equal(stream.id, 'streamId')
            assert.equal(stream.partition, 3)
            assert.equal(stream.state, 'init')
        })

        it('should return an object that can be looked up', () => {
            stream = server.createStreamObject('streamId', 4)
            assert.equal(server.getStreamObject('streamId', 4), stream)
        })
    })

    describe('getStreamObject', () => {
        let stream
        beforeEach(() => {
            stream = server.createStreamObject('streamId', 0)
        })

        afterEach(() => {
            if (stream) {
                clearTimeout(stream.stateTimeout);
            }
        })

        it('must return the requested stream', () => {
            assert.equal(server.getStreamObject('streamId', 0), stream)
        })

        it('must return undefined if the stream does not exist', () => {
            assert.equal(server.getStreamObject('streamId', 1), undefined)
        })
    })

    describe('deleteStreamObject', () => {
        let stream

        beforeEach(() => {
            stream = server.createStreamObject('streamId', 0)
        })

        afterEach(() => {
            if (stream) {
                clearTimeout(stream.stateTimeout);
            }
        })

        it('must delete the requested stream', () => {
            server.deleteStreamObject('streamId', 0)
            assert.equal(server.getStreamObject('streamId', 0), undefined)
        })
    })
})
