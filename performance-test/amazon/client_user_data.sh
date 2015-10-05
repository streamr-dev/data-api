su - ubuntu <<'EOF'
sudo rdate -s tick.greyware.com
SERVER='<SERVER>' screen -S 'client' -L -d -m sh -c 'nodejs /home/ubuntu/streamr-socketio-server/performance-test/client.js > /home/ubuntu/log.out; exec bash'
EOF

