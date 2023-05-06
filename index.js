const express = require('express');
const path = require('path');
const socketIO = require('socket.io');
const http = require('http');
var bodyParser = require('body-parser')

const app = express();
const port = 3000;

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

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

function createLobby(req, res) {
    const lobbyId = makeid(10);
    console.log("request to /createLobby");
    
    lobbies[lobbyId] = new Lobby();
    
    res.redirect('/lobby/'+lobbyId+"#host");
    
    console.log(lobbyId + " created");
}

function joinLobby(req, res) {
    console.log("request to /joinLobby");
    
    console.log(req.body)
    
    const lobbyId = req.body["lobby-code"]
    
    // invalid lobby code
    if (lobbyId.length !== 10) {
        res.redirect('/');
    }
    
    res.redirect('/lobby/' + lobbyId);
}

app.post('/joinLobby', (req, res) => {
    if (req.body['submit-type'] == "Create Lobby") {
        createLobby(req, res);
    } else {
        joinLobby(req, res);
    }
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
    var response = null;
    if (message.lobbyId in lobbies) {
        response = lobbies[message.lobbyId].getConnections()[0].offer;
    }
    socket.emit('send-p2p-offer', {
        offer: response
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
  
  
  socket.on('request-p2p-answer', function (message) {
    console.log(message);
    
    var response = null;
    if (message.lobbyId in lobbies) {
        const conn = lobbies[message.lobbyId].getConnections()[0];
        response = conn.offer;
    }
    socket.emit('send-p2p-answer', {
        answer: response
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

// handle form data
app.use(express.urlencoded());

// serve static files
app.use(express.static(path.join(__dirname, 'public')));
