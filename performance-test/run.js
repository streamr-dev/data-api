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
				console.log("*")
			},

			{
				// Resend options
			}
	)
}

PerformanceTestClient.prototype.start = function() {
	this.client.connect()
}

PerformanceTestClient.prototype.printStatus = function() {
	console.log({
		didConnect: this.isConnected,
		didSubscribe: this.client.subsByStream[streamId][0].subscribed,
		numOfMessagesReceived: this.numOfMessagesReceived
	})
}


var client = new PerformanceTestClient()
client.start()

process.on("SIGINT", function() {
	client.printStatus()
	process.exit()
})

