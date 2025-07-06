#!/bin/bash
DIR="$(dirname "$(readlink -f "$0")")"

PID_FILE=/tmp/userscripts-server.pid
PID=$(cat "$PID_FILE")
if [[ ! -z "$PID" ]]; then
    kill -15 "$PID"
    rm "$PID_FILE"
fi
