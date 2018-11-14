const events = require('events')
const debug = require('debug')('Connection')

module.exports = class Connection extends events.EventEmitter {
    constructor(socket) {
        super()
        this.id = socket.id
        this.socket = socket
        this.streams = []
        this.preferredPayloadVersion = Connection.getVersionFromUrl(socket.upgradeReq.url)
    }

    static getVersionFromUrl(url) {
        const parts = url.split('?')
        if (parts.length < 2) {
            return undefined
        }
        const queryString = parts[1]
        const vars = queryString.split('&')
        let i
        for (i = 0; i < vars.length; i++) {
            const pair = vars[i].split('=')
            if (pair[0] === 'version') {
                return parseInt(pair[1])
            }
        }
        return undefined
    }

    addStream(stream) {
        this.streams.push(stream)
    }

    removeStream(streamId, streamPartition) {
        let i
        for (i = 0; i < this.streams.length; i++) {
            if (this.streams[i].id === streamId && this.streams[i].partition === streamPartition) {
                break
            }
        }
        if (i < this.streams.length) {
            this.streams.splice(i, 1)
        }
    }

    getStreams() {
        return this.streams.slice() // return copy
    }

    send(msg) {
        let serialized
        if (this.preferredPayloadVersion) {
            serialized = msg.serialize(0, this.preferredPayloadVersion)
        } else {
            serialized = msg.serialize()
        }
        debug('send: %s: %o', this.id, serialized)
        this.socket.send(serialized)
    }
}
