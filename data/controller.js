apexCain.controller('homeController',
    ['$scope', '$http', '$timeout', '$location', '$localStorage', '$sce', 'apexTracks', 'apexApi', function ($scope, $http, $timeout, $location, $localStorage, $sce, apexTracks, apexApi) {
        /***** Settings management *****/
        $scope.defaultSettings = function () {
            return {
                fontSize: 14,
                paceNbLaps: 50,
                retrieveNbLaps: 150,
                raceHomogeneity: 1.025,
                displayTrack: true,
                displaySectors: true,
                displayBestLap: true,
                displayNumber: false,
                displayLapNb: true,
                displayPace: true,
                displayDriver: true,
                enableSound: false,
                teamNumber: 0,
                soundLang: "fr"
            };
        }

        $scope.settings = $localStorage.$default($scope.defaultSettings());
        $scope.resetSettings = function () {
            $localStorage.$reset();
            $scope.settings = $localStorage.$default($scope.defaultSettings());
        }

        /***** Track management *****/
        $scope.port = false;
        $scope.config = false;
        $scope.session = "";
        $scope.sessions = [];
        $scope.tracks = apexTracks.getTracks();
        $scope.showTrackSelection = false;
        $scope.selectedTrack = {
            name: "",
            id: "",
            url: "",
            pitTime: 0,
            hasShorterPitEntry: false,
            hasShorterPitExit: false,
            rotation: 0,
            trackSvg: "",
            startSvg: "",
            pitSvg: ""
        };

        /***** Countdown functions *****/
        $scope.countdown = function () {
            $timeout(function () {
                // Manage remaining time each seconds
                if ($scope.remainingTime > 0) {
                    $scope.remainingTime--;
                }

                // Manage the timeout for disconnection information
                if ($scope.isSessionUnderway()) {
                    if ($scope.timeoutCountdown > 0) {
                        $scope.timeoutCountdown--;
                    } else {
                        console.log("DISCONNECTED FROM TIMEOUT !!!");
                    }
                }

                $scope.countdown();
            }, 1000);
        };
        // Start countdown
        $scope.countdown();

        /***** Session function *****/
        $scope.resetSession = function () {
            // Init all columns
            $scope.idState = false;
            $scope.idRank = false;
            $scope.idKart = false;
            $scope.idDriver = false;
            $scope.idLastLap = false;
            $scope.idBestLap = false;
            $scope.idGap = false;
            $scope.idNbLaps = false;
            $scope.idSpeed = false;
            $scope.idInterval = false;
            $scope.idSector1 = false;
            $scope.idSector2 = false;
            $scope.idSector3 = false;
            $scope.idPits = false;
            $scope.idDeltaPos = false;
            $scope.idNation = false;
            $scope.idOnTrack = false;
            $scope.idPenalty = false;
            $scope.idCategory = false;

            // Init general information
            $scope.session = "";
            $scope.title = "";
            $scope.subtitle = "";
            $scope.remainingTime = false;
            $scope.timeoutCountdown = false;
            $scope.highlightMessage = "";
            $scope.raceState = "";
            $scope.dyn1 = "";
            $scope.dyn2 = "";
            $scope.comments = "";
            $scope.categories = {};
            $scope.karts = [];
            $scope.kartsMap = {};

            // Close previously opened APEX web socket
            if (typeof $scope.ws !== "undefined") {
                $scope.ws.close();
            }
        };

        $scope.initSession = function(id, data) {
            // Save session id if not live timing
            if (id) {
                $scope.session = "S#"+id+"#";
            }

            //console.log(data);
            // Look for 'grid' element which contains all necessary data (drivers, positions, ...)
            for (const element of data) {
                if (element.indexOf('title1||') >= 0) {
                    $scope.title = element.replace("title1||", "");
                }
                if (element.indexOf('title2||') >= 0) {
                    $scope.subtitle = element.replace("title2||", "");
                }
                if (element.indexOf('light|') >= 0) {
                    $scope.raceState = element.replace("light|", "").replace("|", "");
                }
                if (element.indexOf('dyn1|text|') >= 0) {
                    $scope.dyn1 = element.replace("dyn1|text|", "");
                }
                if (element.indexOf('dyn2|text|') >= 0) {
                    $scope.dyn2 = element.replace("dyn2|text|", "");
                }
                if (element.indexOf('track||') >= 0) {
                    let track = element.replace("track||", "");

                    if (track !== "") {
                        $scope.selectedTrack.apexName = track;
                    }
                }
                if (element.indexOf('com||') >= 0) {
                    $scope.comments = $sce.trustAsHtml(element.replace("com||", ""));
                }
                if (element.indexOf('|countdown|') >= 0 || element.indexOf('|count|') >= 0) {
                    $scope.remainingTime = parseInt(element.substr(element.lastIndexOf('|') + 1) / 1000);
                }
                if (element.indexOf('css|') >= 0) {
                    let tmp = element.split("|");
                    $scope.categories[tmp[1]] = tmp[2].replace("border-bottom-", "background-");
                }
                if (element.indexOf('grid||') >= 0) {
                    // Replace some string with adapted data
                    let grid = element
                        .replace('grid||', '')
                        .replaceAll("data-pos", "datapos")
                        .replaceAll("data-id", "dataid")
                        .replaceAll("data-pr", "datapr")
                        .replaceAll("data-min", "datamin")
                        .replaceAll("data-width", "datawidth")
                        .replaceAll("data-type", "datatype")
                        .replaceAll("&", "&#38;");

                    // Transform 'grid' XML element to JSON
                    const xml = (new DOMParser()).parseFromString(grid, "application/xml");
                    let gridJson = (new X2JS()).xml2json(xml).tbody;

                    // Do not constitute the grid if only r0 available
                    if (typeof gridJson.tr[Symbol.iterator] !== 'function') {
                        continue;
                    }

                    // Build the grid
                    for (const line of gridJson.tr) {
                        if (line._dataid === "r0") { // r0 correspond to header, not a kart
                            // For debug
                            //console.log("**** r0 information ****");
                            //console.log(line.td);

                            // Get cX information
                            for (const info of line.td) {
                                if (info._datatype === "rk") {
                                    $scope.idRank = info._dataid;
                                } else if (info._datatype === "grp") {
                                    // Unused
                                } else if (info._datatype === "sta") {
                                    $scope.idState = info._dataid;
                                } else if (info._datatype === "nat") {
                                    $scope.idNation = info._dataid;
                                } else if (info._datatype === "no") {
                                    $scope.idKart = info._dataid;
                                } else if (info._datatype === "sp1") {
                                    $scope.idSpeed = info._dataid;
                                } else if (info._datatype === "dr") {
                                    $scope.idDriver = info._dataid;
                                } else if (info._datatype === "llp") {
                                    $scope.idLastLap = info._dataid;
                                } else if (info._datatype === "blp" || info.__text === "Meilleur Tour") {
                                    $scope.idBestLap = info._dataid;
                                } else if (info._datatype === "gap") {
                                    $scope.idGap = info._dataid;
                                } else if (info._datatype === "tlp") {
                                    $scope.idNbLaps = info._dataid;
                                } else if (info._datatype === "int") {
                                    $scope.idInterval = info._dataid;
                                } else if (info._datatype === "s1") {
                                    $scope.idSector1 = info._dataid;
                                } else if (info._datatype === "s2") {
                                    $scope.idSector2 = info._dataid;
                                } else if (info._datatype === "s3") {
                                    $scope.idSector3 = info._dataid;
                                } else if (info._datatype === "otr") {
                                    $scope.idOnTrack = info._dataid;
                                } else if (info._datatype === "pit") {
                                    $scope.idPits = info._dataid;
                                } else if (info._datatype === "rku") {
                                    $scope.idDeltaPos = info._dataid;
                                }
                                // Custom tricks
                                else if (info.__text === "Péna." /* RKC - Le Mans */ ||
                                    info.__text === "Penalty" /* Eupen - South Garda Karting */ ||
                                    info.__text === "Pena" /* Lignano Circuit */ ||
                                    info.__text === "Straf" /* karting-genk */) {
                                    $scope.idPenalty = info._dataid;
                                } else if (info.__text === "Catégorie" /* Le Mans */ ||
                                    info.__text === "Categoria" /* Lignano Circuit */) {
                                    $scope.idCategory = info._dataid;
                                } else if (info.__text === "Tours" /* Le Mans CIK */ ||
                                    info.__text === "Laps" /* cronosystem */) {
                                    $scope.idNbLaps = info._dataid;
                                } else if (info.__text === "kph"  /* cronosystem */ ||
                                    info.__text === "km/h" /* lks-karting */ ||
                                    info.__text === "km/h." /* karting-genk */) {
                                    $scope.idSpeed = info._dataid;
                                } else if (info.__text === "On Track" /* cronosystem */) {
                                    $scope.idOnTrack = info._dataid;
                                } else if (info.__text === "Pits" /* cronosystem */) {
                                    $scope.idPits = info._dataid;
                                } else {
                                    console.log("Not used column setup: " + info.__text)
                                }
                            }
                        } else {
                            let id = line._dataid;
                            let name = "";
                            let currentDriver = "";
                            let position = null;
                            let kartNumber = 0;
                            let group = "";
                            let bestLap = null;
                            let nation = "";
                            let bestLapColor = "white";
                            let lastLap = 0;
                            let lastLapColor = "yellow";
                            let lastLapOverallColor = "";
                            let nbLaps = 0;
                            let gap = 0.0;
                            let deltaPos = 0;
                            let deltaPosClass = "";
                            let interval = 0.0;
                            let speed = 0;
                            let sector1 = null;
                            let sector1Color = "yellow";
                            let sector1OverallColor = "";
                            let sector2 = null;
                            let sector2Color = "yellow";
                            let sector2OverallColor = "";
                            let sector3 = null;
                            let sector3Color = "yellow";
                            let sector3OverallColor = "";
                            let nbPits = 0;
                            let penalties = "";
                            let trackTime = 0;
                            let trackTimeClass = "";
                            let state = "";
                            let category = "";
                            let pitExit = false;
                            const randomColor = $scope.getRandomColor();

                            for (const info of line.td) {
                                if (info.hasOwnProperty('_dataid')) {
                                    if (checkData(info._dataid, $scope.idDriver)) {
                                        name = info.__text;
                                        if (typeof info.__text !== 'undefined' && info.__text.indexOf("[") >= 0) {
                                            // Driver information
                                            currentDriver = info.__text;
                                            currentDriver = currentDriver.substr(0, currentDriver.lastIndexOf('[')).trim();
                                        } else {
                                            // Team name
                                            name = info.__text;
                                        }
                                    } else if (checkData(info._dataid, $scope.idState)) {
                                        state = info._class;
                                    } else if (checkData(info._dataid, $scope.idNation)) {
                                        if (info._class !== ' nat') {
                                            nation = info._class;
                                        }
                                    } else if (checkData(info._dataid, $scope.idLastLap)) {
                                        lastLap = $scope.getTimeInSec(info.__text);
                                        if (info._class === "tn") {
                                            lastLapColor = "yellow";
                                        } else if (info._class === "ti") {
                                            lastLapColor = "#0f0";
                                        } else if (info._class === "tb") {
                                            lastLapColor = "#fa00fa";
                                        }
                                    } else if (checkData(info._dataid, $scope.idBestLap)) {
                                        bestLap = $scope.getTimeInSec(info.__text);

                                        if (info._class === "tb") {
                                            bestLapColor = "#fa00fa";
                                        }
                                    } else if (checkData(info._dataid, $scope.idGap)) {
                                        gap = info.__text;
                                    } else if (checkData(info._dataid, $scope.idNbLaps)) {
                                        nbLaps = info.__text;
                                    } else if (checkData(info._dataid, $scope.idInterval)) {
                                        interval = info.__text;
                                    } else if (checkData(info._dataid, $scope.idSector1)) {
                                        sector1 = $scope.getTimeInSec(info.__text);
                                        if (info._class === "tn") {
                                            sector1Color = "yellow";
                                        } else if (info._class === "ti") {
                                            sector1Color = "#0f0";
                                        } else if (info._class === "tb") {
                                            sector1Color = "#fa00fa";
                                        }
                                        if (sector1 === "") {
                                            sector1 = null;
                                        }
                                    } else if (checkData(info._dataid, $scope.idSector2)) {
                                        sector2 = $scope.getTimeInSec(info.__text);
                                        if (info._class === "tn") {
                                            sector2Color = "yellow";
                                        } else if (info._class === "ti") {
                                            sector2Color = "#0f0";
                                        } else if (info._class === "tb") {
                                            sector2Color = "#fa00fa";
                                        }
                                        if (sector2 === "") {
                                            sector2 = null;
                                        }
                                    } else if (checkData(info._dataid, $scope.idSector3)) {
                                        sector3 = $scope.getTimeInSec(info.__text);
                                        if (info._class === "tn") {
                                            sector3Color = "yellow";
                                        } else if (info._class === "ti") {
                                            sector3Color = "#0f0";
                                        } else if (info._class === "tb") {
                                            sector3Color = "#fa00fa";
                                        }
                                        if (sector3 === "") {
                                            sector3 = null;
                                        }
                                    } else if (checkData(info._dataid, $scope.idPits)) {
                                        nbPits = info.__text;
                                    } else if (checkData(info._dataid, $scope.idSpeed)) {
                                        speed = info.__text;
                                    } else if (checkData(info._dataid, $scope.idOnTrack)) {
                                        trackTime = info.__text;
                                        if (info._class === "to") {
                                            trackTimeClass = "pits";
                                        }
                                    } else if (checkData(info._dataid, $scope.idPenalty)) {
                                        if (info.hasOwnProperty('__text')) {
                                            penalties = info.__text;
                                        }
                                    } else if (checkData(info._dataid, $scope.idCategory)) {
                                        if (info.hasOwnProperty('__text')) {
                                            category = info.__text;
                                        }
                                    }
                                } else if (info.hasOwnProperty('_class')) {
                                    if (info._class === "no") {
                                        kartNumber = parseInt(info.div.__text);
                                        group = info.div._class.trim();
                                    } else if (info._class === "rk") {
                                        if (typeof info.div.p.__text !== "undefined") {
                                            position = parseInt(info.div.p.__text);
                                        }
                                    } else if (info._class === "rku") {
                                        if (typeof info.div.p.__text !== "undefined") {
                                            deltaPos = parseInt(info.div.p.__text);
                                        }
                                        if (typeof info.div.p._class !== "undefined") {
                                            deltaPosClass = info.div.p._class;
                                        }
                                        if (deltaPos === 0) {
                                            deltaPos = null;
                                        }
                                    }
                                }
                            }

                            // Check if current lap is a pit exit
                            if (state === "so") {
                                lastLapColor = "#15b5ff";

                                // Consider pit exit during race (i.e. not at session start)
                                pitExit = (lastLap !== null);
                            }

                            // Check if current lap is a pit entry
                            if (state === "si") {
                                if ($scope.selectedTrack.hasShorterPitEntry) {
                                    lastLapColor = "#15b5ff";
                                }
                            }
                            // Check if current lap is quicker than best lap (i.e. pit entry/exit)
                            if (lastLap < bestLap) {
                                lastLapColor = "#15b5ff";
                            }

                            let idx = $scope.karts.push({
                                id: id,
                                name: name,
                                nation: nation,
                                position: position,
                                bestLap: bestLap,
                                bestLapColor: bestLapColor,
                                lastLap: lastLap,
                                lastLapColor: lastLapColor,
                                lastLapOverallColor: lastLapOverallColor,
                                kartNumber: kartNumber,
                                group: group,
                                gap: gap,
                                interval: interval,
                                deltaPos: deltaPos,
                                deltaPosClass: deltaPosClass,
                                speed: speed,
                                sector1: sector1,
                                sector1Color: sector1Color,
                                sector1OverallColor: sector1OverallColor,
                                sector2: sector2,
                                sector2Color: sector2Color,
                                sector2OverallColor: sector2OverallColor,
                                sector3: sector3,
                                sector3Color: sector3Color,
                                sector3OverallColor: sector3OverallColor,
                                nbPits: nbPits,
                                nbLaps: nbLaps,
                                penalties: penalties,
                                state: state,
                                category: category,
                                trackTime: trackTime,
                                trackTimeClass: trackTimeClass,
                                pitExit: pitExit,
                                displayLaps: false,
                                soundLastLap: false,
                                soundPitEntrance: false,
                                soundPitTime: false,
                                soundTrackTime: false,
                                color: randomColor,
                                chronos: [],
                                pits: [],
                                drivers: []
                            });

                            /* In case category is displayed on original apex but empty */
                            if (category === "") {
                                $scope.idCategory = false;
                            }

                            // Save the kart id in hashmap
                            $scope.kartsMap[id] = (idx - 1);

                            // For debug
                            //console.log("**** "+ id +" information ("+ name +") ****");
                            //console.log(line.td);

                            // Look for parameter URL
                            if ($scope.params.hasOwnProperty("display")) {
                                if ($scope.params.display.indexOf(id) >= 0) {
                                    $scope.loadChronos(id);
                                }
                            }
                        }
                    }
                    $scope.computeLastLapsOverallColors();
                    $scope.computeSectorColors(1);
                    $scope.computeSectorColors(2);
                    $scope.computeSectorColors(3);
                }
            }

            if (!id) {
                // Complete live timing session's name with title
                if ($scope.title && typeof $scope.session[0] !== "undefined")
                    $scope.sessions[0].name += " - " + $scope.title;
                if ($scope.subtitle && typeof $scope.session[0] !== "undefined")
                    $scope.sessions[0].name += " - " + $scope.subtitle;
            }
        };

        /***** Track  functions *****/
        $scope.isSessionUnderway = function () {
            // Race is 'green' (= lg) or 'yellow' (= ly)
            return ($scope.raceState === 'lg' || $scope.raceState === 'ly');
        };

        $scope.moveDot = function (kartId, path) {
            // Check if kart exists...
            if (typeof $scope.karts[kartId] === 'undefined') {
                console.log("??? " + kartId + " - " + path);
                return;
            }
            // The attribute 'displayTrack' can be updated manually to false by user to hide the track
            if ($scope.settings.displayTrack === false) {
                cancelAnimationFrame($scope.karts[kartId].anim);
                return;
            }

            // Calculate the progress of the dot over time
            let progress = Math.min((Date.now() - $scope.karts[kartId].t0) / $scope.karts[kartId].duration, 1);

            // Move dot on map
            let dot = document.getElementById($scope.karts[kartId].id);
            let track = document.getElementById(path);
            if (track === null || dot === null) {
                return;
            }
            const p = track.getPointAtLength(progress * track.getTotalLength());
            dot.setAttribute("transform", `translate(${p.x}, ${p.y})`);

            // Keep the animation running until reaching the end of progress
            if (progress < 1) {
                $scope.karts[kartId].anim = requestAnimationFrame(() => $scope.moveDot(kartId, path));
            }
        }

        $scope.startNewLap = function (kartId, path, duration) {
            if ($scope.karts[kartId].anim) {
                // If an animation is already ongoing, cancel it
                cancelAnimationFrame($scope.karts[kartId].anim);
            }

            // Animation duration is in milliseconds while duration is given in seconds
            $scope.karts[kartId].duration = duration * 1000;
            $scope.karts[kartId].t0 = Date.now();

            // Start animation
            $scope.karts[kartId].anim = requestAnimationFrame(() => $scope.moveDot(kartId, path));
        };

        /***** Sound functions *****/
        $scope.playSound = function (file) {
            // Don't play sound if not enabled
            if ($scope.settings.enableSound === false) {
                return;
            }

            // Play audio file
            (new Audio(file)).play();
        }

        $scope.playSounds = function (files) {
            // Don't play sound if not enabled
            if ($scope.settings.enableSound === false) {
                return;
            }

            // Play audio files
            for (let i = 0; i < files.length - 1; i++) {
                files[i].onended = function () {
                    files[i + 1].play();
                };
            }
            files[0].play();
        }

        $scope.playLastLap = function (name, time) {
            // Don't play sound if not enabled
            if ($scope.settings.enableSound === false) {
                return;
            }

            let tmp = time.toString().split(".");
            let seconds = parseInt(tmp[0]);
            let subSeconds = 0;
            if (tmp.length === 2) {
                subSeconds = parseInt(tmp[1].substr(0, 1));
            }

            let sounds = [];

            // Add last lap files
            sounds.push(new Audio("data/fr/" + seconds + ".mp3"));
            sounds.push(new Audio("data/fr/" + subSeconds + ".mp3"));

            $scope.playSounds(sounds);
        }

        $scope.playTrackTime = function (name, minutes) {
            // Don't play sound if not enabled
            if ($scope.settings.enableSound === false) {
                return;
            }

            let sounds = [];

            sounds.push(new Audio("data/fr/trackTime.mp3"));
            sounds.push(new Audio("data/fr/" + minutes + "_minutes.mp3"));

            $scope.playSounds(sounds);
        }

        /***** Miscellaneous functions *****/
        $scope.getCurrentBestLastLap = function () {
            // Elaborate current best lap from all last lap
            let bestLap = 99999.99;
            for (const kart of $scope.karts) {
                if (kart.lastLap !== null &&
                    kart.bestLap !== null &&
                    kart.lastLap >= kart.bestLap &&
                    kart.lastLapColor !== '#15b5ff' &&
                    kart.lastLap < bestLap) {
                    bestLap = kart.lastLap;
                }
            }
            return bestLap;
        };

        $scope.getCurrentBestSector = function (sector) {
            // Elaborate current best sector from all sector
            let bestSector = 99999.99;
            for (const kart of $scope.karts) {
                let sectorTime = null;
                if (sector === 1) {
                    sectorTime = kart.sector1;
                }
                if (sector === 2) {
                    sectorTime = kart.sector2;
                }
                if (sector === 3) {
                    sectorTime = kart.sector3;
                }

                if (sectorTime !== null && sectorTime < bestSector) {
                    bestSector = sectorTime;
                }
            }
            return bestSector;
        };

        $scope.computeLastLapsOverallColors = function () {
            // Elaborate current best lap from all last lap
            let bestLap = $scope.getCurrentBestLastLap();
            let badLap = bestLap * $scope.settings.raceHomogeneity;

            for (let kart of $scope.karts) {
                // If last lap is a pit exit, return pit color
                if (kart.lastLapColor === '#15b5ff') {
                    kart.lastLapOverallColor = {color: '#15b5ff'};
                    continue;
                }

                // If last lap is strictly inferior to best lap or if bestLap is null, then pit exit
                if (kart.lastLap < kart.bestLap || kart.bestLap === null) {
                    kart.lastLapOverallColor = {color: '#15b5ff'};
                    continue;
                }

                let marge = Math.max(0, ((kart.lastLap - bestLap) / (badLap - bestLap)));
                marge = Math.min(1, marge);
                let percentage = (marge).toFixed(3);

                kart.lastLapOverallColor = {color: percentageToHsl(percentage)};
            }
        };

        $scope.computeAllLapsColors = function () {
            // Get best lap time from all displayed lap times
            let bestLapTime = 999999.9;
            for (const kart of $scope.karts) {
                if (kart.displayLaps) {
                    for (const lap of kart.chronos) {
                        if (lap.time !== null && lap.color !== "#15b5ff" && lap.time < bestLapTime && lap.type !== "pits") {
                            bestLapTime = lap.time;
                        }
                    }
                }
            }

            // Voluntary add some margin for bad lap calculation
            let badLap = bestLapTime * $scope.settings.raceHomogeneity * $scope.settings.raceHomogeneity;

            // Set lap time color depending on best lap
            for (let kart of $scope.karts) {
                if (kart.displayLaps) {
                    for (let lap of kart.chronos) {
                        // If lap is a pit exit, return pit color
                        if (lap.type === "pits" || lap.color === "#15b5ff") {
                            lap.allLapsColor = {color: '#15b5ff'};
                            continue;
                        }

                        let marge = Math.max(0, ((lap.time - bestLapTime) / (badLap - bestLapTime)));
                        marge = Math.min(1, marge);
                        let percentage = (marge).toFixed(3);
                        lap.allLapsColor = {color: percentageToHsl(percentage)};
                    }
                }
            }
        }

        $scope.computeSectorColors = function (sector) {
            const bestSector = $scope.getCurrentBestSector(sector);
            const badSector = bestSector * $scope.settings.raceHomogeneity;

            for (let kart of $scope.karts) {
                let sectorTime = null;
                if (sector === 1) {
                    sectorTime = kart.sector1;
                }
                if (sector === 2) {
                    sectorTime = kart.sector2;
                }
                if (sector === 3) {
                    sectorTime = kart.sector3;
                }

                if (sectorTime === null) {
                    continue;
                }

                let marge = Math.max(0, ((sectorTime - bestSector) / (badSector - bestSector)));
                marge = Math.min(1, marge);
                let percentage = (marge).toFixed(3);

                if (sector === 1) {
                    kart.sector1OverallColor = {color: percentageToHsl(percentage)};
                }
                if (sector === 2) {
                    kart.sector2OverallColor = {color: percentageToHsl(percentage)};
                }
                if (sector === 3) {
                    kart.sector3OverallColor = {color: percentageToHsl(percentage)};
                }
            }
        }

        $scope.getRandomColor = function () {
            return `hsla(${~~(360 * Math.random())}, 70%,  72%, 1.0)`;
        }

        $scope.getTimeInSec = function (time) {
            let timeSec;
            let timeMilliSec;
            if (typeof time === "undefined" || time === "" || time === "-" || time === "No Time") {
                return null;
            }
            let tmp = time.split('.');

            timeMilliSec = tmp[1];
            if (tmp[0].indexOf(":") >= 0) {
                tmp = tmp[0].split(":");
                timeSec = parseInt(tmp[0] * 60) + parseInt(tmp[1]);
            } else {
                timeSec = tmp[0];
            }

            return parseFloat(timeSec + "." + timeMilliSec);
        }

        $scope.getRawTimeInSec = function (rawTime) {
            if (typeof rawTime === "undefined" || rawTime === "" || rawTime === "-" || rawTime === "No Time") {
                return null;
            }

            // Raw time is specific with XXXXYYY, XXX being the seconds and YYY (always 3 digits) is the sub-seconds
            let subsec = rawTime.substr(-3);
            let sec = rawTime.substr(0, rawTime.length - 3);

            return parseFloat(sec + "." + subsec);
        }

        $scope.averageChronos = function (id, lapNb, driver) {
            let kartId = $scope.kartsMap[id];
            let sum = 0;
            let effectiveLapNb = 0;
            const kart = $scope.karts[kartId];

            // Manage the case where there is less than lapNb available
            if (lapNb > kart.chronos.length) {
                lapNb = kart.chronos.length;
            }

            // Calculate sum of laps
            for (let i = 0; i < lapNb; i++) {
                const chrono = kart.chronos[i];

                // Either no filter on driver OR filter on driver
                if (driver === null || driver === chrono.driver) {
                    if (chrono.time !== null && chrono.type !== "pits") {
                        sum += (chrono.time);
                        effectiveLapNb++;
                    }
                }
            }

            if (effectiveLapNb === 0) {
                return 0.0;
            }

            return (sum / effectiveLapNb).toFixed(3);
        };

        $scope.retrievePitsData = function (c, kartId) {
            let data = c.split("|");

            // Retrieve information from data indexes
            let pitTime = $scope.getRawTimeInSec(data[4]);
            let lapNb = parseInt(data[1]);
            let driver = data[7];

            // Add a new pit entry
            $scope.karts[kartId].pits.push({
                lap: lapNb,
                pitTime: pitTime,
                driver: driver
            });
        }

        $scope.hideKart = function (kart) {
            kart.displayLaps = false;
            kart.soundLastLap = false;
            kart.soundTrackTime = false;
            kart.soundPitEntrance = false;
            kart.soundPitTime = false;

            let currentParams = $location.search();
            let param = "";
            if (currentParams.hasOwnProperty("display")) {
                param = currentParams.display.replace(kart.id, "");
            }

            $location.search("display", param);
        };

        $scope.associatePitsAndLaps = function (kart) {
            for (const pit of kart.pits) {
                for (let i = 0; i < kart.chronos.length; i++) {
                    // If the in lap is shorter due to pit entry, consider previous lap as a pit as well
                    if ($scope.selectedTrack.hasShorterPitEntry && kart.chronos[i].lap === pit.lap) {
                        kart.chronos[i].color = '#15b5ff';
                        kart.chronos[i].type = "pits";
                    }

                    // The pit entrance (pit.lap) is considered on previous lap
                    if (kart.chronos[i].lap === (pit.lap + 1)) {
                        kart.chronos[i].color = '#15b5ff';
                        kart.chronos[i].type = "pits";
                        kart.chronos[i].pitTime = pit.pitTime;
                        kart.chronos[i].pit = pit;
                    }

                    // If the out lap is shorter due to pit exit, consider next lap as a pit as well
                    if ($scope.selectedTrack.hasShorterPitExit && kart.chronos[i].lap === (pit.lap + 2)) {
                        kart.chronos[i].color = '#15b5ff';
                        kart.chronos[i].type = "pits";
                    }
                }
            }
        }

        $scope.loadChronos = function (id) {
            const kartId = $scope.kartsMap[id];

            const apexKart = id.replace('r', 'D');
            const apexRequest = $scope.session + "D#-" + $scope.settings.retrieveNbLaps + "#" + apexKart + ".L#-999#" + apexKart + ".P#2#" + apexKart + ".B#1#" + apexKart + ".INF"

            $http(apexApi.loadChronosRequest($scope.port, apexRequest)).then(function successCallback(response) {
                let chronos = response.data.split("\n");
                //console.log(chronos);

                // Reset all chronos and pits as we just retrieved everything
                $scope.karts[kartId].chronos = [];
                $scope.karts[kartId].pits = [];
                $scope.karts[kartId].drivers = [];

                for (const c of chronos) {
                    if (c === "") {
                        continue;
                    }

                    // Check if line is a lap information
                    if (c.indexOf(apexKart + ".L") >= 0) {
                        let lap = parseInt(c.substr(c.indexOf(".L") + 2, 4)); // Lap number is always on 4 digits
                        let lapTime = c.substr(c.lastIndexOf("|") + 1);
                        let color = "yellow";

                        if (lapTime === "") {
                            continue;
                        }

                        // Clean lapTime
                        if (lapTime.indexOf('p') >= 0) { // Best lap
                            color = "#fa00fa";
                            lapTime = lapTime.replace('p', '');
                        }
                        if (lapTime.indexOf('g') >= 0) { // Personal best lap
                            color = "#0f0";
                            lapTime = lapTime.replace('g', '');
                        }
                        if (lapTime.indexOf('r') >= 0) { // Lap entrance
                            color = "#15b5ff";
                            lapTime = lapTime.replace('r', '');
                        }
                        if (lapTime.indexOf('b') >= 0) { // Pit
                            lapTime = lapTime.replace('b', '');
                        }
                        if (lapTime.indexOf('c') >= 0) { // ?
                            lapTime = lapTime.replace('c', '');
                        }

                        // Add lap to all chronos
                        $scope.karts[kartId].chronos.push({
                            color: color,
                            time: $scope.getRawTimeInSec(lapTime),
                            lap: lap,
                            type: "lap"
                        });
                    }
                    // Check if line is a pit information
                    else if (c.indexOf(apexKart + ".P") >= 0) {
                        $scope.retrievePitsData(c, kartId);
                    }
                    // Check if line is a driver information
                    else if (c.indexOf(".INF#") >= 0) {
                        let data = c.substr(c.indexOf(".INF#") + ".INF#".length);
                        const xml = (new DOMParser()).parseFromString(data, "application/xml");
                        let driversJson = (new X2JS()).xml2json(xml);
                        $scope.karts[kartId].drivers = driversJson.driver.driver;

                        if (typeof $scope.karts[kartId].drivers !== "undefined" && $scope.karts[kartId].drivers.length > 0) {
                            for (let driver of $scope.karts[kartId].drivers) {
                                driver.nbLaps = 0;
                                driver.bestLap = 999999.9;
                            }
                        }

                        if (typeof driversJson.driver.inf !== 'undefined') {
                            $scope.karts[kartId].infoCategory = driversJson.driver.inf._value;
                        }
                    } else if (c.indexOf(".BL#") >= 0) {
                        // Best lap info (sectors + lap): nothing to do
                    } else if (c.indexOf(".BS#") >= 0) {
                        // Best sectors: nothing to do
                    } else {
                        console.log(c);
                    }

                }

                //console.log($scope.karts[kartId].pits);

                // Data reorganisation => pits/laps
                $scope.associatePitsAndLaps($scope.karts[kartId]);

                // Data reorganisation => drivers/laps
                if (typeof $scope.karts[kartId].drivers !== 'undefined' && $scope.karts[kartId].drivers.length > 0) {
                    let currentDriver = null;

                    // Find the current driver id
                    for (const driver of $scope.karts[kartId].drivers) {
                        if (driver.hasOwnProperty("_current") && driver._current === "1") {
                            currentDriver = driver;
                        }
                    }

                    // Populate driver for all laps
                    for (let i = 0; i < $scope.karts[kartId].chronos.length; i++) {
                        // Driver change
                        if ($scope.karts[kartId].chronos[i].hasOwnProperty("pit")) {
                            const driverId = $scope.karts[kartId].chronos[i].pit.driver;
                            // Find the driver with its id
                            for (const driver of $scope.karts[kartId].drivers) {
                                if (driver._id === driverId) {
                                    currentDriver = driver;
                                }
                            }
                        }

                        if (currentDriver !== null) {
                            $scope.karts[kartId].chronos[i].driver = currentDriver;
                            currentDriver.nbLaps++;
                            if ($scope.karts[kartId].chronos[i].time < currentDriver.bestLap &&
                                $scope.karts[kartId].chronos[i].type !== "pits") {
                                currentDriver.bestLap = $scope.karts[kartId].chronos[i].time;
                            }
                        }
                    }
                }

                $scope.karts[kartId].displayLaps = true;
                $scope.karts[kartId].soundLastLap = ($scope.karts[kartId].kartNumber === $scope.settings.teamNumber);
                $scope.karts[kartId].soundPitEntrance = ($scope.karts[kartId].kartNumber === $scope.settings.teamNumber);
                $scope.karts[kartId].soundPitTime = ($scope.karts[kartId].kartNumber === $scope.settings.teamNumber);
                $scope.karts[kartId].soundTrackTime = ($scope.karts[kartId].kartNumber === $scope.settings.teamNumber);

                // Compute all laps colors
                $scope.computeAllLapsColors();

                let currentParams = $location.search();
                let param = $scope.karts[kartId].id;
                if (currentParams.hasOwnProperty("display")) {
                    if (currentParams.display.indexOf(param) < 0) {
                        // Insert only if not already present
                        param = currentParams.display + param;
                    }
                }

                $location.search("display", param);
                //console.log($scope.karts[kartId].chronos);

            }, function errorCallback(response) {
                console.log(response);
            });
        };

        $scope.newChrono = function (id) {
            const kartId = $scope.kartsMap[id];
            let type = ($scope.karts[kartId].lastLapColor === "#15b5ff") ? "pit" : "lap";
            let currentDriver = null;
            let lap = 1; // Default value correspond to session start
            if ($scope.karts[kartId].chronos.length !== 0) {
                lap = ($scope.karts[kartId].chronos[0].lap + 1);
            }

            // Find the current driver id
            if (typeof $scope.karts[kartId].drivers !== 'undefined' && $scope.karts[kartId].drivers.length > 0) {
                for (const driver of $scope.karts[kartId].drivers) {
                    if (driver.hasOwnProperty("_current") && driver._current === "1") {
                        currentDriver = driver;
                    }
                }
            }

            if (currentDriver !== null) {
                currentDriver.nbLaps++;
            }

            $scope.karts[kartId].chronos.unshift({
                color: $scope.karts[kartId].lastLapColor,
                time: $scope.karts[kartId].lastLap,
                lap: lap,
                type: type,
                driver: currentDriver
            });

            $scope.computeAllLapsColors();
            $scope.associatePitsAndLaps($scope.karts[kartId]);
        };

        $scope.pitExit = function (id) {
            const kartId = $scope.kartsMap[id];
            let apexKart = id.replace('r', 'D');
            //let apexRequest = "D#-1#" + apexKart + ".L#-1#" + apexKart + ".P";
            let apexRequest = $scope.session + "D#-1#" + apexKart + ".P";

            $http(apexApi.loadPitRequest($scope.port, apexRequest)).then(function successCallback(response) {
                //console.log(response.data);

                let chronos = response.data.split("\n");

                for (const c of chronos) {
                    if (c === "") {
                        continue;
                    }

                    // Check if line is a pit information
                    if (c.indexOf(apexKart + ".P") >= 0) {
                        $scope.retrievePitsData(c, kartId);
                    }
                }

                $scope.associatePitsAndLaps($scope.karts[kartId]);
            }, function errorCallback(response) {
                console.log(response);
            });
        };

        $scope.loadApexConfig = function (changeTrack) {
            $scope.resetSession();

            if ($scope.selectedTrack !== null) {
                // Clear parameters
                $location.search('track', $scope.selectedTrack.id);
                if (changeTrack) {
                    // Reset all displayed kart
                    $location.search("display", null);
                }

                $http(apexApi.loadConfigRequest($scope.selectedTrack.url)).then(function successCallback(response) {
                    // Get APEX server configuration
                    let rawData = response.data.split('\n');
                    $scope.port = rawData[0].replace('var configPort = ', '').replace(';', '');
                    $scope.config = rawData[1].replace('var configGMT = ', '').replace(';', '');
                    $scope.sessions = [];

                    $http(apexApi.loadSessions($scope.port)).then(function successCallback(response) {
                        let rawSessions = response.data.split('\n');

                        // First push live timing as current session
                        $scope.sessions.push({id: "", name: "Live timing", selected: true});

                        for (const session of rawSessions) {
                            if (session === "") {
                                continue;
                            }
                            const rawSession = session.split('#');

                            $scope.sessions.push({id: rawSession[0], name: rawSession[1], selected:false});
                        }
                    });

                    // Connect to APEX web socket to retrieve the first data
                    $scope.ws = new WebSocket("ws://www.apex-timing.com:" + (parseInt($scope.port) + 2) + "/");

                    // Retrieve only the first message from APEX web socket
                    $scope.ws.onmessage = function (message) {
                        // Rearm countdown (countdown is received every 30s)
                        $scope.timeoutCountdown = 35;

                        // Data are split by line return
                        message = message.data.split("\n");

                        if (message[0].indexOf("init") >= 0) {
                            $scope.resetSession();
                            $scope.initSession("", message);
                        } else {
                            // Update data with message
                            for (const info of message) {
                                if (info !== "") {
                                    //console.log(info);

                                    if (info.indexOf($scope.idDriver + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idDriver));
                                        kartId = $scope.kartsMap[kartId];

                                        if (info.indexOf("[") >= 0) {
                                            // Driver information
                                            let driver = info.substr(info.lastIndexOf('|') + 1);
                                            driver = driver.substr(0, driver.lastIndexOf(' ['));
                                            $scope.karts[kartId].currentDriver = driver.trim();
                                        } else {
                                            $scope.karts[kartId].name = info.substr(info.lastIndexOf('|') + 1);
                                        }
                                    } else if (info.indexOf($scope.idState + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idState));
                                        kartId = $scope.kartsMap[kartId];
                                        if (typeof $scope.karts[kartId] !== "undefined") {
                                            $scope.karts[kartId].state = info.substr(info.indexOf('|') + 1, 2);
                                        }

                                        // Pit exit: start a new lap
                                        if ($scope.karts[kartId].state === "so") {
                                            if ($scope.isSessionUnderway()) {
                                                let lapTime = $scope.karts[kartId].lastLap;

                                                if ($scope.selectedTrack.hasShorterPitEntry === true) {
                                                    // Don't take last lap as it'll be way higher than the normal lap
                                                    lapTime = $scope.getCurrentBestLastLap();
                                                }

                                                $scope.startNewLap(kartId, "trackProgress", lapTime);
                                            }

                                            // Consider pit exit only during race (i.e. not at session start)
                                            $scope.karts[kartId].pitExit = ($scope.karts[kartId].lastLap !== null);
                                        }
                                    } else if (info.indexOf($scope.idLastLap + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idLastLap));
                                        kartId = $scope.kartsMap[kartId];
                                        let lastLapColor = "yellow";

                                        if (info.indexOf("ti") >= 0) {
                                            lastLapColor = "#0f0";
                                        } else if (info.indexOf("tb") >= 0) {
                                            lastLapColor = "#fa00fa";
                                        }

                                        // Check if last lap is a pit exit
                                        if ($scope.karts[kartId].state === "so") {
                                            lastLapColor = "#15b5ff";
                                        }
                                        // Check if last lap is a pit entry
                                        if ($scope.karts[kartId].state === "si") {
                                            if ($scope.selectedTrack.hasShorterPitEntry) {
                                                lastLapColor = "#15b5ff";
                                            }
                                        }

                                        // Update global chart
                                        let lastLap = $scope.getTimeInSec(info.substr(info.lastIndexOf('|') + 1));
                                        let isNewLap = ($scope.karts[kartId].lastLap !== lastLap);
                                        $scope.karts[kartId].lastLap = lastLap;
                                        $scope.karts[kartId].lastLapColor = lastLapColor;
                                        $scope.computeLastLapsOverallColors();

                                        // Update kart chronos only if this is a new lap (for example if the last lap color changes from purple to green)
                                        if ($scope.karts[kartId].displayLaps && isNewLap === true) {
                                            $scope.newChrono($scope.karts[kartId].id);
                                        }

                                        // Start new lap
                                        if ($scope.isSessionUnderway()) {
                                            let lapTime = $scope.karts[kartId].lastLap;

                                            if ($scope.karts[kartId].pitExit === true) {
                                                // Don't take last lap as it'll be way higher than the normal lap
                                                lapTime = $scope.getCurrentBestLastLap();
                                            }

                                            $scope.startNewLap(kartId, "trackProgress", lapTime);
                                        }

                                        // Dictate last lap
                                        if ($scope.karts[kartId].soundLastLap === true) {
                                            $scope.playLastLap($scope.karts[kartId].name, $scope.karts[kartId].lastLap);
                                        }

                                        // Manage pit exit (i.e. last lap is one lap after the pit exit)
                                        if ($scope.karts[kartId].pitExit === true) {
                                            $scope.karts[kartId].lastLapColor = "#15b5ff";

                                            // Load pit information
                                            if ($scope.karts[kartId].displayLaps) {
                                                $scope.pitExit($scope.karts[kartId].id);
                                            }

                                            $scope.karts[kartId].pitExit = false;
                                        }
                                    } else if (info.indexOf($scope.idPits + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idPits));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].nbPits = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf($scope.idDeltaPos + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idDeltaPos));
                                        kartId = $scope.kartsMap[kartId];

                                        let tmp = info.split("|");
                                        $scope.karts[kartId].deltaPosClass = tmp[1];
                                        $scope.karts[kartId].deltaPos = tmp[2];
                                    } else if (info.indexOf($scope.idSector1 + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idSector1));
                                        kartId = $scope.kartsMap[kartId];
                                        let color = "";
                                        if (info.indexOf("tn") >= 0) {
                                            color = "yellow";
                                        }
                                        if (info.indexOf("ti") >= 0) {
                                            color = "#0f0";
                                        }
                                        if (info.indexOf("tb") >= 0) {
                                            color = "#fa00fa";
                                        }

                                        // Update global chart
                                        $scope.karts[kartId].sector1 = info.substr(info.lastIndexOf('|') + 1);
                                        $scope.karts[kartId].sector1Color = color;
                                        $scope.karts[kartId].sector1 = $scope.getTimeInSec($scope.karts[kartId].sector1);
                                        $scope.computeSectorColors(1);
                                    } else if (info.indexOf($scope.idSector2 + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idSector2));
                                        kartId = $scope.kartsMap[kartId];
                                        let color = "";
                                        if (info.indexOf("tn") >= 0) {
                                            color = "yellow";
                                        }
                                        if (info.indexOf("ti") >= 0) {
                                            color = "#0f0";
                                        }
                                        if (info.indexOf("tb") >= 0) {
                                            color = "#fa00fa";
                                        }

                                        // Update global chart
                                        $scope.karts[kartId].sector2 = info.substr(info.lastIndexOf('|') + 1);
                                        $scope.karts[kartId].sector2Color = color;
                                        $scope.karts[kartId].sector2 = $scope.getTimeInSec($scope.karts[kartId].sector2);
                                        $scope.computeSectorColors(2);
                                    } else if (info.indexOf($scope.idSector3 + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idSector3));
                                        kartId = $scope.kartsMap[kartId];
                                        let color = "";
                                        if (info.indexOf("tn") >= 0) {
                                            color = "yellow";
                                        }
                                        if (info.indexOf("ti") >= 0) {
                                            color = "#0f0";
                                        }
                                        if (info.indexOf("tb") >= 0) {
                                            color = "#fa00fa";
                                        }

                                        // Update global chart
                                        $scope.karts[kartId].sector3 = info.substr(info.lastIndexOf('|') + 1);
                                        $scope.karts[kartId].sector3Color = color;
                                        $scope.karts[kartId].sector3 = $scope.getTimeInSec($scope.karts[kartId].sector3);
                                        $scope.computeSectorColors(3);
                                    } else if (info.indexOf($scope.idBestLap + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idBestLap));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].bestLap = $scope.getTimeInSec(info.substr(info.lastIndexOf('|') + 1));

                                        if (info.indexOf("tb") >= 0) {
                                            $scope.karts[kartId].bestLapColor = "#fa00fa";
                                        } else {
                                            $scope.karts[kartId].bestLapColor = "white";
                                        }

                                        // This is needed in case of new best lap while the last lap has been
                                        // previously updated (will be considered as pit exit)
                                        $scope.computeLastLapsOverallColors();
                                    } else if (info.indexOf($scope.idGap + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idGap));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].gap = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf($scope.idSpeed + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idSpeed));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].speed = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf($scope.idInterval + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idInterval));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].interval = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf($scope.idNbLaps + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idNbLaps));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].nbLaps = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf($scope.idPenalty + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idPenalty));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].penalties = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf($scope.idOnTrack + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idOnTrack));
                                        kartId = $scope.kartsMap[kartId];
                                        $scope.karts[kartId].trackTime = info.substr(info.lastIndexOf('|') + 1);
                                        if (info.indexOf("|to|") >= 0) {
                                            // Pits
                                            $scope.karts[kartId].trackTimeClass = "pits";

                                            // Show kart on pit map and play sound
                                            if ($scope.karts[kartId].trackTime === "01.") {
                                                $scope.startNewLap(kartId, "pitsProgress", parseFloat($scope.selectedTrack.pitTime));

                                                if ($scope.karts[kartId].soundPitEntrance) {
                                                    $scope.playSound("data/pit.wav");
                                                }
                                            }

                                            // Dictate pit time every 5 seconds
                                            if ($scope.karts[kartId].soundPitTime) {
                                                let pitTime = $scope.karts[kartId].trackTime.replace('.', '');
                                                pitTime = $scope.getTimeInSec(pitTime);
                                                if (pitTime > 0 && pitTime % 5 === 0) {
                                                    $scope.playSound("data/fr/" + pitTime + "_seconds.mp3");
                                                }
                                            }

                                            // Set pit exit
                                            $scope.karts[kartId].pitExit = true;
                                        } else {
                                            // Regular lap
                                            $scope.karts[kartId].trackTimeClass = "";

                                            // Dictate track time every 10 minutes
                                            if ($scope.karts[kartId].soundTrackTime === true && $scope.karts[kartId].trackTime.indexOf(":") >= 0) {
                                                let tmp = $scope.karts[kartId].trackTime.split(":");
                                                let trackTimeInt = parseInt(tmp[0]) * 60 + parseInt(tmp[1]);
                                                if (trackTimeInt > 0 && trackTimeInt % 10 === 0) {
                                                    $scope.playTrackTime($scope.karts[kartId].name, trackTimeInt);
                                                }
                                            }
                                        }

                                    } else if (info.indexOf($scope.idRank + "|") >= 0) {
                                        let kartId = info.substr(0, info.indexOf($scope.idRank));
                                        kartId = $scope.kartsMap[kartId];
                                        if (typeof $scope.karts[kartId] !== "undefined") {
                                            $scope.karts[kartId].position = parseInt(info.substr(info.lastIndexOf('|') + 1));
                                        }
                                    } else if (info.indexOf("dyn1|text|") >= 0) {
                                        $scope.dyn1 = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf("dyn2|text|") >= 0) {
                                        $scope.dyn2 = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf("com||") >= 0) {
                                        $scope.comments = $sce.trustAsHtml(info.replace("com||", ""));
                                    } else if (info.indexOf("light|") >= 0) {
                                        $scope.raceState = info.replace("light|", "").replace("|", "");
                                    } else if (info.indexOf("*") >= 0 || info.indexOf("#") >= 0) {
                                        // Nothing to be done (* correspond to best lap and # to rank)
                                    } else if (info.indexOf("|gs|") >= 0 || info.indexOf("|gm|") >= 0 || info.indexOf("|gl|") >= 0 || info.indexOf("|gf|") >= 0) {
                                        // Nothing to be done (correspond to the groupment on the very left side of APEX)
                                    } else if (info.indexOf("msg|") >= 0) {
                                        $scope.highlightMessage = info.substr(info.lastIndexOf('|') + 1);
                                    } else if (info.indexOf("countdown") >= 0 || info.indexOf("count") >= 0) {
                                        $scope.remainingTime = parseInt(info.substr(info.lastIndexOf('|') + 1) / 1000);
                                        if (info.indexOf("dyn1|") >= 0) {
                                            $scope.dyn1 = "";
                                        }
                                        if (info.indexOf("dyn2|") >= 0) {
                                            $scope.dyn2 = "";
                                        }
                                    } else {
                                        console.log(info + " - ??");
                                    }
                                }
                            }
                            $scope.$apply();
                        }
                    }

                    /*
                    // Load track's sessions
                    $http({
                        method: 'POST',
                        url: "http://www.apex-timing.com/live-timing/commonv2/functions/request.php",
                        data: "port="+ $scope.port +"&request=" + encodeURIComponent(""),
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                   }).then(function successCallback(response) {
                        console.log(response);
                        if (response.data !== "") {
                           $scope.sessions = response.data.slice(0,-1).split("\n");
                        }
                        else {
                            $scope.sessions = [];
                        }
                   }, function errorCallback(response) { });*/
                }, function errorCallback(response) {
                    console.log(response);
                });
            }
        };

        $scope.selectSession = function(id) {
            // Reset data
            $scope.resetSession();

            // Reset all displayed kart
            $location.search("display", null);

            // Select session
            for (let session of $scope.sessions) {
                session.selected = (session.id === id);
            }

            // Check for live timing selection
            if (id === "") {
                $scope.loadApexConfig(false);
                return;
            }

            // Load selected session
            $http(apexApi.loadSession($scope.port, id)).then(function successCallback(message) {
                message = message.data.split("\n");

                if (message[0].indexOf("init") >= 0) {
                    $scope.initSession(id, message);
                }
            });
        }

        /*
        $scope.loadSession = function(sessionIndex) {
            let id = $scope.sessions[sessionIndex].substring(0, $scope.sessions[sessionIndex].indexOf('#'));

             $http({
                 method: 'POST',
                 url: "http://www.apex-timing.com/live-timing/commonv2/functions/request.php",
                 data: "port="+ $scope.port +"&request=" + encodeURIComponent("S#"+id),
                 headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }).then(function successCallback(response) {
                 let all = response.data;
                 let toto = all.substr(all.indexOf("<tbody>"), all.indexOf("</tbody>")-all.indexOf("<tbody>")+8);
                 let x2js = new X2JS();
                 toto = toto.replaceAll("data-pos", "datapos").replaceAll("data-id", "dataid")
                 $scope.data = x2js.xml_str2json(toto).tbody;

                 console.log($scope.data);

            }, function errorCallback(response) {
                console.log(response);
            });
        };*/


        $scope.params = $location.search();
        if ($scope.params.hasOwnProperty("track")) {
            // Retrieve selected track
            for (const track of apexTracks.getTracks()) {
                if (track.id === $scope.params.track) {
                    $scope.selectedTrack = track;

                    $scope.loadApexConfig(false);
                }
            }
        }

        $scope.getCsvFileName = function(kart) {
            let fileName = new Date().toISOString().substring(0, 19).replaceAll(":", "");

            if (title !== "") {
                fileName += "-" + title;
            }
            if (subtitle !== "") {
                fileName += "-" + subtitle;
            }

            return kart.name + "_" + fileName + ".csv";
        }

        $scope.getCsvHeader = function(kart) {
            return ["Lap", "Time", "Type", "Driver"];
        }

        $scope.getCsvData = function(kart) {
            let csv = [];

            for (const chrono of kart.chronos) {
                let driver = kart.name;
                if (typeof chrono.driver !== "undefined") {
                    driver = chrono.driver._name;
                }

                csv.push({
                    lap: chrono.lap,
                    time: chrono.time,
                    type: chrono.type,
                    driver: driver
                })
            }

            return csv;
        }


        $scope.downloadObjectAsJson = function (title, subtitle, data) {
            let fileName = new Date().toISOString().substring(0, 19).replaceAll(":", "");

            if (title !== "") {
                fileName += "-" + title;
            }
            if (subtitle !== "") {
                fileName += "-" + subtitle;
            }

            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", fileName + ".json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

        $scope.mp3 = [];
        $scope.teeeest = function (i) {
            $http({
                method: 'POST',
                url: "https://ttsmp3.com/makemp3_new.php",
                data: "msg=SPACE1&lang=Mathieu&source=ttsmp3", // Mathieu
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            }).then(function successCallback(response) {
                (new Audio(response.data.URL)).play();
                $scope.mp3.push("wget -O " + i + "_seconds.mp3 " + response.data.URL);
            }, function errorCallback(response) {
                console.log(response);
            });
        };
        // numbers
        for (let i = 0; i <= 200; i++) { /* $scope.teeeest(i); */
        }
        // seconds
        for (let i = 5; i <= 200; i += 5) { /*$scope.teeeest(i);*/
        }
        // minutes
        for (let i = 10; i <= 200; i += 10) { /* $scope.teeeest(i); */
        }
    }]);
