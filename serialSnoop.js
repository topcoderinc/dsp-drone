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

// var rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });

var screen = blessed.screen({
    smartCSR: true,
    dockBorders: true,
    mouseEnable: true,
    debug: true
});
screen.title = 'Serial Snoop';

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
    content: '',
    border: {
        type: 'line'
    },
    style: {
        hover: {
            bg: 'red'
        }
    },
    keys: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        bg: 'blue',
        inverse: true
    },
    enableInput: true,
    mouseEnable: true
});
screen.append(outputBox);
screen.append(commandBox);
screen.render();
screen.key('Q', function () {
    process.exit(0);
});


setup().then(main).catch(function (err) {
    printCommand(err + '\n');
    abort = true;
    cleanup();
});

function main() {
    initXconnect(serial1, serial2);
    initXconnectListeners();
    // initUserInput();
    buildInput();
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
    printCommand('Cross connecting ' + s1.device + ' to ' + s2.device + '\n');
}

var input1 = '';
function buildInput() {
    commandBox.on('keypress', function (input) {
        if (input == '\r') {
            var lineToProcess = input1;
            input1 = '';
            if (lineToProcess.length != '\r') { // It has to be more than just the \r
                if ((lineToProcess == 'l1') || (lineToProcess == 'l2')) {
                    var serial = (lineToProcess == 'l1') ? serial1 : serial2;
                    serial.log = !serial.log; // Toggle logging
                    if (serial.log) {
                        printCommand('Now logging ' + serial.name + ' (' + serial.device + ') to ' + serial.logfile + '\n');
                        prompt();
                        serial.logstream = fs.createWriteStream(serial.logfile);
                    } else {
                        printCommand('Stopped logging serial (' + serial.device + ') to ' + serial.logfile + '\n');
                        prompt();
                        serial.logstream.close();
                    }
                    return;
                }

                if (lineToProcess.toLowerCase() == 'q') {
                    cleanup();
                    process.exit(0);
                }

                // Do this if nothing else
                printCommand('Unknown command.' + '\n');
                prompt();
                return;
            }

        } else {
            if ((input) && (/[a-zA-Z0-9]/.test(input))) { // Check it because arrows and such come through undefined....
                var lastLineIndex = commandBox.getLines().length - 1;
                var lastLine = commandBox.getLine(lastLineIndex);
                lastLine += input;
                commandBox.setLine(lastLineIndex, lastLine);
                screen.render();
                input1 += input;
            }
        }
    });
}

function initUserInput() {
    // rl.on('line', function (input) {
    commandBox.on('keypress', function (input) {
        printCommand(input);
        return;
        if ((input == 'l1') || (input == 'l2')) {
            var serial = (input == 'l1') ? serial1 : serial2;
            serial.log = !serial.log; // Toggle logging
            if (serial.log) {
                printCommand('Now logging ' + serial.name + ' (' + serial.device + ') to ' + serial.logfile + '\n');
                prompt();
                serial.logstream = fs.createWriteStream(serial.logfile);
            } else {
                printCommand('Stopped logging serial (' + serial.device + ') to ' + serial.logfile + '\n');
                prompt();
                serial.logstream.close();
            }
            return;
        }

        if (input.toLowerCase() == 'q') {
            cleanup();
            return;
        }

        // Do this if nothing else
        printCommand('Unknown command.' + '\n');
        prompt();
        return;
    });
}

function prompt() {
    printCommand('x> ');
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
        printCommand(serial1.device + ' closing' + '\n');
        serial1.port.close();
    }
    if (serial2.port) {
        printCommand(serial2.device + ' closing' + '\n');
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
            printCommand(s.device + ' opened as ' + s.name + '\n');
            if (abort) {
                printCommand(s.device + ' closing' + '\n');
                serialPort1.close();
                cleanup();
            }
            resolve(serialPort1);
        });
    });
}

function printCommand(s) {
    // process.stdout.write(s)
    commandBox.pushLine(s.replace(/\n/g, ''));
    commandBox.setScrollPerc(100);
    screen.render();

}