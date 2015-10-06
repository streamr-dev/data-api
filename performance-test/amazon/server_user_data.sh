su ubuntu <<'EOF'
screen -S 'server' -d -m nodejs /home/ubuntu/streamr-socketio-server/performance-test/server.js
sleep 2
sudo prlimit --pid $(pgrep node) --nofile=32000:50000
EOF

