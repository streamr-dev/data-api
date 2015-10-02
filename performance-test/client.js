global.io = require("socket.io-client")
var fs = require("fs")
var StreamrClient = require("./lib/streamr-client/streamr-client.js").StreamrClient
var constants = require("./constants.js")


function PerformanceTestClient(clientId) {
	this.clientId = clientId
	this.isConnected = false
	this.numOfMessagesReceived = 0
	this.sumOfTimeDiffs = 0
	this.maxTimeDiff = Number.NEGATIVE_INFINITY
	this.minTimeDiff = Number.POSITIVE_INFINITY

	var that = this

	this.client = new StreamrClient({
		server: process.env.SERVER || constants.SERVER_URL,
		autoConnect: false,
		autoDisconnect: false
	})

	console.log("Created client " + this.clientId + " for " + this.client.options.server)

	this.client.bind("connected", function() {
		that.isConnected = true;
	})

	this.client.subscribe(
			constants.STREAM_ID,
			function (message, streamId, timestamp, counter) {

				// Calculate latency. Assume server and client time are synchronized.
				var timeDiff = (new Date).getTime() - timestamp
				console.assert(timeDiff >= -5, "server time in future w.r.t client")
				if (timeDiff < 0) {
					timeDiff = 0
				}

				// Keep track of maximum and minimum latency
				that.maxTimeDiff = Math.max(that.maxTimeDiff, timeDiff)
				that.minTimeDiff = Math.min(that.minTimeDiff, timeDiff)

				that.sumOfTimeDiffs += timeDiff
				++that.numOfMessagesReceived

				// Order not preserved
				fs.appendFile(constants.LATENCY_LOG_FILE,
						that.clientId + "," + timeDiff + "," + counter + "\n")
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
	var client = new PerformanceTestClient(clients.length)
	client.start()
	clients.push(client) // Var `clients` outside scope

	if (clients.length < constants.NUM_OF_CLIENTS_PER_INSTANCE) {
		setTimeout(createAndConnectClient, constants.CLIENT_RAMPUP_IN_MILLIS)
	}
}

function meanOfArray(list) {
	return list.reduce(function(sum, val) { return sum + val }, 0) / list.length
}

// When process is killed, print out stats
process.on("SIGINT", function() {
	var numOfConnects = 0
	var numOfSubscribes = 0
	var numOfMessagesReceivedPerClient = []
	var meanLatencies = []
	var minLatencies = []
	var maxLatencies = []
	var maxLatency = Number.NEGATIVE_INFINITY
	var minLatency = Number.POSITIVE_INFINITY

	clients.map(function(client) {
		numOfConnects += client.isConnected
		numOfSubscribes += client.isSubscribed()
		numOfMessagesReceivedPerClient.push(client.numOfMessagesReceived)
		meanLatencies.push(client.sumOfTimeDiffs / client.numOfMessagesReceived)
		minLatencies.push(client.minTimeDiff)
		maxLatencies.push(client.maxTimeDiff)
		maxLatency = Math.max(maxLatency, client.maxTimeDiff)
		minLatency = Math.min(minLatency, client.minTimeDiff)
	})

	// Mean of means not a problem because subsamples should be of equal size
	var grandMean = meanOfArray(meanLatencies)
	var minMean = meanOfArray(minLatencies)
	var maxMean = meanOfArray(maxLatencies)

	console.log("Number of connects " + numOfConnects)
	console.log("Number of subscribes " + numOfSubscribes)
	console.log("Numbers of messages received " + numOfMessagesReceivedPerClient)
	console.log("")
	console.log("---- Latency ----")
	//console.log("Mean latencies" + meanLatencies)
	console.log("Interval [" + [minLatency, maxLatency] + "] ms")
	console.log("Mean " + grandMean  + " ms")
	console.log("Mean min and max [" + [minMean, maxMean] + "] ms")
	process.exit()
})


fs.writeFileSync(constants.LATENCY_LOG_FILE, "client,latency,offset\n")

createAndConnectClient()
