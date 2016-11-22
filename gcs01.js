var serialPort = require('serialport');
var fs = require('fs');
var mavlink = require('mavlink');


var device = '/dev/cu.SLAB_USBtoUART';
var outputFile = 'output.mavlink';

var stream = fs.createWriteStream(outputFile);

var HEARTBEAT = 0;
var SYS_STATUS = 1;
var SYSTEM_TIME = 2;
var PING = 4;
var CHANGE_OPERATOR_CONTROL = 5;
var CHANGE_OPERATOR_CONTROL_ACK = 6;
var AUTH_KEY = 7;
var SET_MODE = 11;
var PARAM_REQUEST_READ = 20;
var PARAM_REQUEST_LIST = 21;
var PARAM_VALUE = 22;
var PARAM_SET = 23;
var GPS_RAW_INT = 24;
var GPS_STATUS = 25;
var SCALED_IMU = 26;
var RAW_IMU = 27;
var RAW_PRESSURE = 28;
var SCALED_PRESSURE = 29;
var ATTITUDE = 30;
var ATTITUDE_QUATERNION = 31;
var LOCAL_POSITION_NED = 32;
var GLOBAL_POSITION_INT = 33;
var RC_CHANNELS_SCALED = 34;
var RC_CHANNELS_RAW = 35;
var SERVO_OUTPUT_RAW = 36;
var MISSION_REQUEST_PARTIAL_LIST = 37;
var MISSION_WRITE_PARTIAL_LIST = 38;
var MISSION_ITEM = 39;
var MISSION_REQUEST = 40;
var MISSION_SET_CURRENT = 41;
var MISSION_CURRENT = 42;
var MISSION_REQUEST_LIST = 43;
var MISSION_COUNT = 44;
var MISSION_CLEAR_ALL = 45;
var MISSION_ITEM_REACHED = 46;
var MISSION_ACK = 47;
var SET_GPS_GLOBAL_ORIGIN = 48;
var GPS_GLOBAL_ORIGIN = 49;
var PARAM_MAP_RC = 50;
var MISSION_REQUEST_INT = 51;
var SAFETY_SET_ALLOWED_AREA = 54;
var SAFETY_ALLOWED_AREA = 55;
var ATTITUDE_QUATERNION_COV = 61;
var NAV_CONTROLLER_OUTPUT = 62;
var GLOBAL_POSITION_INT_COV = 63;
var LOCAL_POSITION_NED_COV = 64;
var RC_CHANNELS = 65;
var REQUEST_DATA_STREAM = 66;
var DATA_STREAM = 67;
var MANUAL_CONTROL = 69;
var RC_CHANNELS_OVERRIDE = 70;
var MISSION_ITEM_INT = 73;
var VFR_HUD = 74;
var COMMAND_INT = 75;
var COMMAND_LONG = 76;
var COMMAND_ACK = 77;
var MANUAL_SETPOINT = 81;
var SET_ATTITUDE_TARGET = 82;
var ATTITUDE_TARGET = 83;
var SET_POSITION_TARGET_LOCAL_NED = 84;
var POSITION_TARGET_LOCAL_NED = 85;
var SET_POSITION_TARGET_GLOBAL_INT = 86;
var POSITION_TARGET_GLOBAL_INT = 87;
var LOCAL_POSITION_NED_SYSTEM_GLOBAL_OFFSET = 89;
var HIL_STATE = 90;
var HIL_CONTROLS = 91;
var HIL_RC_INPUTS_RAW = 92;
var HIL_ACTUATOR_CONTROLS = 93;
var OPTICAL_FLOW = 100;
var GLOBAL_VISION_POSITION_ESTIMATE = 101;
var VISION_POSITION_ESTIMATE = 102;
var VISION_SPEED_ESTIMATE = 103;
var VICON_POSITION_ESTIMATE = 104;
var HIGHRES_IMU = 105;
var OPTICAL_FLOW_RAD = 106;
var HIL_SENSOR = 107;
var SIM_STATE = 108;
var RADIO_STATUS = 109;
var FILE_TRANSFER_PROTOCOL = 110;
var TIMESYNC = 111;
var CAMERA_TRIGGER = 112;
var HIL_GPS = 113;
var HIL_OPTICAL_FLOW = 114;
var HIL_STATE_QUATERNION = 115;
var SCALED_IMU2 = 116;
var LOG_REQUEST_LIST = 117;
var LOG_ENTRY = 118;
var LOG_REQUEST_DATA = 119;
var LOG_DATA = 120;
var LOG_ERASE = 121;
var LOG_REQUEST_END = 122;
var GPS_INJECT_DATA = 123;
var GPS2_RAW = 124;
var POWER_STATUS = 125;
var SERIAL_CONTROL = 126;
var GPS_RTK = 127;
var GPS2_RTK = 128;
var SCALED_IMU3 = 129;
var DATA_TRANSMISSION_HANDSHAKE = 130;
var ENCAPSULATED_DATA = 131;
var DISTANCE_SENSOR = 132;
var TERRAIN_REQUEST = 133;
var TERRAIN_DATA = 134;
var TERRAIN_CHECK = 135;
var TERRAIN_REPORT = 136;
var SCALED_PRESSURE2 = 137;
var ATT_POS_MOCAP = 138;
var SET_ACTUATOR_CONTROL_TARGET = 139;
var ACTUATOR_CONTROL_TARGET = 140;
var ALTITUDE = 141;
var RESOURCE_REQUEST = 142;
var SCALED_PRESSURE3 = 143;
var FOLLOW_TARGET = 144;
var CONTROL_SYSTEM_STATE = 146;
var BATTERY_STATUS = 147;
var AUTOPILOT_VERSION = 148;
var LANDING_TARGET = 149;
var ESTIMATOR_STATUS = 230;
var WIND_COV = 231;
var GPS_INPUT = 232;
var GPS_RTCM_DATA = 233;
var HIGH_LATENCY = 234;
var VIBRATION = 241;
var HOME_POSITION = 242;
var SET_HOME_POSITION = 243;
var MESSAGE_INTERVAL = 244;
var EXTENDED_SYS_STATE = 245;
var ADSB_VEHICLE = 246;
var COLLISION = 247;
var V2_EXTENSION = 248;
var MEMORY_VECT = 249;
var DEBUG_VECT = 250;
var NAMED_VALUE_FLOAT = 251;
var NAMED_VALUE_INT = 252;
var STATUSTEXT = 253;
var DEBUG = 254;
var SETUP_SIGNING = 256;
var BUTTON_CHANGE = 257;
var PLAY_TUNE = 258;
var CAMERA_INFORMATION = 259;
var CAMERA_SETTINGS = 260;
var STORAGE_INFORMATION = 261;
var CAMERA_CAPTURE_STATUS = 262;
var CAMERA_IMAGE_CAPTURED = 263;
var FLIGHT_INFORMATION = 264;
var MOUNT_STATUS = 265;
var LOGGING_DATA = 266;
var LOGGING_DATA_ACKED = 267;
var LOGGING_ACK = 268;

