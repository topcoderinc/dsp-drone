var serialPort = require('serialport');
var fs = require('fs');
var mavlink = require('mavlink');
// var readline = require('readline');
var blessed = require('blessed');

var serial1 = {
    device: process.argv[2], // Really the first param after the command name
    baudRate: 57600,
    port: null,
    log: false,
    logfile: 'serial1.dat',
    logstream: null,
    name: 'serial1',
    listeners: []
};
var serial2 = {
    device: process.argv[3],
    baudRate: 57600,
    port: null,
    log: false,
    logfile: 'serial2.dat',
    logstream: null,
    name: 'serial2',
    listeners: []
};

var abort = false;

// Blessed start ------------------------------------------------------------------------------------
var screen = blessed.screen({
    smartCSR: true,
    dockBorders: true,
    mouseEnable: true,
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
    height: '90%',
    content: '',
    border: {
        type: 'line'
    }
});
var commandBox = blessed.box({
    top: '80%',
    left: 0,
    width: '100%',
    height: '20%',
    border: {
        type: 'line'
    },
    scrollable: true,
    // alwaysScroll: true,
    mouse: true, // This is what actually makes the mouse scroll work
    scrollbar: {
        ch: ' ',
        track: {
            bg: 'cyan'
        },
        style: {
            inverse: true
        }
    },
    input: true,
    focused: true // Keep the focus on this window
});
screen.append(outputBox);
screen.append(commandBox);
screen.render();

var input2 = '';
function manageInput() {
    commandBox.on('keypress', function (key) {
        if (key) { // Check it because arrows and such come through undefined....
            var lastLineIndex = commandBox.getLines().length - 1;
            var lastLine = commandBox.getLine(lastLineIndex);
            if (!((input2 == '') && (key == '\r'))) { // This is a mess, related to the fact that after a \r is received, another one comes through right after for no apparent reason
                lastLine = lastLine.substr(0, lastLine.length - 1);
            }

            if (key == '\r') {// If it's a carriage return
                commandBox.setLine(lastLineIndex, lastLine);
                screen.render();
                processCommand(input2);
                input2 = '';
            } else {
                input2 += key;
                lastLine += key + '█';
                commandBox.setLine(lastLineIndex, lastLine);
                screen.render();
            }
        }
    });
}

function processCommand(inputLine) {
    if (inputLine == '') { // If it's empty, skip it
        return;
    }
    if ((inputLine == 'l1') || (inputLine == 'l2')) {
        var serial = (inputLine == 'l1') ? serial1 : serial2;
        serial.log = !serial.log; // Toggle logging
        if (serial.log) {
            printCommandBox('Now logging ' + serial.name + ' (' + serial.device + ') to ' + serial.logfile);
            serial.logstream = fs.createWriteStream(serial.logfile);
        } else {
            printCommandBox('Stopped logging serial (' + serial.device + ') to ' + serial.logfile);
            serial.logstream.close();
        }
        prompt();
        return;
    }

    if (inputLine.toLowerCase() == 'q') {
        cleanup();
        process.exit(0);
    }

    // Do this if nothing else
    printCommandBox('Unknown command.');
    prompt();
}

// --------------------------------------------------------------------------------------


setup().then(main).catch(function (err) {
    printCommand(err);
    abort = true;
    cleanup();
});

function main() {
    initXconnect(serial1, serial2);
    initXconnectListeners();
    // initUserInput();
    // buildInput();
    manageInput();
    prompt();
}


function initXconnectListeners() {
    serial1.listeners.push(function (data) {
        if (serial1.log) {
            serial1.logstream.write(data);
        }
    });
    serial2.listeners.push(function (data) {
        if (serial2.log) {
            serial2.logstream.write(data);
        }
    });
}

function initXconnect(s1, s2) {
    s1.port.on('data', function (data) {
        if (s2.port.isOpen()) {
            s2.port.write(data);
        }
        serial1.listeners.forEach(function (listener) {
            listener(data);
        })
    });

    s2.port.on('data', function (data) {
        if (s1.port.isOpen()) {
            s1.port.write(data);
        }
        serial2.listeners.forEach(function (listener) {
            listener(data);
        })
    });
    printCommand('Cross connecting ' + s1.device + ' to ' + s2.device);
}



function prompt() {
    printCommandBox('> █');
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
        printCommand(serial1.device + ' closing');
        serial1.port.close();
    }
    if (serial2.port) {
        printCommand(serial2.device + ' closing');
        serial2.port.close();
    }
}

function setup() {
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
            printCommand(s.device + ' opened as ' + s.name);
            if (abort) {
                printCommand(s.device + ' closing');
                serialPort1.close();
                cleanup();
            }
            resolve(serialPort1);
        });
    });
}

function printCommandBox(s) {
    commandBox.pushLine(s);
    commandBox.setScrollPerc(100);
    screen.render();
}

function printCommand(s) {
    // process.stdout.write(s)
    commandBox.pushLine(s.replace(/\n/g, ''));
    commandBox.setScrollPerc(100);
    screen.render();

}