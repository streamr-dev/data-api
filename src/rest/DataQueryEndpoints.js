/**
 * Endpoints for RESTful data requests
 */
const express = require('express')
const { MessageRef } = require('streamr-client-protocol').MessageLayer

const MetricsLoggerConsole = require('../utils/MetricsLoggerConsole')

const authenticationMiddleware = require('./RequestAuthenticatorMiddleware')

function onDataFetchDone(res, dataPoints, wrapper, content, volumeLogger) {
    return (err) => {
        if (err) {
            console.log(err)
            res.status(500).send({
                error: 'Failed to fetch data!',
            })
        } else {
            let volumeBytes = 0
            res.send(dataPoints.map((streamMessage) => {
                volumeBytes += streamMessage.getSerializedContent().length
                return streamMessage.serialize(streamMessage.version, {
                    stringify: false,
                    parsedContent: content === 'json',
                    compact: wrapper !== 'object',
                })
            }))
            volumeLogger.logOutput(volumeBytes)
        }
    }
}

function parseIntIfExists(x) {
    return x === undefined ? undefined : parseInt(x, 10)
}

module.exports = (storage, streamFetcher, volumeLogger = new MetricsLoggerConsole(0)) => {
    const router = express.Router()

    router.use(
        '/streams/:id/data/partitions/:partition',
        // partition parsing middleware
        (req, res, next) => {
            if (Number.isNaN(parseInt(req.params.partition, 10))) {
                res.status(400).send({
                    error: `Path parameter "partition" not a number: ${req.params.partition}`,
                })
            } else {
                next()
            }
        },
        // authentication
        authenticationMiddleware(streamFetcher, 'read'),
    )

    router.get('/streams/:id/data/partitions/:partition/last', (req, res) => {
        const partition = parseInt(req.params.partition, 10)
        const count = req.query.count === undefined ? 1 : parseInt(req.query.count, 10)
        const wrapperOption = req.query.wrapper || 'array'
        const contentOption = req.query.content || 'string'

        if (Number.isNaN(count)) {
            res.status(400).send({
                error: `Query parameter "count" not a number: ${req.query.count}`,
            })
        } else {
            const dataPoints = []
            const streamingData = storage.fetchLatest(
                req.params.id,
                partition,
                count,
            )
            streamingData.on('error', onDataFetchDone(res))
            streamingData.on('data', dataPoints.push.bind(dataPoints))
            streamingData.on('end', onDataFetchDone(res, dataPoints, wrapperOption.toLowerCase(), contentOption.toLowerCase(), volumeLogger))
        }
    })

    router.get('/streams/:id/data/partitions/:partition/from', (req, res) => {
        const partition = parseInt(req.params.partition, 10)
        const wrapper = req.query.wrapper || 'array'
        const content = req.query.content || 'string'
        const fromTimestamp = parseIntIfExists(req.query.fromTimestamp)
        const fromSequenceNumber = parseIntIfExists(req.query.fromSequenceNumber)
        const { publisherId } = req.query

        if (fromTimestamp === undefined) {
            res.status(400).send({
                error: 'Query parameter "fromTimestamp" required.',
            })
        } else if (Number.isNaN(fromTimestamp)) {
            res.status(400).send({
                error: `Query parameter "fromTimestamp" not a number: ${req.query.fromTimestamp}`,
            })
        } else {
            const dataPoints = []
            let streamingData
            if (fromSequenceNumber && publisherId) {
                streamingData = storage.fetchFromMessageRefForPublisher(
                    req.params.id,
                    partition,
                    new MessageRef(fromTimestamp, fromSequenceNumber),
                    publisherId,
                )
            } else {
                streamingData = storage.fetchFromTimestamp(
                    req.params.id,
                    partition,
                    fromTimestamp,
                )
            }
            streamingData.on('error', onDataFetchDone(res))
            streamingData.on('data', dataPoints.push.bind(dataPoints))
            streamingData.on('end', onDataFetchDone(res, dataPoints, wrapper, content, volumeLogger))
        }
    })

    router.get('/streams/:id/data/partitions/:partition/range', (req, res) => {
        const partition = parseInt(req.params.partition, 10)
        const wrapper = req.query.wrapper || 'array'
        const content = req.query.content || 'string'
        const fromTimestamp = parseIntIfExists(req.query.fromTimestamp)
        const toTimestamp = parseIntIfExists(req.query.toTimestamp)
        const fromSequenceNumber = parseIntIfExists(req.query.fromSequenceNumber)
        const toSequenceNumber = parseIntIfExists(req.query.toSequenceNumber)
        const { publisherId } = req.query

        if (req.query.fromOffset !== undefined || req.query.toOffset !== undefined) {
            res.status(400).send({
                error: 'Query parameters "fromOffset" and "toOffset" are no longer supported. Please use "fromTimestamp" and "toTimestamp".',
            })
        } else if (fromTimestamp === undefined) {
            res.status(400).send({
                error: 'Query parameter "fromTimestamp" required.',
            })
        } else if (Number.isNaN(fromTimestamp)) {
            res.status(400).send({
                error: `Query parameter "fromTimestamp" not a number: ${req.query.fromTimestamp}`,
            })
        } else if (toTimestamp === undefined) {
            res.status(400).send({
                error: 'Query parameter "toTimestamp" required as well. To request all messages since a timestamp,'
                    + 'use the endpoint /streams/:id/data/partitions/:partition/from',
            })
        } else if (Number.isNaN(toTimestamp)) {
            res.status(400).send({
                error: `Query parameter "toTimestamp" not a number: ${req.query.toTimestamp}`,
            })
        } else {
            const dataPoints = []
            let streamingData
            if (fromSequenceNumber && toSequenceNumber && publisherId) {
                streamingData = storage.fetchBetweenMessageRefsForPublisher(
                    req.params.id,
                    partition,
                    new MessageRef(fromTimestamp, fromSequenceNumber),
                    new MessageRef(toTimestamp, toSequenceNumber),
                    publisherId,
                )
            } else {
                streamingData = storage.fetchBetweenTimestamps(
                    req.params.id,
                    partition,
                    fromTimestamp,
                    toTimestamp,
                )
            }
            streamingData.on('error', onDataFetchDone(res))
            streamingData.on('data', dataPoints.push.bind(dataPoints))
            streamingData.on('end', onDataFetchDone(res, dataPoints, wrapper, content, volumeLogger))
        }
    })

    return router
}
