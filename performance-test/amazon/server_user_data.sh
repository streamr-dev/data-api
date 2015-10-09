su - ubuntu <<'EOF'
screen -S 'server' -L -d -m node --nouse-idle-notification --expose-gc --max-old-space-size=15000 /home/ubuntu/streamr-socketio-server/performance-test/server.js > log.out
sleep 2
sudo prlimit --pid $(pgrep node) --nofile=32000:50000
EOF

