const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const mongoose = require('mongoose')
const User = require('./models/user')
const { generateMessage, generateLocationMessage } = require('./utils/messages')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

mongoose.connect('mongodb://127.0.0.1:27017/chat-app', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
})

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function getDistance(lat1, lon1, lat2, lon2, unit) {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    else {
        var radlat1 = Math.PI * lat1/180;
        var radlat2 = Math.PI * lat2/180;
        var theta = lon1-lon2;
        var radtheta = Math.PI * theta/180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180/Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit=="K") { dist = dist * 1.609344 }
        if (unit=="N") { dist = dist * 0.8684 }
        return dist;
    }
}

io.on('connection', (socket) => {
    console.log('New WebSocket connection');

    socket.on('enter', (options, callback) => {
        console.log("Somebody entered the app")
        User.findOne({username: options.username}).then((user) => {
            console.log("Found user is : " + user)
            if (!user) {
                user = new User({
                    username: options.username,
                    position: options.position,
                    password: 1234567,
                    email: "zergshit@motherfu.ck",
                    socket: socket.id,
                    room: "waiting"
                });
                console.log("New user created: " + user.username)
            }

            socket.join("waiting");
            console.log(user.username + " entered waiting line");
            user.room = "waiting";

            user.save().then(() => {
                console.log("Saved user to database");
                User.find({room: "waiting"}).then((users) => {
                    console.log("Users currently waiting: " + users)
                    while (users.length > 1) { //Use for each instead of while. Loop through each element. This won't be interfered
                        const position1 = users[0].position;
                        const position2 = users[1].position;
                        const distance = getDistance(position1.latitude, position1.longitude, position2.latitude,
                            position2.longitude, 'K');
                        if (distance < 15) {
                            const roomID = makeid(5);
                            const socket1 = io.sockets.connected[users[0].socket];
                            const socket2 = io.sockets.connected[users[1].socket];
                            socket1.emit("matched", {room: roomID, id: users[0]._id});
                            socket2.emit("matched", {room: roomID, id: users[1]._id});
                            console.log("Matched " + users[0].username + " and " + users[1].username)
                            users.pop()
                            users.pop()
                        }
                    }
                }).catch((error) =>{
                    console.log(error)
                    return error
                })
            }).catch((e) => {
                console.log(e)
                return callback(e);
            });
        }).catch((e) => {
            console.log(e)
            return e
        })

        callback()
    });

    socket.on('join', (options, callback) => {
        console.log(options.room)
        socket.join(options.room);
        User.findByIdAndUpdate(options.userID, {_id: options.userID, room: options.room, socket: socket.id}).then(async (user) => {
            console.log(user.username + " joined " + options.room)
            socket.emit('message', generateMessage('Admin', 'Welcome!'));
            socket.broadcast.to(options.room).emit('message', generateMessage('Admin', `${user.username} has joined!`));
            io.to(options.room).emit('roomData', {
                room: options.room,
                users: await User.find({room: options.room})
            });
        }).catch((error) =>{
            console.log(error)
            return error
        })

        callback()
    });

    socket.on('sendMessage', (message, callback) => {
        console.log("Emitted Send Message")
        User.findOne({socket: socket.id}).then((user) => {
            console.log("User found: " + user)
            console.log("Type: " + typeof(user))
            let something = user.room
            console.log("Emitting to room: " + something)
            io.to(user.room).emit('message', generateMessage(user.username, message))
        })

        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        // User.findByIdAndUpdate({socket: socket.id}, {room: 'disconnected', socket: null}).then(async (user) => {
        //
        //     console.log(user.username + " disconnected")
        //     if (user) {
        //         io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
        //         io.to(user.room).emit('roomData', {
        //             room: user.room,
        //             users: getUsersInRoom(user.room)
        //         })
        //     }
        // }).catch((error) =>{
        //     console.log(error)
        //     return error
        // })
        console.log("Somebody disconnected")
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
})