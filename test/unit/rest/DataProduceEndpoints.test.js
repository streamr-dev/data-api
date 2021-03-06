const sinon = require('sinon')
const express = require('express')
const request = require('supertest')
const { StreamMessage } = require('streamr-client-protocol').MessageLayer

const router = require('../../../src/rest/DataProduceEndpoints')
const FailedToPublishError = require('../../../src/errors/FailedToPublishError')
const NotReadyError = require('../../../src/errors/NotReadyError')

describe('DataProduceEndpoints', () => {
    const stream = {
        id: 'streamId',
        partitions: 10,
    }

    let app
    let streamFetcher
    let publisherMock

    function postRequest(overridingOptions = {}) {
        const opts = Object.assign({
            streamId: 'streamId',
            body: '{}',
            key: 'authKey',
            headers: {},
            query: {},
        }, overridingOptions)

        const headers = Object.assign({
            'Content-Type': 'application/json',
            Authorization: `Token ${opts.key}`,
        }, opts.headers)

        const req = request(app)
            .post(`/streams/${opts.streamId}/data`)
        req.query(opts.query)
            .send(opts.body)

        Object.keys(headers).forEach((key) => {
            req.set(key, headers[key])
        })

        return req
    }

    beforeEach(() => {
        app = express()

        streamFetcher = {
            authenticate: sinon.stub().resolves(stream),
        }

        publisherMock = {
            publish: sinon.stub().resolves(),
            getStreamPartition: sinon.stub().returns(0),
        }

        app.use(router(streamFetcher, publisherMock))
    })

    it('should call Publisher.publish() with correct arguments', (done) => {
        const streamMessage = StreamMessage.create(
            [stream.id, 0, Date.now(), 0, 'publisherId', '1'],
            null,
            StreamMessage.CONTENT_TYPES.MESSAGE,
            StreamMessage.ENCRYPTION_TYPES.NONE,
            '{}',
            StreamMessage.SIGNATURE_TYPES.NONE,
            null,
        )
        postRequest({
            query: {
                ts: streamMessage.getTimestamp(),
                address: 'publisherId',
                msgChainId: '1',
                signatureType: streamMessage.signatureType,
                signature: streamMessage.signature,
            },
        }).expect(200).then(() => {
            sinon.assert.calledWith(publisherMock.publish, stream, streamMessage)
            done()
        })
    })

    it('should read signature-related fields', (done) => {
        const streamMessage = StreamMessage.create(
            [stream.id, 0, Date.now(), 0, 'publisherId', ''],
            null,
            StreamMessage.CONTENT_TYPES.MESSAGE,
            StreamMessage.ENCRYPTION_TYPES.NONE,
            '{}',
            StreamMessage.SIGNATURE_TYPES.ETH,
            'signature',
        )
        postRequest({
            query: {
                ts: streamMessage.getTimestamp(),
                address: 'publisherId',
                signatureType: streamMessage.signatureType,
                signature: streamMessage.signature,
            },
        }).expect(200).then(() => {
            sinon.assert.calledWith(publisherMock.publish, stream, streamMessage)
            done()
        })
    })

    it('should read sequence number and previous reference fields', (done) => {
        const streamMessage = StreamMessage.create(
            [stream.id, 0, Date.now(), 1, 'publisherId', ''],
            [325656645, 3],
            StreamMessage.CONTENT_TYPES.MESSAGE,
            StreamMessage.ENCRYPTION_TYPES.NONE,
            '{}',
            StreamMessage.SIGNATURE_TYPES.NONE,
            null,
        )
        postRequest({
            query: {
                ts: streamMessage.getTimestamp(),
                seq: streamMessage.messageId.sequenceNumber,
                prev_ts: streamMessage.prevMsgRef.timestamp,
                prev_seq: streamMessage.prevMsgRef.sequenceNumber,
                address: 'publisherId',
                signatureType: streamMessage.signatureType,
                signature: streamMessage.signature,
            },
        }).expect(200).then(() => {
            sinon.assert.calledWith(publisherMock.publish, stream, streamMessage)
            done()
        })
    })

    it('should return 200 for valid requests', (done) => {
        postRequest()
            .expect(200, done)
    })

    it('returns 503 if the publisher throws NotReadyError', (done) => {
        publisherMock.publish = sinon.stub().rejects(new NotReadyError())

        postRequest()
            .expect(503, done)
    })

    it('should return 400 if the body is empty', (done) => {
        postRequest({
            streamId: 'streamId',
            body: '',
        }).expect(400, done)
    })

    it('should return 400 for invalid timestamp', (done) => {
        postRequest({
            query: {
                ts: 'foo',
            },
        }).expect(400, done)
    })

    it('should return 400 for invalid sequence number', (done) => {
        postRequest({
            query: {
                seq: 'foo',
            },
        }).expect(400, done)
    })

    it('should return 400 for invalid sequence number (negative number)', (done) => {
        postRequest({
            query: {
                seq: '-6',
            },
        }).expect(400, done)
    })

    it('should return 400 for invalid previous timestamp', (done) => {
        postRequest({
            query: {
                prev_ts: 'foo',
            },
        }).expect(400, done)
    })

    it('should return 400 for invalid previous sequence number', (done) => {
        postRequest({
            query: {
                prev_ts: 0,
                prev_seq: 'foo',
            },
        }).expect(400, done)
    })

    it('should return 400 for invalid signature type', (done) => {
        postRequest({
            query: {
                signatureType: 'foo',
            },
        }).expect(400, done)
    })

    it('should return 413 (Payload Too Large) if body too large', (done) => {
        const body = {}
        for (let i = 0; i < 20000; ++i) {
            body[`key-${i}`] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
        }
        postRequest({
            body,
        })
            .expect(413, done)
    })

    it('returns 500 if there is an error producing to kafka', (done) => {
        publisherMock.publish = sinon.stub().rejects(new FailedToPublishError())
        postRequest()
            .expect(500, done)
    })
})
