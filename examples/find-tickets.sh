#!/bin/sh
# Find commits referencing JIRA-style ticket IDs that touch src/engine.ts
node dist/cli.js . -p 'TICKET-[0-9]+' -f src/engine.ts
