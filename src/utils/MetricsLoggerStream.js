const StreamrClient = require('streamr-client')

const MetricsLoggerBase = require('./MetricsLoggerBase')

/**
 * A metrics logger that logs metrics to a Streamr stream.
 */
module.exports = class MetricsLoggerStream extends MetricsLoggerBase {
    constructor(reportingIntervalSeconds = 60, id, apiKey, streamId) {
        super(reportingIntervalSeconds, id)

        if (apiKey && streamId) {
            this.client = new StreamrClient({
                auth: {
                    apiKey
                }
            })
            this.streamId = streamId
        }
    }

    _report(data) {
        if (this.client) {
            this.client.publish(this.streamId, data)
        }
    }
}
