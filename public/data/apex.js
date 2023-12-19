apexCain.service('apexApi', function() {
    this.loadConfigRequest = function(url) {

        return {
           method: 'GET',
           url: "/apex/api/config.sh?"+url
           //url: "http://www.apex-timing.com/live-timing/" + url + "/javascript/config.js"
        };
    };

    this.loadSessions = function(port) {
        return { 
            method: 'POST',
            url: "/apex/api/request.sh?port="+ port + "&request=" + encodeURIComponent("S#"),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        };
    };

    this.loadSession = function(port, session) {
	return {
		method: 'POST',
		url: "/apex/api/request.sh?port="+ port + "&request=" + encodeURIComponent("S#" + session),
		headers: {'Content-Type': 'application/x-www-form-urlencoded'}
	};
    };

    this.loadChronosRequest = function(port, apexRequest) {
        return {
            method: 'POST',
            url: "/apex/api/request.sh?port="+ port +"&request=" + encodeURIComponent(apexRequest),
            //url: "http://www.apex-timing.com/live-timing/commonv2/functions/request.php",
            //data: "port=" + port + "&request=" + encodeURIComponent(apexRequest),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        };
    };

    this.loadPitRequest = function(port, apexRequest) {
        return {
            method: 'POST',
            url: "/apex/api/request.sh?port="+ port +"&request=" + encodeURIComponent(apexRequest),
            //url: "http://www.apex-timing.com/live-timing/commonv2/functions/request.php",
            //data: "port=" + port + "&request=" + encodeURIComponent(apexRequest),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        };
    };
});
