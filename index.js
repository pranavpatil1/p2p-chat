const express = require('express');
const path = require('path');
const socketIO = require('socket.io');
const http = require('http');

const app = express();
const port = 5000;

const server = http.Server(app);
server.listen(port, () => {
    console.log(`Now listening on port ${port}`);
});

const io = socketIO(server);

var lobbies = {};

class Lobby {

  constructor(name) {
    this.connections = []
  }
  
  addConnection(conn) {
    this.connections.push(conn);
  }
  
  getConnections() {
    return this.connections;
  }
}

class P2PConnection {

  constructor(name) {
    this.initiatorSocket = null;
    this.otherSocket = null;
    this.offer = null;
    this.answer = null;
  }

}

/**

CODE TO MANAGE LOBBIES

*/

app.get('/', (req, res) => {
    res.sendFile('index.html', {root: __dirname});
});

app.post('/createLobby', (req, res) => {
    const lobbyId = makeid(10);
    console.log("request to /createLobby");
    
    lobbies[lobbyId] = new Lobby();
    
    res.redirect('/lobby/'+lobbyId+"#host");
    
    console.log(lobbyId + " created");
    console.log(lobbies[lobbyId]);
});

app.post('/joinLobby', (req, res) => {
    console.log("request to /joinLobby");
    res.redirect('/lobby/UNIMPLEMENTED');
});

/** 

CODE FOR SIGNALING SERVER PORTION

*/

/**
app.post('/setupLobbyInitiator', (req, res) => {
    console.log("request to /setupLobby");
    var data = JSON.parse(req.data);
    console.log("data received: " + data);
    offers[data.lobby] = data.offer;
    // res.redirect('/lobby/'+makeid(10)+"#host");
});

app.post('/requestLobbyOffer', (req, res) => {
    console.log("request to /setupLobby");
    var data = JSON.parse(req.data);
    // res.redirect('/lobby/'+makeid(10)+"#host");
});

*/

/**

CODE FOR EVENT STREAM

*/


io.on('connect', function (socket) {
  console.log("connection!");
  
  socket.on('request-p2p-offer', function (message) {
    console.log(message);
    socket.emit('send-p2p-offer', {
        offer: lobbies[message.lobbyId].getConnections()[0].offer
    });
  });
  
  
  socket.on('set-p2p-offer', function (message) {
    console.log(message);
    
    var conn = new P2PConnection();
    conn.initiatorSocket = socket;
    conn.offer = message.offer;
    
    lobbies[message.lobbyId].addConnection(conn);
  });
  
  
  socket.on('set-p2p-answer', function (message) {
    console.log(message);
    
    var conn = lobbies[message.lobbyId].getConnections()[0];
    conn.otherSocket = socket;
    conn.answer = message.answer;
    
    conn.initiatorSocket.emit('send-p2p-answer', {
        answer: message.answer
    });
  });
  
  
  socket.on('request-p2p-offer', function (message) {
    console.log(message);
    
    var conn = lobbies[message.lobbyId].getConnections()[0];
    socket.emit('send-p2p-offer', {
        answer: conn.offer
    });
  });
});

/**

CODE FOR ACTUAL GAME

*/

app.get('/lobby/:id', (req, res) => {
    res.sendFile('lobby.html', {root: __dirname});
});

// for creating lobby ids
function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}


// serve static files
app.use(express.static(path.join(__dirname, 'public')));
