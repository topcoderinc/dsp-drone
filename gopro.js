let fs = require('fs');
let request = require('request');

function setupGPIO(gpio){
    if (fs.existsSync('/sys/class/gpio/gpio' + gpio ) == false) {
        fs.writeFileSync('/sys/class/gpio/export', gpio);
    }
    fs.writeFileSync('/sys/class/gpio/gpio' + gpio + '/direction', 'in');
    let pollRate = 100;
    let cooldown = 3000;
    let cooldownTimer = 0;

    setInterval(() => {
        if (cooldownTimer <= 0){
            if (readGPIO(gpio) == '1'){
                console.log('Snap!');
                cooldownTimer = cooldown;
                takePicture();
            }
        } else {
            cooldownTimer -= pollRate;
        }
    }, pollRate);
}

function readGPIO(gpio){
    return fs.readFileSync('/sys/class/gpio/gpio' + gpio + '/value', 'utf8')[0];
}

function takePicture(){
    request.get('http://10.5.5.9/gp/gpControl/command/mode?p=1', (() => {
        request.get('http://10.5.5.9/gp/gpControl/command/shutter?p=1');
    }));
}

module.exports = {
    setupGPIO: setupGPIO
};
