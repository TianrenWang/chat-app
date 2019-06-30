const socket = io()

// Options
const { username } = Qs.parse(location.search, { ignoreQueryPrefix: true })

navigator.geolocation.getCurrentPosition((position) => {
    position = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
    }
    socket.emit('entered queue', {username, position}, (error) => {
        if (error) {
            alert(error)
            location.href = '/'
        }
    })
})

// socket.emit('entered queue', username, (error) => {
//     if (error) {
//         alert(error)
//         location.href = '/'
//     }
// })

socket.on('matched', (roomID) =>{
    window.location.href = "http://localhost:3000/chat.html?username=" + username + "&&room=" + roomID;
})