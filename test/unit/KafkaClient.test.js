const assert = require('assert')
const sinon = require('sinon')
const KafkaClient = require('../../src/KafkaClient')
const FailedToPublishError = require('../../src/errors/FailedToPublishError')

describe('KafkaClient', () => {
    const dataTopic = 'dataTopic'

    let kafkaClient
    let mockKafkaDriver
    let mockKafkaProducer
    let mockZookeeper
    let mockPartitioner

    let streamrBinaryMessage

    beforeEach(() => {
        mockKafkaDriver = {
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

        streamrBinaryMessage = {
            streamId: 'streamId',
            streamPartition: 0,
            toBytes: sinon.stub().returns('bytes'),
        }

        kafkaClient = new KafkaClient(dataTopic, mockPartitioner, mockZookeeper, mockKafkaDriver, mockKafkaProducer)
    })

    describe('send', () => {
        it('should send an encoded message to the data topic with partitioning provided by the partitioner', (done) => {
            kafkaClient.kafkaProducer = {
                send(arr) {
                    assert.equal(arr.length, 1)
                    assert.equal(arr[0].topic, dataTopic)
                    assert(mockPartitioner.partition.calledWith(
                        kafkaClient.dataTopicPartitionCount,
                        `${streamrBinaryMessage.streamId}-${streamrBinaryMessage.streamPartition}`,
                    ))
                    assert.equal(arr[0].partition, 5)
                    assert.equal(arr[0].messages, 'bytes')
                    assert(streamrBinaryMessage.toBytes.calledOnce)
                    done()
                },
            }

            kafkaClient.send(streamrBinaryMessage)
        })

        it('should return a promise and resolve it on successful produce', () => {
            kafkaClient.kafkaProducer = {
                send(arr, cb) {
                    cb()
                },
            }

            return kafkaClient.send(streamrBinaryMessage)
        })

        it('should reject the promise on error', (done) => {
            kafkaClient.kafkaProducer = {
                send(arr, cb) {
                    cb('test error')
                },
            }

            kafkaClient.send(streamrBinaryMessage).catch((err) => {
                assert(err instanceof FailedToPublishError)
                assert(err.message.indexOf('test error') !== -1)
                done()
            })
        })

        it('should register error handlers for kafka client and producer', () => {
            mockKafkaDriver.on.calledWith('error')
            mockKafkaProducer.on.calledWith('error')
        })
    })
})
