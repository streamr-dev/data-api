const http = require('http')

const cors = require('cors')
const express = require('express')
const ws = require('sc-uws')
const Optimist = require('optimist')

const StreamFetcher = require('./src/StreamFetcher')
const WebsocketServer = require('./src/WebsocketServer')
const RedisUtil = require('./src/RedisUtil')
const { startCassandraStorage } = require('./src/Storage')
const StreamrKafkaProducer = require('./src/KafkaUtil')
const Partitioner = require('./src/Partitioner')
const Publisher = require('./src/Publisher')
const VolumeLogger = require('./src/utils/VolumeLogger')
const dataQueryEndpoints = require('./src/rest/DataQueryEndpoints')
const dataProduceEndpoints = require('./src/rest/DataProduceEndpoints')
const volumeEndpoint = require('./src/rest/VolumeEndpoint')

module.exports = async (externalConfig) => {
    const config = (externalConfig || Optimist.usage(`You must pass the following command line options:
        --data-topic <topic>
        --zookeeper <conn_string>
        --redis <redis_hosts_separated_by_commas>
        --redis-pwd <password>
        --cassandra <cassandra_hosts_separated_by_commas>
        --cassandra-username <cassandra_username>
        --cassandra-pwd <cassandra_password>
        --keyspace <cassandra_keyspace>
        --streamr <streamr>
        --port <port>`)
        .demand(['data-topic', 'zookeeper', 'redis', 'redis-pwd', 'cassandra', 'cassandra-username', 'cassandra-pwd', 'keyspace', 'streamr', 'port'])
        .argv)

    // Create some utils
    const streamFetcher = new StreamFetcher(config.streamr)
    const redis = new RedisUtil(config.redis.split(','), config['redis-pwd'])
    const storage = await startCassandraStorage(
        config.cassandra.split(','), 'datacenter1', config.keyspace,
        config['cassandra-username'], config['cassandra-pwd'],
    )
    const kafka = new StreamrKafkaProducer(config['data-topic'], Partitioner, config.zookeeper)
    const volumeLogger = new VolumeLogger()
    const publisher = new Publisher(kafka, Partitioner, volumeLogger)

    // Create HTTP server
    const app = express()
    const httpServer = http.Server(app)

    // Add CORS headers
    app.use(cors())

    // Websocket endpoint is handled by WebsocketServer
    const websocketServer = new WebsocketServer(
        new ws.Server({
            server: httpServer,
            path: '/api/v1/ws',
            /**
             * Gracefully reject clients sending invalid headers. Without this change, the connection gets abruptly closed,
             * which makes load balancers such as nginx think the node is not healthy.
             * This blocks ill-behaving clients sending invalid headers, as well as very old websocket implementations
             * using draft 00 protocol version (https://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-00)
             */
            verifyClient: (info, cb) => {
                if (info.req.headers['sec-websocket-key']) {
                    cb(true)
                } else {
                    cb(false, 400, 'Invalid headers on websocket request. Please upgrade your browser or websocket library!')
                }
            },
        }),
        redis,
        storage,
        streamFetcher,
        publisher,
        volumeLogger,
    )

    // Rest endpoints
    app.use('/api/v1', dataQueryEndpoints(storage, streamFetcher, volumeLogger))
    app.use('/api/v1', dataProduceEndpoints(streamFetcher, publisher, volumeLogger))
    app.use('/api/v1', volumeEndpoint(volumeLogger))

    // Start the server
    httpServer.listen(config.port, () => {
        console.log(`Configured with Redis: ${config.redis}`)
        console.log(`Configured with Cassandra: ${config.cassandra}`)
        console.log(`Configured with Kafka: ${config.zookeeper} and topic '${config['data-topic']}'`)
        console.log(`Configured with Streamr: ${config.streamr}`)
        console.log(`Listening on port ${config.port}`)
        httpServer.emit('listening')
    })

    return {
        httpServer,
        websocketServer,
        close: () => {
            httpServer.close()
            redis.quit()
            storage.close()
            kafka.close()
            volumeLogger.stop()
        },
    }
}

// Start the server if we're not being required from another module
if (require.main === module) {
    module.exports()
}
