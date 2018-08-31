const assert = require('assert')
const redis = require('redis')

const RedisClient = require('../../src/RedisClient')
const StreamrBinaryMessage = require('../../src/protocol/StreamrBinaryMessage')
const StreamrBinaryMessageWithKafkaMetadata = require('../../src/protocol/StreamrBinaryMessageWithKafkaMetadata')

describe('RedisClient', () => {
    const REDIS_HOST = '127.0.0.1'
    const REDIS_PASS = undefined

    let testRedisDriver
    let redisClient
    let streamId

    function streamrMessage() {
        const msg = new StreamrBinaryMessage(
            streamId, 1, 1488214484821, 0,
            StreamrBinaryMessage.CONTENT_TYPE_JSON, Buffer.from(JSON.stringify({
                hello: 'world',
            }), 'utf8'),
        )
        return new StreamrBinaryMessageWithKafkaMetadata(msg, 0, null, 0)
    }

    beforeEach((done) => {
        streamId = `RedisClient.test.js-${Date.now()}`

        testRedisDriver = redis.createClient({
            host: REDIS_HOST, password: REDIS_PASS,
        })
        redisClient = new RedisClient([REDIS_HOST], REDIS_PASS, done)
    })

    afterEach(() => {
        redisClient.quit()
        testRedisDriver.quit()
    })

    describe('after instantiating with a single host and password', () => {
        it('has no subscriptions entries', () => {
            assert.deepEqual(redisClient.subscriptions, {})
        })

        it('has single clientsByHost entry', () => {
            assert.deepEqual(Object.keys(redisClient.clientsByHost), [REDIS_HOST])
        })
    })

    describe('subscribe', () => {
        it('creates subscription entry', (done) => {
            redisClient.subscribe(streamId, 1, () => {
                assert.deepEqual(redisClient.subscriptions, {
                    [`${streamId}-1`]: true,
                })
                done()
            })
        })
    })

    describe('unsubscribe', () => {
        it('removes subscription entry', (done) => {
            redisClient.subscribe(streamId, 1, () => {
                assert.equal(Object.keys(redisClient.subscriptions).length, 1)

                redisClient.unsubscribe(streamId, 1, () => {
                    assert.deepEqual(redisClient.subscriptions, {})
                    done()
                })
            })
        })
    })

    describe('after subscribing', () => {
        beforeEach((done) => {
            redisClient.subscribe(streamId, 1, done)
        })

        it('emits a "message" event when receiving data from Redis', (done) => {
            const m = streamrMessage()

            redisClient.on('message', (msg) => {
                assert.deepEqual(msg, m.toArray())
                done()
            })

            testRedisDriver.publish(`${streamId}-1`, m.toBytes())
        })

        it('does not emit a "message" event for a message sent to another Redis channel', (done) => {
            redisClient.on('message', (msg) => {
                throw new Error(`Should not have received message: ${msg}`)
            })

            testRedisDriver.publish(`${streamId}-2`, streamrMessage().toBytes(), () => {
                setTimeout(done, 500)
            })
        })
    })

    describe('after subscribing and unsubscribing', () => {
        beforeEach((done) => {
            redisClient.subscribe(streamId, 1, () => {
                redisClient.unsubscribe(streamId, 1, done)
            })
        })

        it('does not emit a "message" event when receiving data from Redis', (done) => {
            redisClient.on('message', (msg) => {
                throw new Error(`Should not have received message: ${msg}`)
            })

            testRedisDriver.publish(`${streamId}-1`, streamrMessage().toBytes(), () => {
                setTimeout(done, 500)
            })
        })

        describe('after (re)subscribing', () => {
            beforeEach((done) => {
                redisClient.subscribe(streamId, 1, done)
            })

            it('emits a "message" event when receiving data from Redis', (done) => {
                const m = streamrMessage()

                testRedisDriver.publish(`${streamId}-1`, m.toBytes())
                redisClient.on('message', (msg) => {
                    assert.deepEqual(msg, m.toArray())
                    done()
                })
            })
        })
    })
})
