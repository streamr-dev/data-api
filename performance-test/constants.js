function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

// amazon.js
define("NUM_OF_EC2_INSTANCES", 2)

// client.js
define("NUM_OF_CLIENTS_PER_INSTANCE", 100)
define("SERVER_URL", "http://localhost:8890");
define("CLIENT_RAMPUP_IN_MILLIS", 10)
define("LATENCY_LOG_FILE", "latencies.csv")

// server.js
define("MESSAGE_RATE_IN_MILLIS", 100)
define("TOTAL_CLIENTS",
		(this.NUM_OF_EC2_INSTANCES - 1) * this.NUM_OF_CLIENTS_PER_INSTANCE)


// shared
define("NUM_OF_MESSAGES", 100)
define("SERVER_PORT", 8890);
define("STREAM_ID", "testStreamId");