var port = new serialPort(device, {
    baudRate: 57600
}, function (err) {
    if (err) {
        console.log(err.message);
    }
});

port.on('open', function () { // Wait for serial serial1 to be open
    console.log('Port ' + device + ' successfully opened.');

    var myMAV = new mavlink(1, 1, 'v1.0', ['common']); // Create Mavlink object and initialize things
    myMAV.on('ready', function () { // Wait for Mavlink to be ready

        port.on('data', function (data) { // Start listening for Mavlink messages and parsing them out
            myMAV.parse(data);
            // myMAV.createMessage('HEARTBEAT', { // Send ARM command
            //     'type': 6,
            //     'autopilot': 8,
            //     'base_mode': 0,
            //     'custom_mode': 0,
            //     'system_status': 3,
            //     'mavlink_version': 3
            // }, function (message) {
            //     serial1.write(message.buffer);
            //     myMAV.createMessage('COMMAND_LONG', { // Send ARM command
            //         'target_system': 1,
            //         'target_component': 250,
            //         'command': 400,
            //         'confirmation': 1,
            //         'param1': 1,
            //         'param2': 0,
            //         'param3': 0,
            //         'param4': 0,
            //         'param5': 0,
            //         'param6': 0,
            //         'param7': 0
            //     }, function (message2) {
            //         serial1.write(message2.buffer);
            //     });
            // });
        });

        // myMAV.on('GLOBAL_POSITION_INT', function(message, fields) { // Start listening for position frames
        //     console.log(fields);
        // });

        myMAV.on('message', function (message) {
            if (
                (message.id != VFR_HUD) &&
                (message.id != GLOBAL_POSITION_INT) &&
                (message.id != ATTITUDE) &&
                (message.id != HEARTBEAT) &&
                (message.id != SYS_STATUS) &&
                (message.id != SYSTEM_TIME) &&
                (message.id != GPS_RAW_INT) &&
                (message.id != RAW_IMU) &&
                (message.id != SCALED_PRESSURE) &&
                (message.id != NAV_CONTROLLER_OUTPUT) &&
                (message.id != MISSION_CURRENT) &&
                (message.id != STATUSTEXT)
            ) {
                console.log(message);
            }

        });

        myMAV.on('MAV_RESULT', function (message, fields) { // Start listening for command acks
            console.log(fields);
        });

        myMAV.on('COMMAND_ACK', function (message, fields) {
            console.log(fields);
        });

        myMAV.on('PARAM_VALUE', function (message, fields) {
            console.log(fields);
        });

        myMAV.on('STATUSTEXT', function (message, fields) {
            console.log(fields.text);
        });

        // myMAV.on('HEARTBEAT', function (message, fields) { // Start listening for command acks
        //     console.log(fields);
        // });


        myMAV.createMessage('HEARTBEAT', { // Send heartbeat
            'type': 6,
            'autopilot': 8,
            'base_mode': 0,
            'custom_mode': 0,
            'system_status': 3,
            'mavlink_version': 3
        }, function (message) {
            port.write(message.buffer);
            myMAV.createMessage('COMMAND_LONG', { // Send ARM command
                'target_system': 1,
                'target_component': 250,
                'command': 400,
                'confirmation': 1,
                'param1': 1,
                'param2': 0,
                'param3': 0,
                'param4': 0,
                'param5': 0,
                'param6': 0,
                'param7': 0
            }, function (message2) {
                port.write(message2.buffer);
                myMAV.createMessage('RC_CHANNELS_OVERRIDE', {
                    'target_system': 1,
                    'target_component': 250,
                    'chan1_raw': 2000,
                    'chan2_raw': 2000,
                    'chan3_raw': 2000,
                    'chan4_raw': 2000,
                    'chan5_raw': 0,
                    'chan6_raw': 0,
                    'chan7_raw': 0,
                    'chan8_raw': 0
                }, function (message3) {
                    port.write(message3.buffer);
                });
            });
        });


    });

    // close();
});


