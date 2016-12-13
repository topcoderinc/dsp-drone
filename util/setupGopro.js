let exec = require('child_process').exec;

exec('echo ' + process.env.goproWifiPassword + '|wpa_passphrase ' + process.env.goproWifiNetwork + ' >' + __dirname + '/wpa.conf');
exec('wpa_supplicant -c ' + __dirname + '/wpa.conf -i wlan1 -B');
exec('dhcpcd wlan1 &');

