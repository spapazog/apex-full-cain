#!/bin/sh

printf '%s\n\n' 'Content-type: text/html'

curl -X POST http://www.apex-timing.com/live-timing/commonv2/functions/request.php -H "Content-Type: application/x-www-form-urlencoded" -d $QUERY_STRING
