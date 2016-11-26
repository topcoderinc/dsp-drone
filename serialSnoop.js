var serialPort = require('serialport');
var fs = require('fs');
// var mavlink = require('mavlink');
var gcs = require('./gcsLib.js');
var blessed = require('blessed');
var stringify = require("json-stringify-pretty-compact");

var serial1 = {
    device: process.argv[2], // Really the first param after the command name
    baudRate: 57600,
    port: null,
    log: false, // Should move this to params and configure it from within the function
    logfile: 'serial1.dat', // Should move to params
    logstream: null,
    name: 'serial1',
    listeners: {},
    params: {}
};
var serial2 = {
    device: process.argv[3],
    baudRate: 57600,
    port: null,
    log: false,
    logfile: 'serial2.dat',
    logstream: null,
    name: 'serial2',
    listeners: {},
    params: {}
};

var abort = false;
var blessedDisplay;


setup().then(main).catch(function (err) {
    print(err);
    abort = true;
    cleanup();
});

function main() {
    initXconnect(serial1, serial2);
    initXconnectListeners();
    print(blessedDisplay.prompt + blessedDisplay.cursorChar);
    initMavlinkDecode();
}

function initMavlinkDecode() {
    var initListeners = function (params) {
        // Decode all messages
        // Remember you can listen for specific messages with .on('HEARTBEAT', function (message, fields) ...
        params.mavlinkDecoder.on("message", function (message) { // Decode all messages
            var d = new Date();
            var dateString = d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + '.' + d.getMilliseconds();
            var decodedMessage = params.mavlinkDecoder.decodeMessage(message);
            var messageId = message.id;
            var messagaName = params.mavlinkDecoder.getMessageName(messageId);
            printViewer('----- ' + params.serial.device + ' [' + messagaName + ' ID#' + messageId + '] -----');
            printViewer(stringify(decodedMessage, {maxLength: 120, indent: 2}) + '\n');

            params.serial.params.mavlinkLogStream.write('----- [' + dateString + '] ' + params.serial.device + ' [' + messagaName + ' ID#' + messageId + '] -----\n');
            params.serial.params.mavlinkLogStream.write(stringify(decodedMessage, {maxLength: 120, indent: 2}) + '\n\n');
        });

        params.serial.params.mavlinkDecoder = params.mavlinkDecoder; // Wow...
    };

    var mavlinkDecoder1 = gcs.createMavlinkDecoder(); // Maybe just use mavlink directly if this is all I'm doing with it
    initListeners({mavlinkDecoder: mavlinkDecoder1, serial: serial1});

    var mavlinkDecoder2 = gcs.createMavlinkDecoder();
    initListeners({mavlinkDecoder: mavlinkDecoder2, serial: serial2});
}


function initXconnectListeners() {
    serial1.listeners.binaryLogger = function (data) {
        if (serial1.log) {
            serial1.logstream.write(data);
        }
    };
    serial2.listeners.binaryLogger = function (data) {
        if (serial2.log) {
            serial2.logstream.write(data);
        }
    };
}

function initXconnect(s1, s2) {
    s1.port.on('data', function (data) {
        if (s2.port.isOpen()) {
            s2.port.write(data);
        }
        Object.keys(serial1.listeners).forEach(function (key) {
            var listener = serial1.listeners[key];
            listener(data);
        });
    });

    s2.port.on('data', function (data) {
        if (s1.port.isOpen()) {
            s1.port.write(data);
        }
        Object.keys(serial2.listeners).forEach(function (key) {
            var listener = serial2.listeners[key];
            listener(data);
        });
    });
    print('Cross connecting ' + s1.device + ' to ' + s2.device);
}


function cleanup() {
    closePorts();
    if (serial1.logstream) {
        serial1.logstream.close();
    }
    if (serial2.logstream) {
        serial2.logstream.close();
    }
}

function closePorts() {
    if (serial1.port) {
        print(serial1.device + ' closing');
        serial1.port.close();
    }
    if (serial2.port) {
        print(serial2.device + ' closing');
        serial2.port.close();
    }
}

function setup() {
    blessedDisplay = initBlessed();
    return new Promise(function (resolve, reject) {
        Promise.all([
            openSerial({
                device: serial1.device,
                baudRate: serial1.baudRate,
                name: 'serial1'
            }),
            openSerial({
                device: serial2.device,
                baudRate: serial2.baudRate,
                name: 'serial2'
            })
        ]).then(function (results) {
            serial1.port = results[0];
            serial2.port = results[1];
            resolve();
        }).catch(function (err) {
            reject(err);
        })
    })
}

function openSerial(s) {
    return new Promise(function (resolve, reject) {
        var serialPort1 = new serialPort(s.device, {
            baudRate: s.baudRate
        }, function (err) {
            if (err) {
                abort = true;
                reject('[' + s.device + '] ' + err.message);
            }
        });
        serialPort1.on('open', function () { // Wait for serial port to be open
            print(s.device + ' opened as ' + s.name);
            if (abort) {
                print(s.device + ' closing');
                serialPort1.close();
                cleanup();
            }
            resolve(serialPort1);
        });
    });
}

