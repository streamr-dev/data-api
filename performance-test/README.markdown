# Performance tests

This folder contains performance tests for streamr-socket-io server. Server
implementation [server.js](server.js) uses streamr-socket-io with a faked
KafkaHelper instance that emulates Kafka message occurrences.
[client.js](client.js) utilizes
[streamr-client](https://github.com/Unifina/streamr-client) to build _n_
clients that subscribe to server for messages. The clients then keep track and
log the messages they received, latency of messages and other statistics. To
configure the amount of clients, message rate, client ramp-up period etc., see
[constants.js](constants.js).


## Configuring time synchronization over NTP

When running the clients and the server on different systems, it is important
to keep the system clocks in synchronization. Otherwise server messages may
contain timestamps that are from the future from the client's perspective.
Another effect of unsynchronized time may be latency overestimation.

For example, say you are running server.js on dev.unifina. To synchronize
clients' clocks to that of the server, you should edit `/etc/ntp.conf` to
contain `server dev.unifina`. You should then restart ntpd. On OS X
`sudo killall -9 ntpd` and then `sudo ntpd`. On Linux `sudo /etc/init.d/ntpd
restart`. After restarting check status with `ntpq -p` to verify that changes
were applied.

(Apparently, you could also use `ntpd -q dev.unifina` without restarting NTP,
but this didn't work for me.)

## Configuring operating system for thousands of clients
If you're planning to open thousands of streamer clients on one machine, you
will need to tinker your [operating system
settings](http://b.oldhu.com/2012/07/19/increase-tcp-max-connections-on-mac-os-x/).
