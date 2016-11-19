var serialPort = require('serialport');
var fs = require('fs');
var mavlink = require('mavlink');

var myMAV = new mavlink(1,1,'v1.0',['common']);

var device = '/dev/tty.SLAB_USBtoUART';
var outputFile = 'output.mavlink';

var stream = fs.createWriteStream(outputFile);


var port = new serialPort(device, {
    baudRate: 57600
}, function(err){
    if (err) {
        console.log(err.message); 
    }
});

port.on('open', function() {
    console.log('Port ' + device + ' successfully opened.');
    // close();
});

myMAV.on('ready', function() {
    //parse incoming serial data
    port.on('data', function(data) {
        myMAV.parse(data);

console.log('here');
        myMAV.createMessage("COMMAND_LONG", {
            'target_system': 1,
            'target_component': 0,
            'command': 400,
            'confirmation': 0,
            'param1': 1,
            'param2': 0,
            'param3': 0,
            'param4': 0,
            'param5': 0,
            'param6': 0,
            'param7': 0
        }, function(message){
            port.write(message.buffer);
        });
    });

    //listen for messages
    myMAV.on('COMMAND_ACK', function(message, fields) {
        console.log(fields);
    });




});

function close(){
    port.close(function(err){
        if (err){
            console.log(err.message);
        } else {
            console.log('Port ' + device + ' successfully closed.');
        }
    });
}