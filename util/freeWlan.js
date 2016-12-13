var fs = require('fs');
let wpa = require ('./wpa.js');

wpa.unmanageUnusedInterfaces()
.then((interfaces) => {
    interfaces.forEach((interface) => {
        console.log(interface + ' no longer managed.');
	fs.writeFile(__dirname + '/unmanagedwifi.txt', interface, (err) => {
            if (err) {
                console.log(err);
            }
        });
    });
});
