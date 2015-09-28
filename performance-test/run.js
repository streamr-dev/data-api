global.io = require("socket.io-client")
var StreamrClient = require("./lib/streamr-client/streamr-client.js").StreamrClient

var client = new StreamrClient({
	server: "http://dev.unifina:8889",
	autoConnect: true,
	autoDisconnect: true
})

client.subscribe(
		"1ef8TbyGTFiAlZ8R2gCaJw",
		function (message, streamId, counter) {
			console.log("msg" + message)
		},
		{
			// Resend options
		}
)

client.connect()

console.log("Hello world!")

