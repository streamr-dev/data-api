var events = require('events')
var SocketIoServer = require('../lib/socketio-server').SocketIoServer
var constants = require("./constants.js")

function FakeKafkaHelper() {
	this.fakeOffSet = 0
}

FakeKafkaHelper.prototype.__proto__ = events.EventEmitter.prototype;

FakeKafkaHelper.prototype.subscribe = function(topic, fromOffset, cb) {
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

	var exampleData = {
		b: [[5.5,24608],[5.495,97408],[5.49,51101],[5.485,67982],[5.48,44765]],
		s: [[5.505,34631],[5.51,100912],[5.515,75603],[5.52,99476],[5.525,48575]],
		_S: constants.STREAM_ID,
		_C: this.fakeOffSet++
	}

	kafkaHelper.emit('message', exampleData, constants.STREAM_ID)
}

var kafkaHelper = new FakeKafkaHelper()
var server = new SocketIoServer(null, constants.SERVER_PORT, kafkaHelper)

function sendMessage() {
	kafkaHelper.sendNextMessage()
	setTimeout(sendMessage, 1000)
}

console.log("Server started on port " + constants.SERVER_PORT)
sendMessage()
