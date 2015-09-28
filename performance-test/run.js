global.io = require("socket.io-client")
var StreamrClient = require("./lib/streamr-client/streamr-client.js").StreamrClient


var serverUrl = "http://dev.unifina:8889"
var streamId = "1ef8TbyGTFiAlZ8R2gCaJw"


function PerformanceTestClient() {
	this.isConnected = false
	this.isSubscribed = false
	this.numOfMessagesReceived = 0

	var that = this;

	this.client = new StreamrClient({
		server: serverUrl,
		autoConnect: false,
		autoDisconnect: true
	})

	this.client.bind("connected", function() {
		that.isConnected = true;
	})

	this.client.subscribe(
			streamId,

			function (message, streamId, counter) {
				++that.numOfMessagesReceived
				//console.log("*")
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
		didSubscribe: this.client.subsByStream[streamId][0].subscribed,
		numOfMessagesReceived: this.numOfMessagesReceived
	}
}

var clients = []

for (var i=0; i < 300; ++i) {
	var client = new PerformanceTestClient()
	client.start()
	clients.push(client)
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

