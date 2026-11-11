#!/usr/bin/env bash
# Download the MakeHuman base mesh + the head targets used by build.py (CC0 1.0 Universal).
set -e
cd "$(dirname "$0")/src"
B=https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data
mkdir -p targets
curl -sfo base.obj "$B/3dobjs/base.obj"
curl -sfo modeling_modifiers.json "$B/modifiers/modeling_modifiers.json"
for t in $(cat ../targets.txt); do curl -sfo "targets/$(echo "$t" | tr / _).target" "$B/targets/$t.target"; done
echo "fetched $(ls targets | wc -l) targets"
