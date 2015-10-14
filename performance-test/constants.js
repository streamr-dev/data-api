function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

// amazon.js
define("NUM_OF_EC2_INSTANCES", 11)

// client.js
define("NUM_OF_CLIENTS_PER_INSTANCE", 100)
define("SERVER_URL", "http://localhost:8890")
define("CLIENT_RAMPUP_IN_MILLIS", 100)

// server.js / server-with-kafka.js / data-generator.js
define("KAFKA_URL", "10.0.0.112:2181")
define("TOTAL_CLIENTS",
		(this.NUM_OF_EC2_INSTANCES - 1) * this.NUM_OF_CLIENTS_PER_INSTANCE)
define("MESSAGE_RATE_IN_MILLIS", 300)

// shared
define("LATENCY_LOG_FILE", "latencies.csv")
define("NUM_OF_MESSAGES", 1000)
define("SERVER_PORT", 8890);
define("STREAM_IDS", ["testStreamId"]);
