#!/bin/zsh
export VOICE_INBOX_URL="https://voice-inbox-two.vercel.app"
export VOICE_INBOX_TOKEN="$(/usr/bin/security find-generic-password -a "harshitsinghbhandari" -s "voice-inbox-token" -w)"
exec /opt/homebrew/bin/node "/Users/harshitsinghbhandari/Library/Application Support/Voice Inbox/index.mjs"
