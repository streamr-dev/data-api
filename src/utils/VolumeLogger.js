const StreamrClient = require('streamr-client')

module.exports = class VolumeLogger {
    constructor(id, reportingIntervalSeconds = 60, apiKey = undefined, streamId = undefined) {
        this.reportingIntervalSeconds = reportingIntervalSeconds
        this.connectionCount = 0
        this.inCount = 0
        this.inBytes = 0
        this.outCount = 0
        this.outBytes = 0
        this.lastVolumeStatistics = {}
        this.id = id
        this.client = new StreamrClient({
            auth: {
                apiKey
            }
        })
        this.streamId = streamId

        if (this.reportingIntervalSeconds > 0) {
            this.interval = setInterval(() => {
                this.reportAndReset()
            }, this.reportingIntervalSeconds * 1000)
        }
    }

    logInput(bytes) {
        this.inCount += 1
        this.inBytes += bytes
    }

    logOutput(bytes) {
        this.outCount += 1
        this.outBytes += bytes
    }

    reportAndReset() {
        const inPerSecond = this.inCount / this.reportingIntervalSeconds
        const outPerSecond = this.outCount / this.reportingIntervalSeconds
        const kbInPerSecond = (this.inBytes / this.reportingIntervalSeconds) / 1000
        const kbOutPerSecond = (this.outBytes / this.reportingIntervalSeconds) / 1000

        const msg = `Connections: ${this.connectionCount}, Messages in/sec: ${inPerSecond < 10 ? inPerSecond.toFixed(1) : Math.round(inPerSecond)},`
                    + ` Messages out/sec: ${outPerSecond < 10 ? outPerSecond.toFixed(1) : Math.round(outPerSecond)}`

        console.log(msg)

        this.lastVolumeStatistics = {
            id: this.id,
            lastMsg: msg,
            timestamp: Date.now(),
            numOfOpenWebsockets: this.connectionCount,
            input: {
                eventsPerSecond: Math.round(inPerSecond),
                kbPerSecond: Math.round(kbInPerSecond),
            },
            output: {
                eventsPerSecond: Math.round(outPerSecond),
                kbPerSecond: Math.round(kbOutPerSecond),
            },
            inPerSecond: inPerSecond < 10 ? inPerSecond.toFixed(1) : Math.round(inPerSecond),
            outPerSecond: outPerSecond < 10 ? outPerSecond.toFixed(1) : Math.round(outPerSecond)
        }

        this.inCount = 0
        this.outCount = 0
        this.inBytes = 0
        this.outBytes = 0

        this._sendReport({
            'data-api': this.lastVolumeStatistics
        })
    }

    _sendReport(data) {
        if (this.client instanceof StreamrClient && this.streamId !== undefined) {
            this.client.publish(this.streamId, data)
        }
    }

    stop() {
        console.log('VolumeLogger stopping.')
        clearInterval(this.interval)
    }
}
