const http = require('http')
const cors = require('cors')
const express = require('express')
const ws = require('uws')
let optimist = require('optimist')

const StreamFetcher = require('./src/StreamFetcher')
const WebsocketServer = require('./src/WebsocketServer')
const RedisClient = require('./src/RedisClient')
const RedisOffsetFetcher = require('./src/RedisOffsetFetcher')
const CassandraClient = require('./src/CassandraClient')
const StreamrKafkaProducer = require('./src/KafkaClient')
const Partitioner = require('./src/Partitioner')
const Publisher = require('./src/Publisher')
const VolumeLogger = require('./src/utils/VolumeLogger')

// Check command line args
optimist = optimist.usage(`You must pass the following command line options:
    --data-topic <topic> 
    --zookeeper <conn_string> 
    --redis <redis_hosts_separated_by_commas> 
    --redis-pwd <password> 
    --cassandra <cassandra_hosts_separated_by_commas> 
    --keyspace <cassandra_keyspace> 
    --streamr <streamr> 
    --port <port>`)
optimist = optimist.demand(['data-topic', 'zookeeper', 'redis', 'redis-pwd', 'cassandra', 'keyspace', 'streamr', 'port'])

// Create some utils
const streamFetcher = new StreamFetcher(optimist.argv.streamr)
const redis = new RedisClient(optimist.argv.redis.split(','), optimist.argv['redis-pwd'])
const cassandra = new CassandraClient(optimist.argv.cassandra.split(','), optimist.argv.keyspace)
const redisOffsetFetcher = new RedisOffsetFetcher(optimist.argv.redis.split(',')[0], optimist.argv['redis-pwd'])
const kafka = new StreamrKafkaProducer(optimist.argv['data-topic'], Partitioner, optimist.argv.zookeeper)
const publisher = new Publisher(kafka, Partitioner)
const volumeLogger = new VolumeLogger()

// Create HTTP server
const app = express()
const httpServer = http.Server(app)

// Add CORS headers
app.use(cors())

// Websocket endpoint is handled by WebsocketServer
const server = new WebsocketServer(
    new ws.Server({
        server: httpServer,
        path: '/api/v1/ws',
    }),
    redis,
    cassandra,
    redisOffsetFetcher,
    streamFetcher,
    publisher,
    volumeLogger,
)

// Rest endpoints
app.use('/api/v1', require('./src/rest/DataQueryEndpoints')(cassandra, streamFetcher, volumeLogger))
app.use('/api/v1', require('./src/rest/DataProduceEndpoints')(streamFetcher, publisher, volumeLogger))

// Start the server
httpServer.listen(optimist.argv.port, () => {
    console.log(`Configured with Redis: ${optimist.argv.redis}`)
    console.log(`Configured with Cassandra: ${optimist.argv.cassandra}`)
    console.log(`Configured with Kafka: ${optimist.argv.zookeeper} and topic '${optimist.argv['data-topic']}'`)
    console.log(`Configured with Streamr: ${optimist.argv.streamr}`)
    console.log(`Listening on port ${optimist.argv.port}`)
})
