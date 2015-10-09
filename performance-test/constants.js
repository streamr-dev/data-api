function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

// amazon.js
define("NUM_OF_EC2_INSTANCES", 21)

// client.js
define("NUM_OF_CLIENTS_PER_INSTANCE", 1000)
define("SERVER_URL", "http://localhost:8890");
define("CLIENT_RAMPUP_IN_MILLIS", 200)
define("LATENCY_LOG_FILE", "latencies.csv")

// server.js
define("MESSAGE_RATE_IN_MILLIS", 1000)
define("TOTAL_CLIENTS",
		(this.NUM_OF_EC2_INSTANCES - 1) * this.NUM_OF_CLIENTS_PER_INSTANCE)


// shared
define("NUM_OF_MESSAGES", 1000)
define("SERVER_PORT", 8890);
define("STREAM_ID", "testStreamId");
