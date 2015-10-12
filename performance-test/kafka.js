var kafka = require('kafka-node')
var BufferMaker = require('buffermaker')

function StreamrKafkaProducer(zookeeper, kafkaClient, kafkaProducer, encoder) {
	this.kafkaClient = kafkaClient || new kafka.Client(zookeeper)
	this.kafkaProducer = kafkaProducer || new kafka.HighLevelProducer(this.kafkaClient)

	// Default encoder adds metadata readable by the java UnifinaKafkaConsumer
	this.encode = encoder || function(message, timestamp) {
		var buf = new BufferMaker()
			.Int8(27) // version
			.Int64BE(timestamp) // timestamp
			.Int8(27) // format: json
			.string(JSON.stringify(message))
			.make()

		return buf
	}
}

StreamrKafkaProducer.prototype.send = function(stream, message, timestamp, cb) {
	timestamp = timestamp || Date.now()

	this.kafkaProducer.send([{
		topic: stream,
		messages: this.encode(message, timestamp)
	}], function(err) {
		if (err) {
			console.log("Error producing to Kafka: "+err)
		}
		if (cb)
			cb(err)
	})
}

module.exports = StreamrKafkaProducer
