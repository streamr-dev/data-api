#!/usr/bin/env bash

sh ./wait-for-it.sh cassandra:9042 --timeout=120
node data-api.js \
    --data-topic ${KAFKA_TOPIC} \
    --zookeeper ${ZOOKEEPER_HOST} \
    --redis ${REDIS_HOST} \
    --redis-pwd ${REDIS_PASSWORD} \
    --cassandra ${CASSANDRA_HOST} \
    --keyspace ${CASSANDRA_KEYSPACE} \
    --streamr ${STREAMR_URL} \
    --port 8890
