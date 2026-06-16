#!/bin/bash
trap 'echo "CAUGHT SIGNAL $@" >> /home/z/my-project/signal.log' SIGTERM SIGINT SIGKILL SIGHUP SIGUSR1 SIGUSR2
NODE_OPTIONS="--max-old-space-size=2048" node /home/z/my-project/server.mjs 2>&1
echo "Server exited with code: $?" >> /home/z/my-project/signal.log
