var serialPort = require('serialport');
var mavlink = require('mavlink');

var serial1 = {
    device: process.argv[2], // Really the first param after the command name
    baudRate: 57600,
    port: null,
    name: 'serial1',
    listeners: {},
    params: {}
};

var mavlinkTransmit = {
    mavlink: null,
    systemId: 252, // Transmit from 252 (a common GCS ID number)
    componentId: 1,
    name: 'mavlinkTransmit'
};

var mavlinkReceive = {
    mavlink: null,
    systemId: 0, // Receive from anyone
    componentId: 0, // Receive from any component
    name: 'mavlinkReceive'
};


setup().then(main);

function main(){
    console.log('Starting');
    serial1.port.on('data', function (data) {
        mavlinkReceive.mavlink.parse(data);
    });
    getMission(mavlinkTransmit, mavlinkReceive, serial1)
    .then(function(mission){
        console.log(mission);
        serial1.port.close();
    })

}

function getMission(mavlinkTransmit, mavlinkReceive, serial){
    return new Promise(function(resolve, reject){

        Promise.resolve() // Only starting with this to keep it looking consistent (instead of starting with just a Promise, which I also could have done
        .then(function () {
            return new Promise(function (resolve, reject) {
                mavlinkReceive.mavlink.once('MISSION_COUNT', function(message, fields){ // Prepare a one time listener for the count
                    resolve(fields.count);
                });

                mavlinkTransmit.mavlink.createMessage('MISSION_REQUEST_LIST', { // Transmit the request, a response should hit the listener above
                    target_system: 1,
                    target_component: 190 // Why 190?
                }, function (message) {
                    serial.port.write(message.buffer);
                });
            })
        })
        .then(function(numMissionItems){


            return Promise.all([
                new Promise(function (resolve, reject) {
                    mavlinkReceive.mavlink.once('MISSION_ITEM', function(message, fields){ // Prepare a one time listener for the count
                        resolve(fields.x);
                    });

                    mavlinkTransmit.mavlink.createMessage('MISSION_REQUEST', { // Transmit the request, a response should hit the listener above
                        seq: 0,
                        target_system: 1,
                        target_component: 190
                    }, function (message) {
                        serial.port.write(message.buffer);
                    });
                }),
                new Promise(function (resolve, reject) {
                    mavlinkReceive.mavlink.once('MISSION_ITEM', function(message, fields){ // Prepare a one time listener for the count
                        resolve(fields.x);
                    });

                    mavlinkTransmit.mavlink.createMessage('MISSION_REQUEST', { // Transmit the request, a response should hit the listener above
                        seq: 1,
                        target_system: 1,
                        target_component: 190
                    }, function (message) {
                        serial.port.write(message.buffer);
                    });
                })

            ]).then(function (results) {
                resolve(results[0]);
            });
        })
        .then(function(result){
            resolve(result);
        });

    });
}

function setup() {
    return new Promise(function (resolve, reject) {
        Promise.all([
            openSerial(serial1),
            setupMavlink(mavlinkTransmit),
            setupMavlink(mavlinkReceive)
        ]).then(function (results) {
            resolve();
        }).catch(function (err) {
            reject(err);
        })
    })
}

function setupMavlink(m){
    return new Promise(function(resolve, reject){
        var mavlink1 = new mavlink(m.systemId, m.componentId, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
            console.log(m.name + ' setup complete');
            m.mavlink = mavlink1;
            resolve(mavlink1);
        });
    });
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
            s.port = serialPort1;
            resolve(serialPort1);
        });
    });
}




function print(s){
    console.log(s);
}