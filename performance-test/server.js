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
var DataGenerator = require("./data-generator").DataGenerator
var LatencyLogger = require("./data-generator").LatencyLogger
var constants = require("./constants.js")

function FakeKafkaHelper() {
	this.numOfSubscribes = 0
}

FakeKafkaHelper.prototype.__proto__ = events.EventEmitter.prototype;

FakeKafkaHelper.prototype.subscribe = function(topic, fromOffset, cb) {
	++this.numOfSubscribes

	// Maximum allowed clients enforced
	if (this.numOfSubscribes > constants.TOTAL_CLIENTS) {
		console.log("error: more clients subscribed than expected".red)
		process.kill()
	}

	var startingOffSet = 0

	this.emit("subscribed", topic, startingOffSet)
	if (cb) {
		cb(topic, startingOffSet)
	}
}

FakeKafkaHelper.prototype.unsubscribe = function(topic, cb) {
	this.emit("unsubscribed", topic)
	if (cb) {
			cb(topic)
	}

	console.log("info: all clients unsubscribed, quitting...".green)
	process.exit()
}

FakeKafkaHelper.prototype.sendNextMessage = function(data, streamId, offset) {
	this.emit('message', data, streamId)
}

var kafkaHelper = new FakeKafkaHelper()
var server = new SocketIoServer(null, constants.SERVER_PORT, kafkaHelper)

var dataGenerator = new DataGenerator({
	sendCondition: function() {
		return kafkaHelper.numOfSubscribes === constants.TOTAL_CLIENTS
	}
})

dataGenerator.on("newMessage", kafkaHelper.sendNextMessage.bind(kafkaHelper))
dataGenerator.on("done", function() {
	console.log("info: all messages have been sent".green)
})
dataGenerator.start()

console.log("Server started on port " + constants.SERVER_PORT)

if (global.gc) {
	setInterval(function() {
		var startTime = (new Date).getTime()
		global.gc()
		var diff = (new Date).getTime() - startTime
		console.log("Garbage collection (" + diff + " ms)")
	}, 1000 * 30)
}
