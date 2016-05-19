var SocketIoServer = require('./lib/socketio-server').SocketIoServer

var StreamrStreamCache = require('./lib/streamr-http-api/lib/cache')
var StreamrStreamMetrics = require('./lib/streamr-http-api/lib/streamMetrics')
var StreamrMetrics = require('./lib/streamr-http-api/lib/metrics')
var StreamrKafkaProducer = require('./lib/streamr-http-api/lib/kafka')

var argv = require('optimist')
	.usage('Usage: $0 --zookeeper <conn_string> --port <port> [--db_host <db_host> --db_name <db_name> --db_user <db_user> --db_password <db_password>]\n\n  db_* arguments are required for reporting metrics')
	.demand(['zookeeper', 'port'])
	.argv;

var metrics
if (argv.db_host && argv.db_name && argv.db_user && argv.db_password) {
	var kafka = new StreamrKafkaProducer(argv.zookeeper)
	var cache = new StreamrStreamCache(argv.db_host, argv.db_name, argv.db_user, argv.db_password)
	var metrics = new StreamrMetrics(kafka)
	metrics = new StreamrStreamMetrics(metrics, cache)
}

var server = new SocketIoServer(argv.zookeeper, parseInt(argv.port), undefined, undefined, metrics)

console.log("Server started on port "+argv.port)