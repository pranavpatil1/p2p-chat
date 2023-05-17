console.log("start");

const MULTIPLAYER = true;

/***

GAME OBJECTS

*/

class Ball {

  constructor(startX, startY, controllable, size) {
    // maps a username to a socket connection
    this.x = startX;
    this.y = startY;
    this.controllable = controllable;
    this.size = size;
  }
  
}

class Player extends Ball {
    constructor (name, startX, startY, controllable) {
        super(startX, startY, controllable, 50);
        this.username = name;
        this.kicking = false;
        
        this.up = false;
        this.down = false;
        this.left = false;
        this.right = false;
        
        this.vel = {
            x: 0,
            y: 0
        }
        
        this.speed = 4;
    }
    
    update() {
        // true = 1, false = 0
        this.vel.y += 100 * (this.down - this.up) / 30;
        this.vel.x += 100 * (this.right- this.left) / 30;
        
        this.vel.y *= 0.975;
        this.vel.x *= 0.975;
        
        this.x += this.vel.x / 30;
        this.y += this.vel.y / 30;
    }
    
    setParams(gameObject) {
        for (const key of Object.keys(gameObject)) {
            this[key] = gameObject[key];
        }
    }
}

/**

USERNAME LOADING

*/

// Set a Cookie
function getCookie(cName) {
      const name = cName + "=";
      const cDecoded = decodeURIComponent(document.cookie); //to be careful
      const cArr = cDecoded .split('; ');
      let res;
      cArr.forEach(val => {
          if (val.indexOf(name) === 0) res = val.substring(name.length);
      })
      return res;
}

const username = getCookie("username");

addChatMessage("username: " + username);



// const initiator = location.hash === '#host';

// go from /lobby/123124#something to 123124
var url = window.location.href;
var lobbyId = url.substring(url.lastIndexOf('/') + 1);
var hashLoc = lobbyId.lastIndexOf('#');
if (hashLoc !== -1) {
    lobbyId = lobbyId.substring(0, lobbyId.lastIndexOf('#'));
}

addChatMessage("Joining lobby " + lobbyId);

var peers = {};
var players = {};
const me = new Player(username, 200, 200, true);
const ball = new Ball(300, 200, false, 50);

players[username] = me;

