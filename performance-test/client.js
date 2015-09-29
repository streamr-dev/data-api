global.io = require("socket.io-client")
var StreamrClient = require("./lib/streamr-client/streamr-client.js").StreamrClient
var constants = require("./constants.js")


function PerformanceTestClient() {
	this.isConnected = false
	this.numOfMessagesReceived = 0
	this.sumOfTimeDiffs = 0
	this.maxTimeDiff = Number.NEGATIVE_INFINITY
	this.minTimeDiff = Number.POSITIVE_INFINITY

	var that = this

	this.client = new StreamrClient({
		server: constants.SERVER_URL,
		autoConnect: false,
		autoDisconnect: true
	})

	this.client.bind("connected", function() {
		that.isConnected = true;
	})

	this.client.subscribe(
			constants.STREAM_ID,
			function (message, streamId, timestamp, counter) {

				// Calculate latency. Assume server and client time are synchronized.
				var timeDiff = (new Date).getTime() - parseInt(timestamp, 10)
				console.assert(timeDiff >= 0)

				// Keep track of maximum and minimum latency
				that.maxTimeDiff = Math.max(that.maxTimeDiff, timeDiff)
				that.minTimeDiff = Math.min(that.minTimeDiff, timeDiff)

				that.sumOfTimeDiffs += timeDiff
				++that.numOfMessagesReceived
			},
			{}
	)
}

PerformanceTestClient.prototype.start = function() {
	this.client.connect()
}

PerformanceTestClient.prototype.isSubscribed = function() {
	return this.client.subsByStream[constants.STREAM_ID][0].subscribed
}


var clients = []

function createAndConnectClient() {
	var client = new PerformanceTestClient()
	client.start()
	clients.push(client) // Var `clients` outside scope

	if (clients.length < constants.TOTAL_CLIENTS) {
		setTimeout(createAndConnectClient, constants.CLIENT_RAMPUP_IN_MILLIS)
	}
}

// When process is killed, print out stats
process.on("SIGINT", function() {
	var numOfConnects = 0
	var numOfSubscribes = 0
	var numOfMessagesReceivedPerClient = []
	var meanLatencies = []
	var maxLatency = Number.NEGATIVE_INFINITY
	var minLatency = Number.POSITIVE_INFINITY

	clients.map(function(client) {
		numOfConnects += client.isConnected
		numOfSubscribes += client.isSubscribed()
		numOfMessagesReceivedPerClient.push(client.numOfMessagesReceived)
		meanLatencies.push(client.sumOfTimeDiffs / client.numOfMessagesReceived)
		maxLatency = Math.max(maxLatency, client.maxTimeDiff)
		minLatency = Math.min(minLatency, client.minTimeDiff)
	})

	console.log("Number of connects " + numOfConnects)
	console.log("Number of subscribes " + numOfSubscribes)
	console.log("Numbers of messages received " + numOfMessagesReceivedPerClient)
	console.log("Mean latencies " + meanLatencies + " ms")
	console.log("Latency interval [" + [minLatency, maxLatency] + "] ms")
	process.exit()
})

createAndConnectClient()
