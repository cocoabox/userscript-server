#!/bin/bash
DIR="$(dirname "$(readlink -f "$0")")"
MOSQUITTO_COMMENT='#'
if systemctl status mosquitto-docker >/dev/null; then
  MOSQUITTO_COMMENT=''
fi

cat "$DIR"/userscript-server.service.template |
  sed 's|DIR|'$DIR'|' | sed 's|MOSQUITTO_COMMENT|'$MOSQUITTO_COMMENT'|' \
  >/etc/systemd/system/userscript-server.service
systemctl enable userscript-server

echo "starting..." >&2
systemctl restart userscript-server

echo -e "the systemd service will from now on launch the service in : `tput bold`$DIR`tput sgr0`\n" >&2
