var events = require('events')
var colors = require("colors")
var SocketIoServer = require('../lib/socketio-server').SocketIoServer
var DataGenerator = require("./data-generator").DataGenerator
var constants = require("./constants.js")
var StreamrKafkaProducer = require("./kafka.js")



var kafkaProducer = new StreamrKafkaProducer(constants.KAFKA_URL)
var server = new SocketIoServer(constants.KAFKA_URL, constants.SERVER_PORT)

var dataGenerator = new DataGenerator({
	sendCondition: function() {
		var rooms = server.io.sockets.adapter.rooms
		for (var idx in constants.STREAM_IDS) {
			var streamId = constants.STREAM_IDS[idx]
			if (!(streamId in rooms) || Object.keys(rooms[streamId]).length !== constants.TOTAL_CLIENTS) {
				return false
			}
		}
		return true
	}
})

dataGenerator.on("newMessage", function(message, stream ,offset) {
	kafkaProducer.send(stream, message)
})

dataGenerator.on("done", function() {
	console.log("info: all messages have been sent".green)
	process.exit()
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
