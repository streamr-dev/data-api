const MetricsLoggerBase = require('./MetricsLoggerBase')

const formatNumber = (number) => {
    return number < 10 ? number.toFixed(1) : Math.round(number).toString()
}

/**
 * A metrics logger that logs metrics to console
 */
module.exports = class MetricsLoggerStream extends MetricsLoggerBase {
    constructor(reportingIntervalSeconds = 60, id) {
        super(reportingIntervalSeconds, id)
    }

    // eslint-disable-next-line class-methods-use-this
    _report(data) {
        const msg = `Connections: ${data.numOfOpenWebsockets}, Messages in/sec: ${formatNumber(data.input.eventsPerSecond)},`
            + ` Messages out/sec: ${formatNumber(data.output.eventsPerSecond)}`

        console.log(msg)
    }
}
