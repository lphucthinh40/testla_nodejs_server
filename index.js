const http_port = process.env.PORT || 5000;
const tcp_port = process.env.TCP_PORT || 8080;

const net = require('net');
const http = require('http');
const app = require('express')();

let sensor_left = 0.0;
let sensor_middle = 0.0;
let sensor_right = 0.0;
let sensor_back = 0.0;

let location_latitude = 0.0;
let location_longitude = 0.0;

let heading = 0;

let latitude = 123.4;
let longitude = 110.9;
let new_gps = false;

const HTTPserver = http.createServer(app);
const TCPserver = net.createServer();

const io = require('socket.io')(HTTPserver);

// TCP Server for communication with JS-Two board

TCPserver.listen(tcp_port, () => {
    console.log('TCP Server is running on port ' + tcp_port +'.');
});

let sockets = [];

let count = 0;

TCPserver.on('connection', function(sock) {
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
    // sockets.push(sock);
    // sock.setKeepAlive(true,300000);
    sock.on('data', function(data) {
        try {
            console.log('DATA ' + sock.remoteAddress + ': ' + data + '---' + count);
            count += 1;
            updateData(data.toString());
            // Write the data back to all the connected, the client will receive it as data from the server
            // sockets.forEach(function(sock, index, array) {
                if(new_gps) {
                    sock.write('GPS_DEST:'+latitude+','+longitude);
                    console.log('Sent to server!');
                    new_gps = false;
                }
            // });
            // }
        } catch (error) {
            count = 0;
        }
    });

    sock.on('close', function(data) {
        let index = sockets.findIndex(function(o) {
            return o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort;
        })
        if (index !== -1) sockets.splice(index, 1);
        console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });
    sock.on('error', function (exc) {
        console.log("ignoring exception: " + exc);
    });
});

function updateData(data) {
    const messages = data.split(";");
    messages.forEach((message) => { 
        const strs = message.split(":");
        if (strs.length == 2) {
            const header = strs[0];
            const body = strs[1];
            if (header === "SENSORS") {
                const sensor_data = body.split(",");
                if (sensor_data.length == 4) {
                    sensor_left = parseFloat(sensor_data[0]);
                    sensor_middle = parseFloat(sensor_data[1]);
                    sensor_right = parseFloat(sensor_data[2]);
                    sensor_back = parseFloat(sensor_data[3]);
                    console.log('left: ' + sensor_left + ' | middle: ' + sensor_middle + ' | right: ' + sensor_right + ' | back: ' + sensor_back);
                    io.emit('sensors', [sensor_left, sensor_middle, sensor_right, sensor_back].join(','));
                }
            } else if (header == "LOCATION") {
                const location_data = body.split(",");
                if (location_data.length == 2) {
                    location_latitude = parseFloat(location_data[0]);
                    location_longitude = parseFloat(location_data[1]);
                    console.log('latitude: ' + location_latitude + ' | longitude: ' + location_longitude);
                    io.emit('location', [location_latitude, location_longitude].join(','));
                }
            } else if (header == "HEADING") {
                heading = parseInt(body);            
                console.log('heading: ' + heading);
                io.emit('heading', heading);
            }
        }
    });
}

// HTTP Server for communication with webclient

app.get('/', (req, res) => {
    console.log('sent file');
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
    socket.on('gps', msg => {
      console.log('receive new gps coordinates: ' + msg);
      updateGPSData(msg.toString());
    });
});


HTTPserver.listen(http_port, () => {
console.log('HTTP Server is running on port 5000');
});

function updateGPSData(data) {
    const strs = data.split(",");
    if (strs.length == 2) {
        latitude = parseFloat(strs[0]);
        longitude = parseFloat(strs[1]);
        console.log('lat: ' + latitude + ' | long: ' + longitude);
        new_gps = true;
    }
}