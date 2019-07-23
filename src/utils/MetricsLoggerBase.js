/**
 * A metrics logger that logs metrics to console every reportingIntervalSeconds.
 * Extend this base class and implement the _report(data) method to use some
 * other medium for logging.
 */
module.exports = class MetricsLoggerBase {
    constructor(reportingIntervalSeconds = 60, id) {
        this.reportingIntervalSeconds = reportingIntervalSeconds
        this.id = id
        this.connectionCount = 0
        this.inCount = 0
        this.inBytes = 0
        this.outCount = 0
        this.outBytes = 0
        this._lastVolumeStatistics = {}

        if (this.reportingIntervalSeconds > 0) {
            this.interval = setInterval(() => {
                this._reportAndReset()
            }, this.reportingIntervalSeconds * 1000)
        }
    }

    getLastVolumeStatistics() {
        return this._lastVolumeStatistics
    }

    addConnection() {
        this.connectionCount += 1
    }

    removeConnection() {
        this.connectionCount -= 1
    }

    logInput(bytes) {
        this.inCount += 1
        this.inBytes += bytes
    }

    logOutput(bytes) {
        this.outCount += 1
        this.outBytes += bytes
    }

    _reportAndReset() {
        const inPerSecond = this.inCount / this.reportingIntervalSeconds
        const outPerSecond = this.outCount / this.reportingIntervalSeconds
        const kbInPerSecond = (this.inBytes / this.reportingIntervalSeconds) / 1000
        const kbOutPerSecond = (this.outBytes / this.reportingIntervalSeconds) / 1000

        this._lastVolumeStatistics = {
            id: this.id,
            numOfOpenWebsockets: this.connectionCount,
            input: {
                eventsPerSecond: Math.round(inPerSecond),
                kbPerSecond: Math.round(kbInPerSecond),
            },
            output: {
                eventsPerSecond: Math.round(outPerSecond),
                kbPerSecond: Math.round(kbOutPerSecond),
            }
        }

        this.inCount = 0
        this.outCount = 0
        this.inBytes = 0
        this.outBytes = 0

        this._report(this._lastVolumeStatistics)
    }

    // eslint-disable-next-line class-methods-use-this
    _report(data) {
        console.error('Implement _report(data) in subclass!')
    }

    stop() {
        console.log('Metrics logger stopping.')
        clearInterval(this.interval)
    }
}
