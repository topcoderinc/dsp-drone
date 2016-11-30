let serialPort = require('serialport');
let mavlink = require('mavlink');
let _ = require('lodash');

let serial1 = {};
let telemetry = {};

const MAV_DATA_STREAM_ALL = 0;
const MAV_DATA_STREAM_RAW_SENSORS = 1;
const MAV_DATA_STREAM_EXTENDED_STATUS = 2;
const MAV_DATA_STREAM_RC_CHANNELS = 3;
const MAV_DATA_STREAM_RAW_CONTROLLER = 4;
const MAV_DATA_STREAM_POSITION = 6;
const MAV_DATA_STREAM_EXTRA1 = 10;
const MAV_DATA_STREAM_EXTRA2 = 11;
const MAV_DATA_STREAM_EXTRA3 = 12;

let mavDataStreams = {
    MAV_DATA_STREAM_ALL: {
        id: 0,
        streams: ['IMU_RAW', 'GPS_RAW_INT', 'GPS_STATUS', 'CONTROL_STATUS', 'AUX_STATUS', 'RC_CHANNELS_SCALED', 'RC_CHANNELS_RAW', 'SERVO_OUTPUT_RAW', 'ATTITUDE_CONTROLLER_OUTPUT', 'POSITION_CONTROLLER_OUTPUT', 'NAV_CONTROLLER_OUTPUT', 'LOCAL_POSITION_NED', 'GLOBAL_POSITION', 'GLOBAL_POSITION_INT']
    },
    MAV_DATA_STREAM_RAW_SENSORS: {
        id: 1,
        streams: ['IMU_RAW', 'GPS_RAW_INT', 'GPS_STATUS']
    },
    MAV_DATA_STREAM_EXTENDED_STATUS: {
        id: 2,
        streams: ['GPS_STATUS', 'CONTROL_STATUS', 'AUX_STATUS']
    },
    MAV_DATA_STREAM_RC_CHANNELS: {
        id: 3,
        streams: ['RC_CHANNELS_SCALED', 'RC_CHANNELS_RAW', 'SERVO_OUTPUT_RAW']
    },
    MAV_DATA_STREAM_RAW_CONTROLLER: {
        id: 4,
        streams: ['ATTITUDE_CONTROLLER_OUTPUT', 'POSITION_CONTROLLER_OUTPUT', 'NAV_CONTROLLER_OUTPUT']
    },
    MAV_DATA_STREAM_POSITION: {
        id: 6,
        streams: ['LOCAL_POSITION_NED', 'GLOBAL_POSITION', 'GLOBAL_POSITION_INT']
    }
};

let mavlinkTransmit = {
    mavlink: null,
    systemId: 255, // Transmit from 252 or 255 (common GCS ID numbers). Note in order to do certain things, like override RC channels, your GCS ID must match the SYSID_MYGCS param in APM (there might be a similar restriction in PX4).
    componentId: 1,
    name: 'mavlinkTransmit'
};

let mavlinkReceive = {
    mavlink: null,
    systemId: 0, // Receive from anyone
    componentId: 0, // Receive from any component
    name: 'mavlinkReceive'
};

// function main() {
//     console.log('Starting');
//     serial1.port.on('data', function (data) {
//         mavlinkReceive.mavlink.parse(data);
//     });
//
//     // _mavlinkSendArm(mavlinkTransmit, mavlinkReceive, serial1)
//     // .then(function(result){
//     //     console.log(result);
//     //     serial1.port.close();
//     // })
//     // .catch(function(result){
//     //     console.log('Error:' + result);
//     //     serial1.port.close();
//     // })
//
//     // _mavlinkSendMission(mavlinkTransmit, mavlinkReceive, serial1, missionT)
//     // .then(function(result){
//     //     console.log(result);
//     //     serial1.port.close();
//     // });
//
//     // _mavlinkGetMission(mavlinkTransmit, mavlinkReceive, serial1)
//     // .then(function(result){
//     //     console.log(result);
//     //     serial1.port.close();
//     // });
//
//
//
//     mavlinkReceive.mavlink.on('GLOBAL_POSITION_INT', function (message, fields) {
//         console.log(fields);
//     });
//
//     _mavlinkRequestDataStream(mavlinkTransmit, serial1, 6, 1, true);
//
//
// }

function getTelemetry(stream){
    return telemetry[stream];
}

function mavlinkRequestDataStream(streamId, rate, enable){
    let idName, idNumber;
    if (typeof streamId == 'string') { // Handle the id as either a name or a number
        idNumber = mavDataStreams[streamId].id;
        idName = streamId;
    } else {
        idNumber = streamId;
        idName = _.findKey(mavDataStreams, {'id': streamId});
    }

    mavDataStreams[idName].streams.forEach(stream => {
        mavlinkReceive.mavlink.removeAllListeners(stream);
        delete telemetry[stream];
    });
    if (enable){
        mavDataStreams[idName].streams.forEach(stream => {
            mavlinkReceive.mavlink.on(stream, function(message, fields) {
                telemetry[stream] = fields;
            });
        });
    }
    _mavlinkRequestDataStream(mavlinkTransmit, serial1, idNumber, rate, enable);
    return({enable: enable, streams: mavDataStreams[idName].streams});
}

