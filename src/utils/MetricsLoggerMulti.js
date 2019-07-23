/**
 * Delegates metrics reporting calls to an array of MetricsLoggers.
 * This class should implement the same public interface as MetricsLoggerBase.
 */
module.exports = class MetricsLoggerMulti {
    constructor(metricsLoggers) {
        this.metricsLoggers = metricsLoggers
    }

    getLastVolumeStatistics() {
        return this.metricsLoggers.map((logger) => logger.getLastVolumeStatistics())
    }

    addConnection() {
        this.metricsLoggers.forEach((logger) => logger.addConnection())
    }

    removeConnection() {
        this.metricsLoggers.forEach((logger) => logger.removeConnection())
    }

    logInput(bytes) {
        this.metricsLoggers.forEach((logger) => logger.logInput(bytes))
    }

    logOutput(bytes) {
        this.metricsLoggers.forEach((logger) => logger.logOutput(bytes))
    }

    stop() {
        this.metricsLoggers.forEach((logger) => logger.stop())
    }
}
