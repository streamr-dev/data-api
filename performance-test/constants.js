function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

define("SERVER_PORT", 8890);
//define("SERVER_URL", "http://localhost:8889");
define("STREAM_ID", "testStreamId");
 define("SERVER_URL", "http://dev.unifina:8890");
// define("STREAM_ID", "1ef8TbyGTFiAlZ8R2gCaJw"); // Front page demo
define("NUM_OF_MESSAGES_TO_SEND", 2000)
define("MESSAGE_RATE_IN_MILLIS", 400)
define("TOTAL_CLIENTS", 2000)
define("CLIENT_RAMPUP_IN_MILLIS", 50)
define("LATENCY_LOG_FILE", "latencies.csv")

