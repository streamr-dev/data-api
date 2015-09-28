global.io = require("socket.io-client")
var StreamrClient = require("./lib/streamr-client/streamr-client.js").StreamrClient
var constants = require("./constants.js")


function PerformanceTestClient() {
	this.isConnected = false
	this.isSubscribed = false
	this.numOfMessagesReceived = 0

	var that = this;

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
			function (message, streamId, counter) {
				++that.numOfMessagesReceived
			},
			{}
	)
}

PerformanceTestClient.prototype.start = function() {
	this.client.connect()
}

PerformanceTestClient.prototype.state = function() {
	return {
		didConnect: this.isConnected,
		didSubscribe: this.client.subsByStream[constants.STREAM_ID][0].subscribed,
		numOfMessagesReceived: this.numOfMessagesReceived
	}
}


var clients = []

function createAndConnectClient() {
	var client = new PerformanceTestClient()
	client.start()
	clients.push(client) // Var `clients` outside scope

	if (clients.length < constants.TOTAL_CLIENTS) {
		setTimeout(createAndConnectClient,
				constants.TIMEOUT_BETWEEN_CLIENTS_IN_MILLIS)
	}
}

process.on("SIGINT", function() {
	var numOfConnects = 0
	var numOfSubscribes = 0
	var numOfMessagesReceivedPerClient = []

	clients.map(function(client) {
		return client.state()
	}).map(function(state) {
		numOfConnects += state.didConnect
		numOfSubscribes += state.didSubscribe
		numOfMessagesReceivedPerClient.push(state.numOfMessagesReceived)
	})

	console.log("Number of connects " + numOfConnects)
	console.log("Number of subscribes " + numOfSubscribes)
	console.log("Numbers of messages received " + numOfMessagesReceivedPerClient)
	process.exit()
})

createAndConnectClient()
