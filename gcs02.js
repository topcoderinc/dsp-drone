// Sets up a serial port and two mavlink objects (one for transmitting and one for receiving).
// The mavlinkReceive object listens to any messages from any System and Component, mavLinktranmist tranmits as System 252, Component 1
// The githib documentation is a little misleading, almost suggesting that you use the same object for transmitting a receiving
// however, the System and Component IDs are fixed once you instantiate the object, so if you *listen* to system #1, then you'd also
// be transmitting as system 1.

var serialPort = require('serialport');
var fs = require('fs');
var mavlink = require('mavlink');

var serialDevice1 = '/dev/cu.SLAB_USBtoUART';

var serialPort1;
var mavlinkReceive;
var mavlinkTransmit;


setup().then(main);

function main(){
    console.log('starting...');
    mavlinkSetup();
    sendHeartbeat();
    sendArm();
}

function sendHeartbeat(){ // Sends a standard heartbeat
    mavlinkTransmit.createMessage('HEARTBEAT', { // Send heartbeat
        'type': 6, // MAV_TYPE_GCS	Operator control unit / ground control station
        'autopilot': 8, // MAV_AUTOPILOT_INVALID	No valid autopilot, e.g. a GCS or other MAVLink component
        'base_mode': 192, // MAV_MODE_MANUAL_ARMED	System is allowed to be active, under manual (RC) control, no stabilization
        'custom_mode': 0, // A bitfield for use for autopilot-specific flags.
        'system_status': 4, // MAV_STATE_ACTIVE	System is active and might be already airborne. Motors are engaged.
        'mavlink_version': 3 // MAVLink version, not writable by user, gets added by protocol because of magic data type: uint8_t_mavlink_version
    }, function (message) {
        serialPort1.write(message.buffer);
    });
}

function sendArm(){
    mavlinkTransmit.createMessage('COMMAND_LONG', { // Send ARM command
        'target_system': 1, // System which should execute the command
        'target_component': 250, // Component which should execute the command, 0 for all components
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
        serialPort1.write(message.buffer);
    });
}

function mavlinkSetup(){
    serialPort1.on('data', function(data) {
        mavlinkReceive.parse(data);
    });

    // Listeners
    mavlinkReceive.on("message", function(message) { // General "catch-all" listener
        console.log('----------------------------------------');
        console.log(mavlinkReceive.getMessageName(message.id) + ' (' + message.id + ')');
        console.log('----------------------------------------');
        console.log(message);
        console.log();
    });

    mavlinkReceive.on('COMMAND_ACK', function (message, fields) {
        console.log('----------------------------------------');
        console.log('Decoding COMMAND_ACK (77)');
        console.log('----------------------------------------');
        console.log(fields);
        console.log();
    });
}


function setup(){
    return new Promise(function(resolve, reject){
        Promise.all([
            openSerial({
                device: serialDevice1,
                baudRate: 57600
            }),
            setupMavlinkReceive(),
            setupMavlinkTransmit()
        ]).then(function(results){
            serialPort1 = results[0];
            mavlinkReceive = results[1];
            mavlinkTransmit = results[2];
            resolve();
        })
    })
}

// openSerial(params)
//
// params:
//
// {
//     device: serialDevice1,
//     baudRate: 57600
// }
//
function openSerial(params){
    return new Promise(function(resolve, reject){
        var serialPort1 = new serialPort(params.device, {
            baudRate: params.baudRate
        }, function (err) {
            if (err) {
                reject(err.message);
            }
        });
        serialPort1.on('open', function () { // Wait for serial port to be open
            console.log('Serial setup complete');
            resolve(serialPort1);
        });
    });
}

function setupMavlinkReceive(){
    return new Promise(function(resolve, reject){
        var mavlink1 = new mavlink(0, 0, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
            console.log('Mavlink receive setup complete.');
            resolve(mavlink1);
        });
    });
}

function setupMavlinkTransmit(){
    return new Promise(function(resolve, reject){
        var mavlink1 = new mavlink(252, 1, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
            console.log('Mavlink transmit setup complete.');
            resolve(mavlink1);
        });
    });
}