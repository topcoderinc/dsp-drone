var serialPort = require('serialport');
var fs = require('fs');
var mavlink = require('mavlink');
var readline = require('readline');

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

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


setup().then(main).catch(function (err) {
    console.log(err);
    abort = true;
    cleanup();
});

function main() {
    initXconnect(serial1, serial2);
    initXconnectListeners();
    initUserInput();
    prompt();
}


function initXconnectListeners() {
    serial1.listeners.push(function (data) {
        if (serial1.log) {
            serial1.logstream.write(data)
        }
    });
    serial2.listeners.push(function (data) {
        if (serial2.log) {
            serial2.logstream.write(data)
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
    console.log('Cross connecting ' + s1.device + ' to ' + s2.device);
}

function initUserInput() {
    rl.on('line', function (input) {
        if ((input == 'l1') || (input == 'l2')) {
            var serial = (input == 'l1') ? serial1 : serial2;
            serial.log = !serial.log; // Toggle logging
            if (serial.log) {
                console.log('Now logging ' + serial.name + ' (' + serial.device + ') to ' + serial.logfile);
                prompt();
                serial.logstream = fs.createWriteStream(serial.logfile);
            } else {
                console.log('Stopped logging serial (' + serial.device + ') to ' + serial.logfile);
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
        console.log('Unknown command.');
        prompt();
        return;
    });
}

function prompt() {
    process.stdout.write('> ');
}

function cleanup() {
    closePorts();
    rl.close();
    if (serial1.logstream) {
        serial1.logstream.close();
    }
    if (serial2.logstream) {
        serial2.logstream.close();
    }
}

function closePorts() {
    if (serial1.port) {
        console.log(serial1.device + ' closing');
        serial1.port.close();
    }
    if (serial2.port) {
        console.log(serial2.device + ' closing');
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
            console.log(s.device + ' opened as ' + s.name);
            if (abort) {
                console.log(s.device + ' closing');
                serialPort1.close();
                cleanup();
            }
            resolve(serialPort1);
        });
    });
}