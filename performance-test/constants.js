function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

// amazon.js
define("NUM_OF_EC2_INSTANCES", 3)

// client.js
define("NUM_OF_CLIENTS_PER_INSTANCE", 100)
define("SERVER_URL", "http://dev.unifina:8890");
define("CLIENT_RAMPUP_IN_MILLIS", 100)
define("LATENCY_LOG_FILE", "latencies.csv")

// server.js
define("NUM_OF_MESSAGES_TO_SEND", 2000)
define("MESSAGE_RATE_IN_MILLIS", 400)
define("TOTAL_CLIENTS",
		(this.NUM_OF_EC2_INSTANCES - 1) * this.NUM_OF_CLIENTS_PER_INSTANCE)


// shared
define("SERVER_PORT", 8890);
define("STREAM_ID", "testStreamId");
