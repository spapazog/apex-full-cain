#!/bin/sh

printf '%s\n\n' 'Content-type: text/html'

curl "http://www.apex-timing.com/live-timing/$QUERY_STRING/javascript/config.js"
