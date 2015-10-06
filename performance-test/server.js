/*
 * An instance of the streamr-socket-server with the following qualities:
 *   a) Kafka connection is faked with an in-memory object
 *
 *   b) sends a predefined amount of messages in a predefined rate on a
 *   predefined channel/topic
 *
 *   c) starts sending messages only when a predefined amount of subscriptions
 *   have occurred.
 *
 *   d) if more subscriptions occur than was expected, server exits.
 */

var events = require('events')
var colors = require("colors")
var SocketIoServer = require('../lib/socketio-server').SocketIoServer
var constants = require("./constants.js")


function FakeKafkaHelper() {
	this.fakeOffSet = 0
	this.numOfSubscribes = 0
	this.lastMessageEmittedAt = null
}

FakeKafkaHelper.prototype.__proto__ = events.EventEmitter.prototype;

FakeKafkaHelper.prototype.subscribe = function(topic, fromOffset, cb) {
	++this.numOfSubscribes

	this.emit("subscribed", topic, this.fakeOffSet)
	if (cb) {
		cb(topic, this.fakeOffSet)
	}
}

FakeKafkaHelper.prototype.unsubscribe = function(topic, cb) {
	this.emit("unsubscribed", topic)
	if (cb) {
			cb(topic)
	}
}

FakeKafkaHelper.prototype.sendNextMessage = function() {

	// Send data when all clients have subscribed
	if (this.numOfSubscribes == constants.TOTAL_CLIENTS) {
		var exampleData = {
			b: [[5.5,24608],[5.495,97408],[5.49,51101],[5.485,67982],[5.48,44765]],
			s: [[5.505,34631],[5.51,100912],[5.515,75603],[5.52,99476],[5.525,48575]],
			_TS: (new Date).getTime(),
			_S: constants.STREAM_ID,
			_C: this.fakeOffSet++
		}

		kafkaHelper.emit('message', exampleData, constants.STREAM_ID)

		// Calculate time difference since last invocation of this method
		var messageEmittedAt = (new Date).getTime()
		if (this.lastMessageEmittedAt != null) {
			var diff = messageEmittedAt - this.lastMessageEmittedAt
		}

		this.lastMessageEmittedAt = messageEmittedAt

		console.log("Sent message with offset " + this.fakeOffSet +
				" (" + diff +" ms)")

	} else if (this.numOfSubscribes > constants.TOTAL_CLIENTS) {
		console.log("error: more clients subscribed than expected".red)
		process.kill()
	} else {
		return
	}
}


var kafkaHelper = new FakeKafkaHelper()
var server = new SocketIoServer(null, constants.SERVER_PORT, kafkaHelper)

function startMessageSendingLoop() {
	kafkaHelper.sendNextMessage()

	if (kafkaHelper.fakeOffSet == constants.NUM_OF_MESSAGES_TO_SEND) {
		console.log("info: all messages have been sent".green)
	} else {
		setTimeout(startMessageSendingLoop, constants.MESSAGE_RATE_IN_MILLIS)
	}
}

console.log("Server started on port " + constants.SERVER_PORT)
startMessageSendingLoop()

if (global.gc) {
	setInterval(function() {
		var startTime = (new Date).getTime()
		global.gc()
		var diff = (new Date).getTime() - startTime
		console.log("Garbage collection (" + diff + " ms)")
	}, 1000 * 30)
}
