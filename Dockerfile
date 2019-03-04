# Use official node runtime as base image
FROM node:8.11.4-alpine

RUN apk update
RUN apk add bash

# Set the working directory to /app
WORKDIR /app

# Copy app code
COPY . /app

# Install package.json dependencies (yes, clean up must be part of same RUN command because of layering)
RUN apk add --update python build-base && npm install && apk del python build-base && rm -rf /var/cache/apk/*

# Make port 8890 available to the world outside this container
EXPOSE 8890

# Default environment variables
ENV ZOOKEEPER_HOST zookeeper
ENV KAFKA_TOPIC data-dev
ENV REDIS_HOST redis
ENV REDIS_PASSWORD ""
ENV CASSANDRA_HOST cassandra
ENV CASSANDRA_KEYSPACE streamr_dev
ENV STREAMR_URL http://127.0.0.1:8081/streamr-core

# Wait for Cassandra to be ready
CMD ["sh", "-c", "./docker-start.sh"]
