var mavlink = require('mavlink');

var mavlinkReceive = null;
var mavlinkTransmit = null;

setup();

exports.getMavlinkReceive = function(){
    return mavlinkReceive;
};

exports.createMavlinkDecoder = function(){
    return new mavlink(0, 0, 'v1.0', ['common']);
};

exports.sendHeartbeat = function(serialPort){ // Sends a standard heartbeat
    mavlinkTransmit.createMessage('HEARTBEAT', { // Send heartbeat
        'type': 6, // MAV_TYPE_GCS	Operator control unit / ground control station
        'autopilot': 8, // MAV_AUTOPILOT_INVALID	No valid autopilot, e.g. a GCS or other MAVLink component
        'base_mode': 192, // MAV_MODE_MANUAL_ARMED	System is allowed to be active, under manual (RC) control, no stabilization
        'custom_mode': 0, // A bitfield for use for autopilot-specific flags.
        'system_status': 4, // MAV_STATE_ACTIVE	System is active and might be already airborne. Motors are engaged.
        'mavlink_version': 3 // MAVLink version, not writable by user, gets added by protocol because of magic data type: uint8_t_mavlink_version
    }, function (message) {
        serialPort.write(message.buffer);
    });
}

exports.sendArm = function(serialPort){
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
        serialPort.write(message.buffer);
    });
}

function setupMavlinkReceive(){
    return new Promise(function(resolve, reject){
        var mavlink1 = new mavlink(0, 0, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
            resolve(mavlink1);
        });
    });
}

function setupMavlinkTransmit(){
    return new Promise(function(resolve, reject){
        var mavlink1 = new mavlink(252, 1, 'v1.0', ['common']); // Create Mavlink object and initialize things
        mavlink1.on('ready', function () { // Wait for Mavlink to be ready
            resolve(mavlink1);
        });
    });
}

function setup(){
    return new Promise(function(resolve, reject){
        Promise.all([
            setupMavlinkReceive(),
            setupMavlinkTransmit()
        ]).then(function(results){
            mavlinkReceive = results[0];
            mavlinkTransmit = results[1];
            resolve();
        })
    })
}
