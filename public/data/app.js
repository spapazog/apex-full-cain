let apexCain = angular.module('apexCain', ['ngStorage', 'ngSanitize', 'ngCsv']);

apexCain.filter('formatTimeLarge', function($filter) {
    return function(_seconds) {
        const totalMinutes = Math.floor(_seconds / 60);

        const seconds = _seconds % 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return hours + ":" + String(minutes).padStart(2, '0') + ":" + String(seconds).padStart(2, '0');
    };
});

apexCain.filter('formatTime', function($filter) {
    return function(_seconds) {
        if (_seconds === 0.0 || _seconds === null) {
            return "";
        }

        let minutes = Math.floor(_seconds / 60);
        let seconds = Math.floor(_seconds % 60);
        let millise = _seconds.toString().split(".")[1];

        if (millise === undefined) { millise = 0; }

        if (minutes === 0) {
            return String(seconds).padStart(2, '0') + "." + String(millise).padEnd(3, '0');
        }
        return minutes + ":" + String(seconds).padStart(2, '0') + "." + String(millise).padEnd(3, '0');
    };
});