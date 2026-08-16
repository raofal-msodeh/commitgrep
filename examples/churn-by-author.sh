#!/bin/sh
# Aggregate total insertions by author in July 2026
node dist/cli.js . -s 2026-07-01 -u 2026-08-01 --format json \
  | awk -F'"' '/"authorName"/{a=$4} /"insertions"/{gsub(/[^0-9]/,"",$4); c[a]+=$4} END{for(k in c) print c[k], k}' \
  | sort -rn
