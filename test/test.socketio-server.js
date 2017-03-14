const assert = require('assert')
const events = require('events')
const sinon = require('sinon')
const mockery = require('mockery')
const constants = require('../lib/constants')
const encoder = require('../lib/message-encoder')
const StreamrBinaryMessage = require('../lib/protocol/StreamrBinaryMessage')
const StreamrBinaryMessageWithKafkaMetadata = require('../lib/protocol/StreamrBinaryMessageWithKafkaMetadata')

const createSocketMock = require('./helpers/socket-mock')
var SocketIoServer

describe('socketio-server', function () {

	var server
	var wsMock
	var realtimeAdapter
	var historicalAdapter
	var latestOffsetFetcher
	var mockSocket

	before(function() {
		mockery.enable()
		mockery.registerMock('node-uuid', {
			idx: 1,
			v4: function() {
				return "socket" + (this.idx++)
			}
		})
		SocketIoServer = require('../lib/socketio-server')
	})

	after(function() {
		mockery.disable()
	})

	beforeEach(function() {
		realtimeAdapter = new events.EventEmitter
		realtimeAdapter.subscribe = sinon.stub()
		realtimeAdapter.subscribe.callsArgAsync(2)
		realtimeAdapter.unsubscribe = sinon.spy()

		historicalAdapter = {
			getLast: sinon.spy(),
			getAll: sinon.spy(),
			getFromOffset: sinon.spy(),
			getOffsetRange: sinon.spy(),
			getFromTimestamp: sinon.spy(),
			getTimestampRange: sinon.spy()
		}

		latestOffsetFetcher = {
			fetchOffset: function() {
				return Promise.resolve(0)
			}
		}

		// Mock socket.io
		wsMock = new events.EventEmitter

		// Mock the socket
		mockSocket = createSocketMock()

		// Create the server instance
		server = new SocketIoServer(undefined, realtimeAdapter, historicalAdapter, latestOffsetFetcher, wsMock)
	})

	function kafkaMessage() {
		const streamId = "streamId"
		const partition = 0
		const timestamp = new Date(2017, 3, 1, 12, 0, 0)
		const ttl = 0
		const contentType = StreamrBinaryMessage.CONTENT_TYPE_JSON
		const content = { hello: 'world' }
		const msg = new StreamrBinaryMessage(streamId, partition, timestamp, ttl, contentType, content)
		return new StreamrBinaryMessageWithKafkaMetadata(msg.toBytes(), 2, 1, 0)
	}

	context('on socket connection', function() {
		var mockSocket2

		beforeEach(function() {
			mockSocket2 = createSocketMock()
			wsMock.emit('connection', mockSocket)
			wsMock.emit('connection', mockSocket2)
		})

		it('assigns identifiers to connected sockets', function() {
			assert.equal(mockSocket.id, 'socket1')
			assert.equal(mockSocket2.id, 'socket2')
		})

		it('listens to connected sockets "message" event', function() {
			assert.equal(mockSocket.listenerCount('message'), 1)
			assert.equal(mockSocket2.listenerCount('message'), 1)
		})

		it('listens to connected sockets "close" event', function() {
			assert.equal(mockSocket.listenerCount('close'), 1)
			assert.equal(mockSocket2.listenerCount('close'), 1)
		})

		it('increments connection counter', function() {
			assert.equal(server.connectionCounter, 2)
		})
	})

	context('on resend request', function() {
		it('emits a resending event before starting the resend', function(done) {
			historicalAdapter.getAll = sinon.stub()
			historicalAdapter.getAll.callsArgAsync(2); // Async-invoke 2nd argument

			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: 'streamId',
				partition: 0,
				sub: 'sub',
				type: 'resend',
				resend_all: true
			})

			setTimeout(function() {
				const payload = {
					channel: 'streamId',
					partition: 0,
					sub: 'sub'
				}
				const expectedMsg = JSON.stringify([0, encoder.BROWSER_MSG_TYPE_RESENDING, '', payload])
				assert.deepEqual(mockSocket.sentMessages[0], expectedMsg)
				done()
			})
		})

		it('adds the subscription id to messages', function(done) {
			historicalAdapter.getAll = sinon.stub()
			historicalAdapter.getAll.callsArgWithAsync(2, kafkaMessage().toArray());

			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: 'streamId',
				partition: 0,
				sub: 'sub',
				type: 'resend',
				resend_all: true
			})

			setTimeout(function() {
				const expectedMsg = JSON.stringify([
					0,
					encoder.BROWSER_MSG_TYPE_UNICAST,
					'sub',
					[28, 'streamId', 0, 1491037200000, 0, 2, 1, 27, JSON.stringify({ hello: 'world'})]
				])
				assert.deepEqual(mockSocket.sentMessages[1], expectedMsg)
				done()
			})
		})

		it('emits a resent event when resend is complete', function(done) {
			historicalAdapter.getAll = function(streamId, streamPartition, messageHandler, onDone) {
				messageHandler(kafkaMessage().toArray())
				onDone()
			}

			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: 'streamId',
				partition: 0,
				sub: 'sub',
				type: 'resend',
				resend_all: true
			})

			setTimeout(function() {
				const expectedMsg = JSON.stringify([
					0, encoder.BROWSER_MSG_TYPE_RESENT, '', { channel: 'streamId', partition: 0, sub: 'sub'}
				])
				assert.deepEqual(mockSocket.sentMessages[2], expectedMsg)
				done()
			})
		})

		it('emits no_resend if there is nothing to resend', function(done) {
			historicalAdapter.getAll = sinon.stub()
			historicalAdapter.getAll.callsArgAsync(3);

			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: 'streamId',
				partition: 0,
				sub: 'sub',
				type: 'resend',
				resend_all: true
			})

			setTimeout(function() {
				const expectedMsg = JSON.stringify([
					0, encoder.BROWSER_MSG_TYPE_NO_RESEND, '', { channel: 'streamId', partition: 0, sub: 'sub'}
				])
				assert.deepEqual(mockSocket.sentMessages[0], expectedMsg)
				done()
			})
		})

		context('socket sends resend request with resend_all', function() {
			it('requests all messages from historicalAdapter', function (done) {
				wsMock.emit('connection', mockSocket)
				mockSocket.receive({
					type: 'resend',
					channel: 'streamId',
					partition: 0,
					sub: 7,
					resend_all: true
				})

				setTimeout(function() {
					sinon.assert.calledWith(historicalAdapter.getAll, "streamId", 0)
					done()
				})
			})
		})

		context('socket sends resend request with resend_from', function() {
			it('requests messages from given offset from historicalAdapter', function (done) {
				wsMock.emit('connection', mockSocket)
				mockSocket.receive({
					type: 'resend',
					channel: 'streamId',
					partition: 0,
					sub: 7,
					resend_from: 333
				})

				setTimeout(function () {
					sinon.assert.calledWith(historicalAdapter.getFromOffset, "streamId", 0, 333)
					done()
				})
			})
		})

		context('socket sends resend request with resend_from AND resend_to', function() {
			it('requests messages from given range from historicalAdapter', function (done) {
				wsMock.emit('connection', mockSocket)
				mockSocket.receive({
					type: 'resend',
					channel: 'streamId',
					partition: 0,
					sub: 7,
					resend_from: 7,
					resend_to: 10
				})

				setTimeout(function() {
					sinon.assert.calledWith(historicalAdapter.getOffsetRange, "streamId", 0, 7, 10)
					done()
				})
			})
		})

		describe('socket sends resend request with resend_from_time', function() {
			it('requests messages from given timestamp from historicalAdapter', function (done) {
				const timestamp = Date.now()
				wsMock.emit('connection', mockSocket)
				mockSocket.receive({
					type: 'resend',
					channel: 'streamId',
					partition: 0,
					sub: 7,
					resend_from_time: timestamp
				})

				setTimeout(function() {
					sinon.assert.calledWith(historicalAdapter.getFromTimestamp, "streamId", 0, timestamp)
					done()
				})
			});
		})

		describe('socket sends resend request with resend_last', function() {
			it('requests last N messages from historicalAdapter', function (done) {
				wsMock.emit('connection', mockSocket)
				mockSocket.receive({
					type: 'resend',
					channel: 'streamId',
					partition: 0,
					sub: 7,
					resend_last: 10
				})

				setTimeout(function() {
					sinon.assert.calledWith(historicalAdapter.getLast, "streamId", 0, 10)
					done()
				})
			});
		})
	})

	context('message broadcasting', function() {

		it('emits messages received from Redis to those sockets according to streamId', function (done) {
			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})

			setTimeout(function() {
				realtimeAdapter.emit('message', kafkaMessage().toArray(), "streamId", 0)
			})

			setTimeout(function() {
				assert.deepEqual(mockSocket.sentMessages[1], JSON.stringify([
					0,
					encoder.BROWSER_MSG_TYPE_BROADCAST,
					'',
					[28, 'streamId', 0, 1491037200000, 0, 2, 1, 27, JSON.stringify({ hello: 'world' })]
				]))
				done()
			})
		})
	})

	context('on subscribe request', function() {
		beforeEach(function() {
			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})
		})

		it('creates the Stream object with default partition', function(done) {
			setTimeout(function() {
				assert(server.getStreamObject("streamId", 0) != null)
				done()
			})
		})

		it('creates the Stream object with given partition', function(done) {
			const socket2 = new createSocketMock()
			wsMock.emit('connection', socket2)
			socket2.receive({
				channel: "streamId",
				partition: 1,
				type: 'subscribe'
			})

			setTimeout(function() {
				assert(server.getStreamObject("streamId", 1) != null)
				done()
			})
		})

		it('subscribes to the realtime adapter', function(done) {
			setTimeout(function() {
				sinon.assert.calledWith(realtimeAdapter.subscribe, "streamId", 0)
				done()
			})
		})

		it('emits \'subscribed\' after subscribing', function (done) {
			setTimeout(function() {
				assert.deepEqual(mockSocket.sentMessages[0], JSON.stringify([
					0, encoder.BROWSER_MSG_TYPE_SUBSCRIBED, '', { channel: 'streamId', partition: 0 }
				]))
				done()
			})
		})

		it('does not resubscribe to realtimeAdapter on new subscription to same stream', function (done) {
			const socket2 = createSocketMock()
			wsMock.emit('connection', socket2)
			socket2.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})

			setTimeout(function() {
				sinon.assert.calledOnce(realtimeAdapter.subscribe)
				done()
			})
		})
	})

	describe('unsubscribe', function() {
		beforeEach(function(done) {
			// connect
			wsMock.emit('connection', mockSocket)

			// subscribe
			mockSocket.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})

			// unsubscribe
			setTimeout(function() {
				mockSocket.receive({
					channel: "streamId",
					partition: 0,
					type: 'unsubscribe'
				})
				done()
			})
		})

		it('emits a unsubscribed event', function() {
			assert.deepEqual(mockSocket.sentMessages[mockSocket.sentMessages.length - 1], JSON.stringify([
				0, encoder.BROWSER_MSG_TYPE_UNSUBSCRIBED, '', { channel: 'streamId', partition: 0 }
			]))
		})

		it('unsubscribes from realtimeAdapter if there are no more sockets on the channel', function() {
			sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId', 0)
		})

		it('removes stream object if there are no more sockets on the channel', function() {
			assert(server.getStreamObject('streamId', 0) == null)
		})

		it('does not unsubscribe from realtimeAdapter if there are sockets remaining on the channel', function(done) {
			realtimeAdapter.unsubscribe = sinon.spy()

			mockSocket.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})

			setTimeout(function() {
				const socket2 = createSocketMock()
				wsMock.emit('connection', socket2)
				socket2.receive({
					channel: "streamId",
					partition: 0,
					type: 'subscribe'
				})

				setTimeout(function() {
					sinon.assert.notCalled(realtimeAdapter.unsubscribe)
					done()
				})
			})
		})

		it('does not remove stream object if there are sockets remaining on the channel', function(done) {
			mockSocket.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})

			setTimeout(function() {
				const socket2 = createSocketMock()
				wsMock.emit('connection', socket2)
				socket2.receive({
					channel: "streamId",
					partition: 0,
					type: 'subscribe'
				})

				setTimeout(function() {
					assert(server.getStreamObject('streamId', 0) != null)
					done()
				})
			})
		})
	})

	describe('subscribe-unsubscribe-subscribe', function() {
		it('should work', function(done) {
			// connect
			wsMock.emit('connection', mockSocket)

			// subscribe
			mockSocket.receive({
				channel: "streamId",
				partition: 0,
				type: 'subscribe'
			})

			setTimeout(function() {
				// unsubscribe
				mockSocket.receive({
					channel: "streamId",
					partition: 0,
					type: 'unsubscribe'
				})

				setTimeout(function() {
					// subscribed
					mockSocket.receive({
						channel: "streamId",
						partition: 0,
						type: 'subscribe'
					})

					setTimeout(function() {
						assert.deepEqual(mockSocket.sentMessages, [
							JSON.stringify([0, encoder.BROWSER_MSG_TYPE_SUBSCRIBED, '', { channel: 'streamId', partition: 0}]),
							JSON.stringify([0, encoder.BROWSER_MSG_TYPE_UNSUBSCRIBED, '', { channel: 'streamId', partition: 0}]),
							JSON.stringify([0, encoder.BROWSER_MSG_TYPE_SUBSCRIBED, '', { channel: 'streamId', partition: 0}])
						])
						done()
					})
				})
			})
		})
	})

	describe('disconnect', function() {
		beforeEach(function(done) {
			wsMock.emit('connection', mockSocket)
			mockSocket.receive({
				channel: "streamId",
				partition: 6,
				type: 'subscribe'
			})
			mockSocket.receive({
				channel: "streamId",
				partition: 4,
				type: 'subscribe'
			})
			mockSocket.receive({
				channel: "streamId2",
				partition: 0,
				type: 'subscribe'
			})

			setTimeout(function() {
				mockSocket.disconnect()
				done()
			})
		})

		it('unsubscribes from realtimeAdapter on channels where there are no more connections', function() {
			sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId', 6)
			sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId', 4)
			sinon.assert.calledWith(realtimeAdapter.unsubscribe, 'streamId2', 0)
		})

		it('decrements connection counter', function() {
			assert.equal(server.connectionCounter, 0)
		})

	})

	describe('createStreamObject', function() {
		it('should return an object with the correct id, partition and state', function() {
			var stream = server.createStreamObject('streamId', 3)
			assert.equal(stream.id, 'streamId')
			assert.equal(stream.partition, 3)
			assert.equal(stream.state, 'init')
		})

		it('should return an object that can be looked up', function() {
			var stream = server.createStreamObject('streamId', 4)
			assert.equal(server.getStreamObject('streamId', 4), stream)
		})
	})

	describe('getStreamObject', function() {
		var stream
		beforeEach(function() {
			stream = server.createStreamObject('streamId', 0)
		})

		it('must return the requested stream', function() {
			assert.equal(server.getStreamObject('streamId', 0), stream)
		})

		it('must return undefined if the stream does not exist', function() {
			assert.equal(server.getStreamObject('streamId', 1), undefined)
		})
	})

	describe('deleteStreamObject', function() {
		var stream
		beforeEach(function() {
			stream = server.createStreamObject('streamId', 0)
		})

		it('must delete the requested stream', function() {
			server.deleteStreamObject('streamId', 0)
			assert.equal(server.getStreamObject('streamId', 0), undefined)
		})
	})


});