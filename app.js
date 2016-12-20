let gcs = require('./gcs.js');
let express = require('express');
let bodyParser = require("body-parser");
let compression = require('compression');
let request = require('request');
let gopro = require('./gopro.js');

gopro.setupGPIO(27);

let app = express();
app.use(compression());
app.use(bodyParser.json());

let serialDevice = process.env.PIXHAWK_SERIAL || process.argv[2]
gcs.setup({device: serialDevice, baudRate: 57600})
.then(() => {
    gcs.mavlinkSendCameraTrigger();
    main();
});

function main() {

    // Setup periodic pings to the DSP (move this somewhere else later)
    setInterval(function () {
        var telemetry = gcs.getTelemetry('GLOBAL_POSITION_INT');
        if (telemetry != undefined){
            var lat = telemetry.lat / Math.pow(10, 7);
            var lon = telemetry.lon / Math.pow(10, 7);
            request.put(
                'https://kb-dsp-server-dev.herokuapp.com/api/v1/drones/' + process.env.droneId_mongo,
                {
                    json: {
                        lat: lat,
                        lng: lon
                    }
                },
                function (error, response, body) {
                    if (error) {
                        console.log(error)
                    }
                }
            );
        }
    }, 60000);

    app.get('/api/v1', function (req, res) {
        res.json({version: 1.0});
    });

    app.get('/api/v1/telemetry/:stream', function (req, res) {
        let response;
        var telemetry = gcs.getTelemetry(req.params.stream.toUpperCase());
        if (telemetry){
            response = {
                result: 'success',
                data: telemetry
            };
        } else {
            response = {
                result: 'failed',
                reason: 'Telemetry unavailable'
            }
        }

        res.json(response);
    });

    app.post('/api/v1/telemetry/:stream', function (req, res){
        let result = gcs.mavlinkRequestDataStream(req.params.stream.toUpperCase(), req.body.rate, req.body.enable);
        res.json(Object.assign({result: 'success'}, result)); // fix this
    });

    app.get('/api/v1/mission', function (req, res) {
        gcs.mavlinkGetMission()
        .then(mission => {
            res.json(mission);
        })
    });

    app.post('/api/v1/mission', function (req, res) {
        gcs.mavlinkSendMission(req.body)
        .then(result => {
            res.json(result);
        })
    });

    app.post('/api/v1/rc/channel/:channelNumber', function (req, res) {
        gcs.mavlinkOverrideRcChannel(req.params.channelNumber, req.body.ppm);

        res.json({result: 'success'});

        // gcs.mavlinkSendArm(req.body.enable)
        // .then(result => {
        //     res.json(result);
        // })
        // .catch(err => {
        //     res.json({result: 'error', detail: err});
        // });

    });

    app.post('/api/v1/command/arm', function (req, res) {
        gcs.mavlinkSendArm(req.body.enable)
            .then(result => {
                res.json(result);
            })
            .catch(err => {
                res.json({result: 'error', detail: err});
            });
    });

    app.post('/api/v1/command/mode', function (req, res) {
        gcs.mavlinkSetMode(req.body.mode);
        res.json({result: 'success'});

    });

    app.post('/api/v1/camera/trigger', function (req, res) {
        gcs.mavlinkSendCameraTrigger()
        .then((response) => {
            res.json({result: 'success'});
        })
        .catch(err => {
            res.json({result: 'error', detail: err});
        })
    });

    let server = app.listen(80, function () {
        console.log('Server started on port 80');
    });
}
