#!/bin/bash

DIR="$(dirname "$(readlink -f "$0")")"
SERVICE_NAME="userscripts-server"

PID_FILE=/tmp/${SERVICE_NAME}.pid
PID=$(cat "$PID_FILE" 2>/dev/null )
if [[ ! -z "$PID" ]]; then
    kill -15 "$PID"
fi

LOG_LOCATION="/var/log/${SERVICE_NAME}.log"
LOG_IS_REMOTE=1

if [[ "$LOG_IS_$REMOTE" -eq 1 ]]; then
    LOG_DIR=$(dirname "$LOG_LOCATION")
    echo "checking for log dir : $LOG_DIR"
    if [[ -L "$LOG_DIR" ]] && [[ -e "$LOG_DIR" ]]; then
        echo "log symlink is intact"
    else
        echo "log directory broken : $LOG_DIR" >&2
        exit 1
    fi
else
    mkdir -p "$(dirname "$LOG_LOCATION")"
fi


LOGROTATE_DATE_FORMAT="%Y-%m-%d"

IFS=""; while read LINE; do
echo "$LINE"
if [[ -n "$LOG_LOCATION" ]]; then
    echo "$LINE" >> "$LOG_LOCATION"
fi
done < <( /usr/bin/env node "$DIR"   2>&1 ) &

PID=$!

echo "$PID" > "$PID_FILE"

EXITING=0
bye() {
    EXITING=1
    echo "bye" >&2
    kill -15 "$PID"
    rm "$PID_FILE"
    exit 0
}
trap bye SIGINT
trap bye SIGTERM

do_my_log_rotate() {
    local OLD_DATE="$1"
    local ROTATE_FROM="$LOG_LOCATION"
    local ROTATE_TO="${ROTATE_FROM}_${OLD_DATE}.log.gz"
    echo "==> Rotating : $ROTATE_FROM → $ROTATE_TO" >&2
    cat "$ROTATE_FROM" | gzip > "$ROTATE_TO"
    echo "(log rotated)" > "$ROTATE_FROM"
}

TODAY=`date +${LOGROTATE_DATE_FORMAT}`
while true; do
    if [[ $EXITING -eq 1 ]]; then
        sleep 5
        continue
    fi

    if [[ ! -z "$LOG_LOCATION" ]]; then
        TODAY2=`date +${LOGROTATE_DATE_FORMAT}`
        if [[ "$TODAY" != "$TODAY2" ]]; then
            echo "** LOG ROTATE ($TODAY vs $TODAY2) **"
            do_my_log_rotate "$TODAY"
        fi
        TODAY="$TODAY2"
    fi

    sleep 5

    kill -0 "$PID"
    if [[ $? -ne 0 ]]; then
        bye
    fi

done
