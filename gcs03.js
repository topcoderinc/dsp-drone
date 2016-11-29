let serialPort = require('serialport');
let mavlink = require('mavlink');

let serial1 = {
    device: process.argv[2], // Really the first param after the command name
    baudRate: 57600,
    port: null,
    name: 'serial1',
    listeners: {},
    params: {}
};

let mavlinkTransmit = {
    mavlink: null,
    systemId: 252, // Transmit from 252 (a common GCS ID number)
    componentId: 1,
    name: 'mavlinkTransmit'
};

let mavlinkReceive = {
    mavlink: null,
    systemId: 0, // Receive from anyone
    componentId: 0, // Receive from any component
    name: 'mavlinkReceive'
};


setup().then(main);

function main() {
    console.log('Starting');
    serial1.port.on('data', function (data) {
        mavlinkReceive.mavlink.parse(data);
    });

    // mavlinkSendArm(mavlinkTransmit, mavlinkReceive, serial1)
    // .then(function(result){
    //     console.log(result);
    //     serial1.port.close();
    // })
    // .catch(function(result){
    //     console.log('Error:' + result);
    //     serial1.port.close();
    // })

    // mavlinkSendMission(mavlinkTransmit, mavlinkReceive, serial1, missionT)
    // .then(function(result){
    //     console.log(result);
    //     serial1.port.close();
    // });

    // mavlinkGetMission(mavlinkTransmit, mavlinkReceive, serial1)
    // .then(function(result){
    //     console.log(result);
    //     serial1.port.close();
    // });



    mavlinkReceive.mavlink.on('GLOBAL_POSITION_INT', function (message, fields) {
        console.log(fields);
    });

    mavlinkRequestDataStream(mavlinkTransmit, mavlinkReceive, serial1, 6, 1, true);


}

function mavlinkRequestDataStream(mavlinkTransmit, mavlinkReceive, serial, streamId, rate, enable){
    return new Promise(function(resolve, reject){
        mavlinkTransmit.mavlink.createMessage('REQUEST_DATA_STREAM', {
            "req_message_rate": rate,
            "target_system": 1,
            "target_component": 0,
            "req_stream_id": streamId,
            "start_stop": enable
        }, function (message) {
            serial.port.write(message.buffer);
            resolve();
        });
    })
}

function mavlinkSendMission(mavlinkTransmit, mavlinkReceive, serial, mission){
    return new Promise(function(resolve, reject){
        // Basically what this constructs is an array of promises, first with a listener to receive the ACK (which actually comes at the end)
        // then with a set of listeners to receive each request for a waypoint
        // heavy use of the ES6 spread operator which "unwraps" arrays - e.g.
        //
        // var x = [1, 2, 3]
        // var y = [...x, 4, 5, 6]
        // y = [1, 2, 3, 4, 5, 6]
        // console.log([...Array(mission.length).keys()]);
        let promiseAll = Promise.all( // Get the listeners ready first (in Promise.all form)
            [
                new Promise(function(resolve, reject){
                    mavlinkReceive.mavlink.on('MISSION_ACK', function (message, fields) {
                        resolve(fields);
                    });
                }),
                ...[...Array(mission.length).keys()].map(function(seq){
                    return new Promise(function(resolve, reject){
                        mavlinkReceive.mavlink.on('MISSION_REQUEST', function (message, fields) { // Prepare a one time listener for the count
                            if (fields.seq == seq) {
                                mavlinkTransmit.mavlink.createMessage('MISSION_ITEM', mission[seq], function (message) {
                                    serial.port.write(message.buffer);
                                });
                                resolve(fields);
                            }
                        });
                    })
                })
            ]
        )
        .then(function(result){
            resolve(result);
        });

        mavlinkTransmit.mavlink.createMessage('MISSION_COUNT', { // Trigger the start of loading the mission
            count: mission.length,
            target_system: 1,
            target_component: 1
        }, function (message) {
            serial.port.write(message.buffer);
        });
        return promiseAll; // Return the promise
    })

}


