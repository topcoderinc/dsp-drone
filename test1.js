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

port.on('data', function (data) {
    console.log('Data: ' + data);
    stream.write(data);
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


421427920