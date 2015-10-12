"use strict"

var events = require('events')

function DataGenerator(opts) {
	this.fakeOffSet = 0

	this.messageRate = opts.messageRate || new Error("must specify 'messageRate'")
	this.streamId = opts.streamId || new Error("must specify 'streamId'")
	this.numOfMessages = opts.numOfMessages || new Error("must specify 'numOfMessages'")
	this.sendCondition = opts.sendCondition || new Error("must specify 'sendCondition'")
}

DataGenerator.prototype.__proto__ = events.EventEmitter.prototype;

DataGenerator.prototype._tick = function() {
	var exampleData = {
		b: [[5.5,24608],[5.495,97408],[5.49,51101],[5.485,67982],[5.48,44765]],
		s: [[5.505,34631],[5.51,100912],[5.515,75603],[5.52,99476],[5.525,48575]],
		_TS: (new Date).getTime(),
		_S: this.streamId,
		_C: this.fakeOffSet
	}

	this.emit("newMessage", exampleData, this.streamId, this.fakeOffSet++)
}

DataGenerator.prototype.start = function() {
	var timeSpent = 0

	if (this.sendCondition()) {
		var startTime = (new Date).getTime()
		this._tick()
		timeSpent = (new Date).getTime() - startTime
	}

	if (this.fakeOffSet !== this.numOfMessages) {
		setTimeout(this.start.bind(this), Math.max(0, this.messageRate - timeSpent))
	} else {
		this.emit("done")
	}
}

module.exports = DataGenerator
