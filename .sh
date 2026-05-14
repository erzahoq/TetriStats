#!/bin/bash
echo "Starting.."
while true
do
    node deploy/deployCommands.js
    node index.js
    echo "Restarting.."
done
