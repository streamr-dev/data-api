const assert = require('assert')

const sinon = require('sinon')

const KafkaUtil = require('../../src/KafkaUtil')
const FailedToPublishError = require('../../src/errors/FailedToPublishError')

describe('KafkaUtil', () => {
    const dataTopic = 'dataTopic'

    let kafkaUtil
    let mockKafkaClient
    let mockKafkaProducer
    let mockZookeeper
    let mockPartitioner

    let streamMessage

    beforeEach(() => {
        mockKafkaClient = {
            topicMetadata: {
                dataTopic: {},
            },
            refreshMetadata: sinon.mock().yields(undefined),
            on: sinon.spy(),
        }
        mockKafkaProducer = {
            on: sinon.spy(),
        }
        mockZookeeper = {}
        mockPartitioner = {
            partition: sinon.stub().returns(5),
        }

        streamMessage = {
            getStreamId: sinon.stub().returns('streamId'),
            getStreamPartition: sinon.stub().returns(0),
            serialize: sinon.stub().returns('bytes'),
        }

        kafkaUtil = new KafkaUtil(dataTopic, mockPartitioner, mockZookeeper, mockKafkaClient, mockKafkaProducer)
    })

    describe('send', () => {
        it('should send an encoded message to the data topic with partitioning provided by the partitioner', (done) => {
            kafkaUtil.kafkaProducer = {
                send(arr) {
                    assert.equal(arr.length, 1)
                    assert.equal(arr[0].topic, dataTopic)
                    assert(mockPartitioner.partition.calledWith(
                        kafkaUtil.dataTopicPartitionCount,
                        `${streamMessage.getStreamId()}-${streamMessage.getStreamPartition()}`,
                    ))
                    assert.equal(arr[0].partition, 5)
                    assert.equal(arr[0].messages, 'bytes')
                    assert(streamMessage.serialize.calledOnce)
                    done()
                },
            }

            kafkaUtil.send(streamMessage)
        })

        it('should return a promise and resolve it on successful produce', () => {
            kafkaUtil.kafkaProducer = {
                send(arr, cb) {
                    cb()
                },
            }

            return kafkaUtil.send(streamMessage)
        })

        it('should reject the promise on error', (done) => {
            kafkaUtil.kafkaProducer = {
                send(arr, cb) {
                    cb('test error')
                },
            }

            kafkaUtil.send(streamMessage).catch((err) => {
                assert(err instanceof FailedToPublishError)
                assert(err.message.indexOf('test error') !== -1)
                done()
            })
        })

        it('should register error handlers for kafka client and producer', () => {
            mockKafkaClient.on.calledWith('error')
            mockKafkaProducer.on.calledWith('error')
        })
    })
})