function mavlinkSendArm(mavlinkTransmit, mavlinkReceive, serial){
    return new Promise(function (resolve, reject) {
        let timeout = setTimeout(function () { // Return an error if I don't get an ACK after a while
            resolve('Error: mavlinkSendArm received no response');
        }, 5000);
        mavlinkReceive.mavlink.once('COMMAND_ACK', function (message, fields) { // Prepare a one time listener for the count
            if (fields.result == 0) {
                clearTimeout(timeout);
                resolve(fields);
            } else {
                reject(fields);
            }
        });
        mavlinkTransmit.mavlink.createMessage('COMMAND_LONG', { // Send ARM command
            'target_system': 1, // System which should execute the command
            'target_component': 1, // Component which should execute the command, 0 for all components, 1 for PX4, 250 for APM
            'command': 400, // Command ID, as defined by MAV_CMD enum. (MAV_CMD_COMPONENT_ARM_DISARM)
            'confirmation': 0, // 0: First transmission of this command. 1-255: Confirmation transmissions (e.g. for kill command)
            'param1': 1, // Mission Param #1	1 to arm, 0 to disarm
            'param2': 0, // Unused
            'param3': 0, // Unused
            'param4': 0, // Unused
            'param5': 0, // Unused
            'param6': 0, // Unused
            'param7': 0 // Unused
        }, function (message) {
            serial1.port.write(message.buffer);
        });
    })
}

function getMissionListPartial(mavlinkTransmit, mavlinkReceive, serial) { // PX4 isn't responding to this, not sure about APM
    return new Promise(function (resolve, reject) {
        Promise.resolve() // Only starting with this to keep it looking consistent (instead of starting with just a Promise, which I also could have done
        .then(function () {
            return new Promise(function (resolve, reject) {
                mavlinkReceive.mavlink.once('MISSION_COUNT', function (message, fields) { // Prepare a one time listener for the count
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
        .then(function (numMissionItems) {
            return new Promise(function (resolve, reject) {
                mavlinkReceive.mavlink.once('MISSION_COUNT', function (message, fields) { // Prepare a one time listener for the count
                    resolve(fields.count);
                });

                mavlinkTransmit.mavlink.createMessage('MISSION_REQUEST_PARTIAL_LIST', { // Transmit the request, a response should hit the listener above
                    target_system: 1,
                    target_component: 190, // Why 190?
                    start_index: 0,
                    end_index: -1
                }, function (message) {
                    serial.port.write(message.buffer);
                });
            })
        })
        .then(function (result) {
            resolve(result);
        });
    });
}

function mavlinkGetMission(mavlinkTransmit, mavlinkReceive, serial) { // This was a bitch to do with promises...
    return new Promise(function (resolve, reject) {
        Promise.resolve() // Only starting with this to keep it looking consistent (instead of starting with just a Promise, which I also could have done
        .then(function () {
            return new Promise(function (resolve, reject) {
                mavlinkReceive.mavlink.once('MISSION_COUNT', function (message, fields) { // Prepare a one time listener for the count
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
        .then(function (numMissionItems) {
            return Promise.all(
                [...Array(numMissionItems).keys()].map(function (seq) { // ... is the ES6 spread operator - this produces [0, 1, 2, 3 ....] up to numMissionItems
                    return new Promise(function (resolve, reject) {
                        mavlinkReceive.mavlink.on('MISSION_ITEM', function (message, fields) { // Prepare a one time listener for the count
                            if (fields.seq == seq) {
                                resolve(fields);
                            }
                        });

                        mavlinkTransmit.mavlink.createMessage('MISSION_REQUEST', { // Transmit the request, a response should hit the listener above
                            seq: seq,
                            target_system: 1,
                            target_component: 190
                        }, function (message) {
                            serial.port.write(message.buffer);
                        });
                    });
                })
            ).then(function (results) {
                mavlinkReceive.mavlink.removeAllListeners('MISSION_ITEM');
                resolve(results);
            });
        })
        .then(function (result) {
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

function setupMavlink(m) {
    return new Promise(function (resolve, reject) {
        let mavlink1 = new mavlink(m.systemId, m.componentId, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
            console.log(m.name + ' setup complete');
            m.mavlink = mavlink1;
            resolve(mavlink1);
        });
    });
}

function openSerial(s) {
    return new Promise(function (resolve, reject) {
        let serialPort1 = new serialPort(s.device, {
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


function print(s) {
    console.log(s);
}

let missionT = [
    {
        param1: 15,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.14289093017578,
        y: -88.01959228515625,
        z: 50,
        seq: 0,
        command: 22,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 1,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.14329147338867,
        y: -88.01960754394531,
        z: 50,
        seq: 1,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.14314270019531,
        y: -88.01907348632812,
        z: 50,
        seq: 2,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.1425666809082,
        y: -88.0190200805664,
        z: 50,
        seq: 3,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.142337799072266,
        y: -88.0195541381836,
        z: 50,
        seq: 4,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.14253234863281,
        y: -88.02017211914062,
        z: 50,
        seq: 5,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.143089294433594,
        y: -88.02022552490234,
        z: 50,
        seq: 6,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    },
    {
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 42.1429443359375,
        y: -88.01970672607422,
        z: 50,
        seq: 7,
        command: 16,
        target_system: 1,
        target_component: 190,
        frame: 3,
        current: 0,
        autocontinue: 1
    }
];