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
