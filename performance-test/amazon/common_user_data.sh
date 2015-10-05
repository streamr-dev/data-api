#!/bin/bash
apt-get --assume-yes install nodejs nodejs-legacy awscli npm rdate
su ubuntu <<'EOF'
mkdir -p /home/ubuntu/.aws
printf "<CREDENTIALS>" > /home/ubuntu/.aws/credentials
aws s3api get-object --bucket streamr-socketio-stresstest --key stress-test.tar.gz /home/ubuntu/stress-test.tar.gz
(cd /home/ubuntu && tar -xvvf stress-test.tar.gz)
(cd /home/ubuntu/streamr-socketio-server && rm -rf node_modules)
(cd /home/ubuntu/streamr-socketio-server && npm install)
EOF
echo "* soft nofile 64000" >> /etc/security/limits.conf
echo "* hard nofile 64000" >> /etc/security/limits.conf
sudo sysctl -w net.core.somaxconn=64000
