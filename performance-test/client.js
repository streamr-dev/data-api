global.io = require("socket.io-client")
var fs = require("fs")
var StreamrClient = require("./lib/streamr-client/streamr-client.js").StreamrClient
var constants = require("./constants.js")

function PerformanceTestClient(clientId, wstream) {
	this.clientId = clientId
	this.isConnected = false
	this.numOfMessagesReceived = 0
	this.sumOfTimeDiffs = 0
	this.maxTimeDiff = Number.NEGATIVE_INFINITY
	this.minTimeDiff = Number.POSITIVE_INFINITY
	this.wstream = wstream
	this.wasSubscribed = false
	this.wasConnected = false

	var that = this

	this.client = new StreamrClient({
		server: process.env.SERVER || constants.SERVER_URL,
		autoConnect: false,
		autoDisconnect: false
	})

	console.log("Created client " + this.clientId + " for " + this.client.options.server)

	this.client.bind("connected", function() {
		that.isConnected = true
		that.wasConnected = true
	})

	this.client.bind("disconnected", function() {
		that.isConnected = false
	})

	constants.STREAM_IDS.forEach(function(streamId) {
		that.client.subscribe(
				streamId,
				function (message, streamId, timestamp, counter) {

					// Calculate latency. Assume server and client time are synchronized.
					var timeDiff = (new Date).getTime() - timestamp

					// Keep track of maximum and minimum latency
					that.maxTimeDiff = Math.max(that.maxTimeDiff, timeDiff)
					that.minTimeDiff = Math.min(that.minTimeDiff, Math.max(timeDiff, 0))

					that.sumOfTimeDiffs += Math.max(timeDiff, 0)
					++that.numOfMessagesReceived

					// Order not preserved
					that.wstream.write(streamId + "," + that.clientId + "," + counter + "," + timeDiff + "\n")

					if (that.numOfMessagesReceived === (constants.NUM_OF_MESSAGES * constants.STREAM_IDS.length)) {
						that.wasSubscribed = true
						that.client.disconnect()
					}
				},
				{}
		)
	})
}

PerformanceTestClient.prototype.start = function() {
	this.client.connect()
}


var clients = []

function createAndConnectClient(wstream) {
	var client = new PerformanceTestClient(clients.length, wstream)
	client.start()
	clients.push(client) // Var `clients` outside scope

	if (clients.length < constants.NUM_OF_CLIENTS_PER_INSTANCE) {
		setTimeout(function() { createAndConnectClient(wstream) }, constants.CLIENT_RAMPUP_IN_MILLIS)
	}
}

function meanOfArray(list) {
	return list.reduce(function(sum, val) { return sum + val }, 0) / list.length
}

var wstream = fs.createWriteStream(constants.LATENCY_LOG_FILE)
wstream.cork()


setInterval(function() {
	var startTime = (new Date).getTime()
	wstream.uncork()
	wstream.cork()
	var diff = (new Date).getTime() - startTime
	console.log("Writing to file took (" + diff + " ms)")
}, 5000)

setInterval(function() {
	var startTime = (new Date).getTime()

	var totalConnectedClients = clients.filter(function(client) {
		return client.isConnected
	}).length


	if (totalConnectedClients === 0) {
		process.exit()
	}

	var diff = (new Date).getTime() - startTime
	console.log("Active connections " + totalConnectedClients)
	console.log("Scanning client connections took (" + diff + " ms)")
}, 10000)

process.on("SIGINT", function() {
	process.exit()
})

// When process is killed, print out stats
process.on("exit", function() {
	wstream.end();

	var numOfConnects = 0
	var numOfSubscribes = 0
	var numOfMessagesReceivedPerClient = []
	var meanLatencies = []
	var minLatencies = []
	var maxLatencies = []
	var maxLatency = Number.NEGATIVE_INFINITY
	var minLatency = Number.POSITIVE_INFINITY

	clients.map(function(client) {
		numOfConnects += client.wasConnected
		numOfSubscribes += client.wasSubscribed
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

	fs.writeFileSync("done", JSON.stringify({
		connects: numOfConnects,
		subscribes: numOfSubscribes,
		messagesReceived: numOfMessagesReceivedPerClient,
		allMessagesReceived: numOfMessagesReceivedPerClient.every(function(x) {
			return x === constants.NUM_OF_MESSAGES
		}),
		latency: {
			interval: [minLatency, maxLatency],
			mean: grandMean,
			meanRange: [minMean, maxMean]
		}
	}, null, 4))
})



wstream.write("client,streamId,offset,latency\n")
createAndConnectClient(wstream)