if (MULTIPLAYER) {

// goes from http://localhost:3000/other/stuff to http://localhost:3000
var socket = io(window.location.href.split("/").splice(0, 3).join("/"));

const simplePeerOptions = {
  iceServers: [
      {
        urls: "stun:a.relay.metered.ca:80",
      },
      {
        urls: "turn:a.relay.metered.ca:80",
        username: "99e114727c10a9a346f607ee",
        credential: "WqgaDlQOQ5yiz2iq",
      },
      {
        urls: "turn:a.relay.metered.ca:80?transport=tcp",
        username: "99e114727c10a9a346f607ee",
        credential: "WqgaDlQOQ5yiz2iq",
      },
      {
        urls: "turn:a.relay.metered.ca:443",
        username: "99e114727c10a9a346f607ee",
        credential: "WqgaDlQOQ5yiz2iq",
      },
      {
        urls: "turn:a.relay.metered.ca:443?transport=tcp",
        username: "99e114727c10a9a346f607ee",
        credential: "WqgaDlQOQ5yiz2iq",
      },
  ],
};

function setupPeer(p, initiator, to, from) {
    p.on('error', err => console.log('error', err))

    if (initiator) {
        // I am from. I will initiate a connection with to.
        p.on('signal', data => {
            addChatMessage("sending offer to " + to);
            var strData = JSON.stringify(data);
            socket.emit('set-p2p-offer', {
                lobbyId: lobbyId,
                offer: strData,
                to: to,
                from: from
            });
        })
    } else {
        // I am "to". I have received an offer from "from"
        p.on('signal', data => {
            addChatMessage("sending answer to " + from);
            var strData = JSON.stringify(data);
            socket.emit('set-p2p-answer', {
                lobbyId: lobbyId,
                answer: strData,
                to: to,
                from: from
            });
        })
    }

    p.on('connect', () => {
        console.log('CONNECT');
        document.getElementById("chatWindow").removeAttribute("hidden");
        broadcast({
            type: "chat",
            message: 'Connected at ' + (new Date()).toString() + ' between ' + to + " and " + from
        })
    })

    p.on('data', data => {
        var data = JSON.parse(data);
        if (data.type == "gameData") {
            var gameObject = JSON.parse(data.gameObject);
            if (!(data.username in Object.keys(players))) {
                players[data.username] = new Player(data.username, 0, 0, false);
            }
            players[data.username].setParams(gameObject);
        } else {
            addChatMessage(data.message);
        }
    })
};


socket.on('connect', function (message) {
    console.log('client socket connection');
    
    socket.emit('join-lobby', {
        lobbyId: lobbyId,
        user: username
    });
});

socket.on('reply-lobby-users', message => {
    if (message === null) {
        window.location.href = "/";
    }
    // initiate a connection with everyone in the lobby
    for (const otherUser of message) {
        const p = new SimplePeer({
            initiator: true,
            trickle: false,
            objectMode:true,
            config:simplePeerOptions,
            iceTransportPolicy: 'relay'
        });
        setupPeer(p, true, otherUser, username);
        peers[otherUser] = p;
    }
});

// we received an offer from another user!!
socket.on('send-p2p-offer', function (message) {
    if (message.offer === null) {
        console.log("invalid offer received");
    } else {
        // check that this message was intended for us
        if (message.to !== username) {
            console.log("WRONG OFFER RECEIVED, SOMETHING WENT WRONG");
            return;
        }
        
        addChatMessage("received an offer from " + message.from);
        
        // for now just accept all connection offers
        const p = new SimplePeer({
            initiator: false,
            trickle: false,
            objectMode:true,
            config:simplePeerOptions,
            iceTransportPolicy: 'relay'
        });
        console.log(message.offer); /*** UNDEFINE!!! */
        setupPeer(p, false, message.to, message.from);
        peers[message.from] = p;
        p.signal(message.offer);
    }
});


socket.on('send-p2p-answer', function (message) {
    if (message.answer === null) {
        console.log("invalid lobby");
    } else {
        if (message.from !== username) {
            console.log("WRONG ANSWER RECEIVED, SOMETHING WENT WRONG");
            return;
        }
        addChatMessage("received an answer from " + message.to);
        
        peers[message.to].signal(message.answer);
    }
});

function broadcast(data) {
    for (const p of Object.values(peers)) {
        try{
            p.send(JSON.stringify(data));
        } catch (err) {
            console.log("error on send");
        }
    }
}

}

document.getElementById('chatForm').addEventListener('submit', ev => {
    ev.preventDefault()
    var message = document.getElementById("messageBox").value;
    console.log("attempting to send: " + message);
    broadcast({
        type: "chat",
        message: message
    })
    addChatMessage(message);
})

function addChatMessage(msg) {
    const node = document.createElement("p");
    const textnode = document.createTextNode(msg);
    node.appendChild(textnode);
    document.getElementById("chatMessages").appendChild(node);
}

function sendMessage(ev) {
    ev.preventDefault();
    
}

/*****

GAME CODE

*/


var programCode = function(processingInstance) {
    with (processingInstance) {
        size(800, 400); 
        frameRate(60);

        keyPressed = () => {
            if (keyCode == UP) {
                me.up = true;
            }
            if (keyCode == DOWN) {
                me.down = true;
            }
            if (keyCode == LEFT) {
                me.left = true;
            }
            if (keyCode == RIGHT) {
                me.right = true;
            }
        }
        
        keyReleased = () => {
            if (keyCode == UP) {
                me.up = false;
            }
            if (keyCode == DOWN) {
                me.down = false;
            }
            if (keyCode == LEFT) {
                me.left = false;
            }
            if (keyCode == RIGHT) {
                me.right = false;
            }
        }            

        draw = () => {
            background(154, 173, 85);
            
            me.update();

            for (const sprite of Object.values(players)) {
                fill(50, 50, 50);
                stroke(2);
                stroke(0, 0, 0);
                if (sprite.username == me.username) {
                    fill(200, 200, 200);
                }
                ellipse(sprite.x, sprite.y, 50, 50);
            }
            
            fill(40, 200, 200);
            noStroke();
            ellipse(ball.x, ball.y, 50, 50);
            
            if (MULTIPLAYER) {
                broadcast({
                    type: "gameData",
                    username: username,
                    gameObject: JSON.stringify(me)
                })
            }
        }
    }
};

  // Get the canvas that ProcessingJS will use
  var canvas = document.getElementById("mycanvas"); 
  // Pass the function to ProcessingJS constructor
  var processingInstance = new Processing(canvas, programCode); 