// myMAV.on('ready', function() {
//     //parse incoming serial data
//     serial1.on('data', function(data) {
//         myMAV.parse(data);

//         myMAV.createMessage("COMMAND_LONG", {
//             'target_system': 1,
//             'target_component': 0,
//             'command': 400,
//             'confirmation': 0,
//             'param1': 1,
//             'param2': 0,
//             'param3': 0,
//             'param4': 0,
//             'param5': 0,
//             'param6': 0,
//             'param7': 0
//         }, function(message){
//             serial1.write(message.buffer);
//         });
//     });

//     //listen for messages
//     myMAV.on('COMMAND_ACK', function(message, fields) {
//         console.log(fields);
//     });
// });

function close() {
    port.close(function (err) {
        if (err) {
            console.log(err.message);
        } else {
            console.log('Port ' + device + ' successfully closed.');
        }
    });
}

myMAV.createMessage('RC_CHANNELS_OVERRIDE', {
    'target_system': 1,
    'target_component': 250,
    'chan1_raw': 2000,
    'chan2_raw': 2000,
    'chan3_raw': 2000,
    'chan4_raw': 2000,
    'chan5_raw': 0,
    'chan6_raw': 0,
    'chan7_raw': 0,
    'chan8_raw': 0
}, function (message3) {
    port.write(message3.buffer);
});


var myMAV = new mavlink(252, 1, 'v1.0', ['common']); // Create Mavlink object and initialize things
myMAV.on('ready', function () { // Wait for Mavlink to be ready
    myMAV.createMessage('HEARTBEAT', { // Send heartbeat
        'type': 6,
        'autopilot': 8,
        'base_mode': 192,
        'custom_mode': 0,
        'system_status': 4,
        'mavlink_version': 3
    }, function (message) {
        port.write(message.buffer);
    };
};
