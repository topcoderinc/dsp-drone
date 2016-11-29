let gcs = require('./gcs.js');
let express = require('express');
let bodyParser = require("body-parser");
let compression = require('compression')

let app = express();
app.use(compression());
app.use(bodyParser.json());

gcs.setup({device: process.argv[2], baudRate: 57600})
.then(() => {
    main();
});

function main() {
    // gcs.mavlinkRequestDataStream(6, 1, false);
    // gcs.mavlinkRequestDataStream(gcs.MAV_DATA_STREAM_POSITION, 1, false);

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
        gcs.mavlinkRequestDataStream(req.params.stream.toUpperCase(), req.body.rate, req.body.enable);
        res.json({version: gcs.MAV_DATA_STREAM_POSITION}); // fix this
    });

    let server = app.listen(3000, function () {
        console.log('Server started on port 3000');
    });
}