function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

define("SERVER_PORT", 8889);
define("SERVER_URL", "http://localhost:8889");
define("STREAM_ID", "testStreamId");
// define("SERVER_URL", "http://dev.unifina:8889");
// define("STREAM_ID", "1ef8TbyGTFiAlZ8R2gCaJw"); // Front page demo
define("NUM_OF_MESSAGES_TO_SEND", 5000)
define("MESSAGE_RATE_IN_MILLIS", 0)
define("TOTAL_CLIENTS", 1000)
define("CLIENT_RAMPUP_IN_MILLIS", 5)

