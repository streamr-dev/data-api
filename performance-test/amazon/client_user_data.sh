su - ubuntu <<'EOF'
SERVER='<SERVER>' screen -S 'client' -L -d -m sh -c 'node /home/ubuntu/streamr-socketio-server/performance-test/client.js > /home/ubuntu/log.out; exec bash'
EOF

