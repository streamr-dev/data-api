function define(name, value) {
	Object.defineProperty(exports, name, {
		value:      value,
		enumerable: true
	});
}

// amazon.js
define("NUM_OF_EC2_INSTANCES", 2)

// client.js
define("NUM_OF_CLIENTS_PER_INSTANCE", 1)
define("SERVER_URL", "http://localhost:8890")
define("CLIENT_RAMPUP_IN_MILLIS", 15)

// server.js / server-with-kafka.js / data-generator.js
define("KAFKA_URL", "dev.unifina:2181")
define("TOTAL_CLIENTS",
		(this.NUM_OF_EC2_INSTANCES - 1) * this.NUM_OF_CLIENTS_PER_INSTANCE)
define("MESSAGE_RATE_IN_MILLIS", 15000)

// shared
define("LATENCY_LOG_FILE", "latencies.csv")
define("NUM_OF_MESSAGES", 1000)
define("SERVER_PORT", 8890);
define("STREAM_ID", "testStreamId");
