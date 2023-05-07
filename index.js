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
    // maps a username to a socket connection
    this.users = {};
  }
  
  getSocket(username) {
      if (username in this.users) {
          return this.users[username];
      } else {
          return null;
      }
  }
  
  addUser(username, socket) {
      console.log("adding user " + username);
      if (!(username in this.users)) {
          this.users[username] = socket;
          return true;
      }
      return false;
  }
  
  removeUser(username) {
      if (username in this.users) {
          delete this.users[username];
      }
      // NEED TO ALSO CLEAN UP CONNECTIONS
  }
  
  getUsers() {
      return Object.keys(this.users);
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
  
  // when a client just joins a lobby they ask for this
  socket.on('join-lobby', message => {
      console.log("socket req sent to join-lobby");
      console.log(message);
      var output = [];
      if (message.lobbyId in lobbies) {
          output = lobbies[message.lobbyId].getUsers();
          const success = lobbies[message.lobbyId].addUser(message.user, socket);
          if (!success) {
              socket.emit('reply-lobby-users', null);
              return;
          }
      }
      socket.emit('reply-lobby-users', output);
  });
  
  socket.on('set-p2p-offer', function (message) {
    console.log(message);
    
    // send a message to whoever it's to about this request to create a conn
    const receiverSocket = lobbies[message.lobbyId].getSocket(message.to);
    receiverSocket.emit('send-p2p-offer', {
        offer: message.offer,
        to: message.to,
        from: message.from
    });
  });
  
  socket.on('set-p2p-answer', function (message) {
    console.log(message);
    
    const receiverSocket = lobbies[message.lobbyId].getSocket(message.from);    
    receiverSocket.emit('send-p2p-answer', {
        answer: message.answer,
        to: message.to,
        from: message.from
    });
  });
  
  /*
  socket.on('disconnect', message => {
      console.log("client disconnected");
      for (const lobbyId in lobbies)
  });*/
  
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
