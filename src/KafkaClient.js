const events = require('events')
const kafka = require('kafka-node')
const debug = require('debug')('KafkaClient')
const FailedToPublishError = require('./errors/FailedToPublishError')

module.exports = class KafkaClient extends events.EventEmitter {
    constructor(dataTopic, partitioner, zookeeper, kafkaDriver, kafkaProducer) {
        super()
        this.dataTopic = dataTopic
        this.partitioner = partitioner
        this.kafkaDriver = kafkaDriver || new kafka.Client(zookeeper, `streamr-kafka-producer-${Date.now()}`)

        this.kafkaDriver.on('ready', () => {
            debug('Kafka client is ready. Refreshing metadata for data topic: %s', this.dataTopic)
            this.kafkaDriver.refreshMetadata([dataTopic], (err) => {
                if (err) {
                    throw new Error(`Error while getting metadata for data topic ${this.dataTopic}: ${err}`)
                } else if (!this.kafkaDriver.topicMetadata[this.dataTopic]) {
                    throw new Error(`Falsey topic metadata for ${this.dataTopic}: ${this.kafkaDriver.topicMetadata[this.dataTopic]}`)
                }

                this.dataTopicPartitionCount = Object.keys(this.kafkaDriver.topicMetadata[this.dataTopic]).length
                debug('Got metadata for data topic: %o', this.kafkaDriver.topicMetadata[this.dataTopic])
                debug('Partition count is: %d', this.dataTopicPartitionCount)
                this.emit('ready')
            })
        })

        this.kafkaProducer = kafkaProducer || new kafka.HighLevelProducer(this.kafkaDriver)

        this.kafkaDriver.on('error', (err) => {
            throw err
        })

        this.kafkaProducer.on('error', (err) => {
            throw err
        })
    }

    send(streamrBinaryMessage) {
        return new Promise((resolve, reject) => {
            const produceRequest = {
                topic: this.dataTopic,
                // Directly set the partition using our custom partitioner for consistency with Java (KafkaService.CustomPartitioner)
                partition: this.partitioner.partition(
                    this.dataTopicPartitionCount,
                    `${streamrBinaryMessage.streamId}-${streamrBinaryMessage.streamPartition}`,
                ),
                messages: streamrBinaryMessage.toBytes(),
            }

            debug('Kafka produce request: %o', produceRequest)

            this.kafkaProducer.send([produceRequest], (err) => {
                debug('Kafka producer send callback err: ', err)

                if (err) {
                    reject(new FailedToPublishError(streamrBinaryMessage.streamId, `Producing to Kafka failed: ${err}`))
                } else {
                    resolve()
                }
            })
        })
    }
}
