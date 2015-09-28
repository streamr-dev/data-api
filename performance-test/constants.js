function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

define("SERVER_PORT", 8889);
define("SERVER_URL", "http://localhost:8889");
define("STREAM_ID", "testStreamId");
define("NUM_OF_MESSAGES_TO_SEND", 60)
define("MESSAGE_RATE_IN_MILLIS", 500)
define("TOTAL_CLIENTS", 10)

// define("SERVER_URL", "http://dev.unifina:8889");
// define("STREAM_ID", "1ef8TbyGTFiAlZ8R2gCaJw"); // Front page demo
