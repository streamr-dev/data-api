#!/bin/bash
apt-get --assume-yes install awscli npm
mkdir .aws
printf "<CREDENTIALS>" > .aws/credentials
aws s3api get-object --bucket streamr-socketio-stresstest --key stress-test.tar.gz stress-test.tar.gz