function _mavlinkRequestDataStream(mavlinkTransmit, serial, streamId, rate, enable){
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

function mavlinkSendMission(mission){
    return _mavlinkSendMission(mavlinkTransmit, mavlinkReceive, serial1, mission);
}
function _mavlinkSendMission(mavlinkTransmit, mavlinkReceive, serial, mission){
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

function mavlinkOverrideRcChannel(channel, ppmValue){
    _mavlinkOverrideRcChannel(mavlinkTransmit, serial1, channel, ppmValue);
}

function _mavlinkOverrideRcChannel(mavlinkTransmit, serial, channel, ppmValue){
    let overrideCommand = {
        target_system: 1, // System ID
        target_component: 1, // Component ID
        chan1_raw: 0, //  RC channel 1 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan2_raw: 0, //  RC channel 2 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan3_raw: 0, //  RC channel 3 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan4_raw: 0, //  RC channel 4 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan5_raw: 0, //  RC channel 5 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan6_raw: 0, //  RC channel 6 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan7_raw: 0, //  RC channel 7 value, in microseconds. A value of UINT16_MAX means to ignore this field.
        chan8_raw: 0 //  RC channel 8 value, in microseconds. A value of UINT16_MAX means to ignore this field.
    };
    overrideCommand[`chan${channel}_raw`] = ppmValue;
    mavlinkTransmit.mavlink.createMessage('RC_CHANNELS_OVERRIDE', overrideCommand, function (message) {
        serial1.port.write(message.buffer);
    });
}

function mavlinkSendArm(enable){
    return _mavlinkSendArm(mavlinkTransmit, mavlinkReceive, serial1, enable);
}

function _mavlinkSendArm(mavlinkTransmit, mavlinkReceive, serial, enable){
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
            'param1': enable, // Mission Param #1	1 to arm, 0 to disarm
            'param2': 0, // Unused
            'param3': 0, // Unused
            'param4': 0, // Unused
            'param5': 0, // Unused
            'param6': 0, // Unused
            'param7': 0 // Unused
        }, function (message) {
            serial.port.write(message.buffer);
        });
    })
}

function mavlinkSetMode(mode){
    return _mavlinkSetMode(mavlinkTransmit, mavlinkReceive, serial1, mode);
}

function _mavlinkSetMode(mavlinkTransmit, mavlinkReceive, serial, mode){

    // This is the non-depreciated way to do it, but not supported by APM
    // mavlinkTransmit.mavlink.createMessage('COMMAND_LONG', { // Send ARM command
    //     'target_system': 1, // System which should execute the command
    //     'target_component': 1, // Component which should execute the command, 0 for all components, 1 for PX4, 250 for APM
    //     'command': 176, // Set system mode.
    //     'confirmation': 0, // 0: First transmission of this command. 1-255: Confirmation transmissions (e.g. for kill command)
    //     'param1': mode, // Mode, as defined by ENUM MAV_MODE
    //     'param2': 0, // Custom mode - this is system specific, please refer to the individual autopilot specifications for details.
    //     'param3': 0, // Custom sub mode - this is system specific, please refer to the individual autopilot specifications for details.
    //     'param4': 0, // Unused
    //     'param5': 0, // Unused
    //     'param6': 0, // Unused
    //     'param7': 0 // Unused
    // }, function (message) {
    //     serial.port.write(message.buffer);
    // });

    mavlinkTransmit.mavlink.createMessage('SET_MODE', {
        custom_mode: mode,
        target_system: 1,
        base_mode: 1
        }, function (message) {
            serial.port.write(message.buffer);
        });
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

function mavlinkGetMission(){
    return _mavlinkGetMission(mavlinkTransmit, mavlinkReceive, serial1);
}

function _mavlinkGetMission(mavlinkTransmit, mavlinkReceive, serial) { // This was a bitch to do with promises...
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

function setup(serial) {
    serial1 = serial;
    serial1.port = null;
    serial1.name = 'serial1';
    return new Promise(function (resolve, reject) {
        Promise.all([
            openSerial(serial1),
            setupMavlink(mavlinkTransmit),
            setupMavlink(mavlinkReceive)
        ]).then(function (results) {
            serial1.port.on('data', data => {
                mavlinkReceive.mavlink.parse(data);
            });
            resolve();
        }).catch(function (err) {
            reject(err);
        })
    })
}

function close(){
    print('Closing ' + serial1.device);
    serial1.port.close();
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

function createMavlinkDecoder() {
    return new Promise(function (resolve, reject) {
        let mavlink1 = new mavlink(0, 0, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
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

module.exports = {
    setup: setup,
    close: close,
    createMavlinkDecoder: createMavlinkDecoder,
    mavlinkRequestDataStream: mavlinkRequestDataStream,
    getTelemetry: getTelemetry,
    mavlinkGetMission: mavlinkGetMission,
    mavlinkSendMission: mavlinkSendMission,
    mavlinkSendArm: mavlinkSendArm,
    mavlinkOverrideRcChannel: mavlinkOverrideRcChannel,
    mavlinkSetMode: mavlinkSetMode,
    MAV_DATA_STREAM_ALL: MAV_DATA_STREAM_ALL,
    MAV_DATA_STREAM_RAW_SENSORS: MAV_DATA_STREAM_RAW_SENSORS,
    MAV_DATA_STREAM_EXTENDED_STATUS: MAV_DATA_STREAM_EXTENDED_STATUS,
    MAV_DATA_STREAM_RC_CHANNELS: MAV_DATA_STREAM_RC_CHANNELS,
    MAV_DATA_STREAM_RAW_CONTROLLER: MAV_DATA_STREAM_RAW_CONTROLLER,
    MAV_DATA_STREAM_POSITION: MAV_DATA_STREAM_POSITION,
    MAV_DATA_STREAM_EXTRA1: MAV_DATA_STREAM_EXTRA1,
    MAV_DATA_STREAM_EXTRA2: MAV_DATA_STREAM_EXTRA2,
    MAV_DATA_STREAM_EXTRA3: MAV_DATA_STREAM_EXTRA3
};

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