function initBlessed() {
    var screen = blessed.screen({
        smartCSR: true,
        dockBorders: true,
        ignoreDockContrast: true,
        debug: true,
        cursor: {
            artificial: true,
            blink: false,
            shape: 'block',
            color: 'red'
        },
        log: 'blessed.log',
        title: 'Serial Snoop'
    });

    var outputBox = blessed.box({
        top: 0,
        left: 0,
        width: '100%',
        height: '70%+1',
        content: '',
        label: 'Viewer',
        border: {
            type: 'line'
        },
        bg: '#FED480',
        fg: 'black',
        scrollable: true,
        keys: true,
        mouse: true, // This is what actually makes the mouse scroll work
        scrollbar: {
            ch: ' ',
            track: {
                bg: 'grey',
                fg: '#093145'
            },
            bg: 'white'
        },
        tags: true
    });

    var commandBox = blessed.box({
        top: '70%',
        left: 0,
        width: '100%',
        height: 'shrink',
        border: {
            // fg: 'white',
            type: 'line'
        },
        bg: '#3C6478',
        fg: 'white',
        label: 'Command',
        scrollable: true,
        // alwaysScroll: true,
        mouse: true, // This is what actually makes the mouse scroll work
        keys: true,
        scrollbar: {
            ch: ' ',
            track: {
                bg: 'grey',
                fg: '#093145'
            },
            bg: 'white'
        },
        tags: true
        // focused: true // Start the focus on this window
    });
    screen.append(outputBox);
    screen.append(commandBox);
    screen.render();

    // outputBox.on('focus', function () { // Keep the focus on the command box
    //     commandBox.focus();
    // });

    var inputBuffer = '';

    var cursorChar = '{blink}✿{/blink}';
    // var cursorChar = '✿';
    // var cursorChar = '☀'; // ☀

    var prompt = ('> ');

    var processCommand = function (inputLine) {
        if (inputLine == '') { // If it's empty, skip it
            return;
        }
        if ((inputLine == 'l1') || (inputLine == 'l2')) { // I should use the newer strategy I'm using to enable / disable mavlink decoding here...
            var serial = (inputLine == 'l1') ? serial1 : serial2;
            serial.log = !serial.log; // Toggle logging
            if (serial.log) {
                print('Now logging ' + serial.name + ' (' + serial.device + ') to ' + serial.logfile);
                serial.logstream = fs.createWriteStream(serial.logfile);
            } else {
                print('Stopped logging serial (' + serial.device + ') to ' + serial.logfile);
                serial.logstream.close();
            }
            return;
        }

        if ((inputLine == 'm1') || (inputLine == 'm2') || (inputLine == 'ma')) {
            var serials = [];
            switch (inputLine) {
                case 'm1':
                    serials.push(serial1);
                    break;
                case 'm2':
                    serials.push(serial2);
                    break;
                case 'ma':
                    // Set them the same (just for a sec) so they both turn either on or off if
                    // they were different. This is a cheat, I'm potentially setting the listener
                    // on a serial to listen to the other serial's port (again, just for a sec -
                    // it shouldn't show up).
                    serial2.listeners.mavlinkDecode = serial1.listeners.mavlinkDecode;
                    serials.push(serial1, serial2);
                    break;
            }

            serials.forEach(function (serial) {
                if (serial.listeners.mavlinkDecode == undefined) {
                    print('Decoding Mavlink from ' + serial.name + ' (' + serial.device + ')');
                    serial.listeners.mavlinkDecode = function (data) {
                        serial.params.mavlinkDecoder.parse(data);
                    };
                    serial.params.mavlinkLogStream = fs.createWriteStream(serial.name + '.mavdecode');
                } else {
                    print('Stopped decoding Mavlink from ' + serial.name + ' (' + serial.device + ')');
                    delete serial.listeners.mavlinkDecode;
                    serial.params.mavlinkLogStream.close();
                }
            });
            return;
        }

        if (inputLine == 'm1') {
            gcs.sendArm(serial1.port);
            return;
        }

        if (inputLine.toLowerCase() == 'q') {
            cleanup();
            process.exit(0);
        }

        // Do this if nothing else
        print('Unknown command');
    };

    commandBox.on('keypress', function (key) {
        if (key) { // Check it because arrows and such come through undefined....
            var lastLineIndex = commandBox.getLines().length - 1;

            if ((inputBuffer == '') && (key == '\r')) { // This is a mess, related to the fact that after a \r is received, another one comes through right after for no apparent reason
                return;
            }

            if (key == '\r') {// If it's a carriage return
                commandBox.setLine(lastLineIndex, prompt + inputBuffer);
                processCommand(inputBuffer);
                inputBuffer = '';
                print(prompt + cursorChar);
                return;
            }

            if (key.charCodeAt(0) == 127) { // Deal with backspace character
                if (inputBuffer.length > 0) {
                    // screen.debug(inputBuffer.length + ' : ' + inputBuffer);
                    inputBuffer = inputBuffer.substr(0, inputBuffer.length - 1); // Remove the last character from the inputBuffer
                    commandBox.setLine(lastLineIndex, prompt + inputBuffer + cursorChar);
                    screen.render();
                }
                return;
            }

            // No other triggers, just add it to the input line (after a quick filter)
            if (/[a-zA-Z0-9 .!@#$%^&*()_+]/.test(key)) {
                inputBuffer += key;
                commandBox.setLine(lastLineIndex, prompt + inputBuffer + cursorChar);
                screen.render();
            }
        }
    });

    var printToCommandBox = function (s) {
        commandBox.pushLine(s);
        commandBox.setScrollPerc(100);
    };

    var printToViewer = function (s) {
        var totalDesiredLines = 1000;
        outputBox.pushLine(s);
        var totalLength = outputBox.getLines().length;
        if (totalLength > totalDesiredLines){
            for (var i = 0; i < totalLength - totalDesiredLines; i++){
                outputBox.deleteLine(0);
            }
        }
        outputBox.setScrollPerc(100);
    };

    return {
        screen: screen,
        outputBox: outputBox,
        commandBox: commandBox,
        printToCommandBox: printToCommandBox,
        printToViewer: printToViewer,
        prompt: prompt,
        cursorChar: cursorChar
    }
}

function print(s) {
    blessedDisplay.printToCommandBox(s);
}

function printViewer(s) {
    blessedDisplay.printToViewer(s);
}

