#!/bin/bash
apt-get --assume-yes install nodejs nodejs-legacy awscli npm rdate
npm cache clean -f
npm install -g n
n "v4.1.0"
ln -sf /usr/local/n/versions/node/*/bin/node /usr/bin/node
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
ntpdate 0.amazon.pool.ntp.org
