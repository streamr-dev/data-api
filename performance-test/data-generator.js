"use strict"

var fs = require("fs")
var events = require('events')
var constants = require("./constants.js")




// Logs indiviual latencies to file LATENCY_LOG_FILE and when all messages have
// been sent, logs the summary information to file "done".
function LatencyLogger(dataGenerator) {
	this.lastMessageEmittedAt = null
	this.sumOfMessageIntervals = 0
	this.wstream = fs.createWriteStream(constants.LATENCY_LOG_FILE)
	this.wstream.write("streamId,offset,latency\n")
	dataGenerator.on("newMessage", this._log.bind(this))
	dataGenerator.on("done", this._done.bind(this))
}

LatencyLogger.prototype._log = function(message, streamId, offset) {
	var messageEmittedAt = (new Date).getTime()

	if (this.lastMessageEmittedAt != null) {
		var diff = messageEmittedAt - this.lastMessageEmittedAt
		this.wstream.write(streamId + "," + offset + "," + diff + "\n")
		this.sumOfMessageIntervals += diff
	}

	this.lastMessageEmittedAt = messageEmittedAt
	console.log("Sent message with offset " + offset + " (" + diff +" ms)")
}

LatencyLogger.prototype._done = function() {
	fs.writeFileSync("done", JSON.stringify({
		allSent: true,
		msgRate: this.sumOfMessageIntervals / (constants.NUM_OF_MESSAGES - 1)
	}))
	this.wstream.end()
}



// Emits fake data on a regular interval to be consumed.
function DataGenerator(opts) {
	this.messageRate = opts.messageRate || constants.MESSAGE_RATE_IN_MILLIS
	this.streamIds = opts.streamIds || constants.STREAM_IDS
	this.numOfMessages = opts.numOfMessages || constants.NUM_OF_MESSAGES
	this.sendCondition = opts.sendCondition || new Error("must specify 'sendCondition'")

	this.offSets = {}

	var _this = this
	this.streamIds.forEach(function(streamId){
		_this.offSets[streamId] = 0
	})

	new LatencyLogger(this)
}

DataGenerator.prototype.__proto__ = events.EventEmitter.prototype;

DataGenerator.prototype._tick = function() {
	var _this = this
	this.streamIds.forEach(function(streamId) {
		if (_this.offSets[streamId] !== _this.numOfMessages) {
			var exampleData = {
				b: [[5.5,24608],[5.495,97408],[5.49,51101],[5.485,67982],[5.48,44765]],
				s: [[5.505,34631],[5.51,100912],[5.515,75603],[5.52,99476],[5.525,48575]],
				_TS: (new Date).getTime(),
				_S: streamId,
				_C: _this.offSets[streamId]
			}

			_this.emit("newMessage", exampleData, streamId, _this.offSets[streamId]++)
		}
	})
}

DataGenerator.prototype.start = function() {
	var timeSpent = 0

	if (this.sendCondition()) {
		var startTime = (new Date).getTime()
		this._tick()
		timeSpent = (new Date).getTime() - startTime
	}

	if (this._anyMessagesLeft()) {
		setTimeout(this.start.bind(this), Math.max(0, this.messageRate - timeSpent))
	} else {
		this.emit("done")
	}
}

DataGenerator.prototype._anyMessagesLeft = function() {
	for (var idx in this.streamIds) {
		var streamId = constants.STREAM_IDS[idx]
		if (this.offSets[streamId] !== this.numOfMessages) {
			return true
		}
	}
	return false
}

module.exports = {
	DataGenerator: DataGenerator,
	LatencyLogger: LatencyLogger
}
