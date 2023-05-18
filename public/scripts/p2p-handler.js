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
    
    this.vel = {
        x: 0,
        y: 0
    }
  }
  
  update() {
        this.x += this.vel.x / 30;
        this.y += this.vel.y / 30;
  }
  
  getDistance (other) {
      return Math.sqrt((other.x - this.x) ** 2 + (other.y - this.y) ** 2);
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
        
        this.speed = 4;
    }
    
    update() {
        // true = 1, false = 0
        this.vel.y += 100 * (this.down - this.up) / 30;
        this.vel.x += 100 * (this.right- this.left) / 30;
        
        this.vel.y *= 0.975;
        this.vel.x *= 0.975;
        
        // slow down player when they're kicking
        if (this.kicking) {
            this.vel.y *= 0.975;
            this.vel.x *= 0.975;
        }
        
        super.update();
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
var sprites = [];
const me = new Player(username, 200, 200, true);
const ball = new Ball(300, 200, false, 50);

sprites.push(me);
sprites.push(ball);

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
                var newPlayer = new Player(data.username, 0, 0, false);
                players[data.username] = newPlayer;
                sprites.push(newPlayer);
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
        size(document.body.clientWidth * 3/4, window.innerHeight); 
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
            if (keyCode == 32) {
                me.kicking = true;
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
            if (keyCode == 32) {
                me.kicking = false;
            }
        }
        
        const fieldSize = {
            width: 1500,
            height: 900
        };
        
        drawScene = () => {
            // background of everything
            background(69, 150, 5);
            
            pushMatrix();
            
            // move camera to center player
            translate(-me.x + width/2, -me.y + height/2);
            
            noStroke();
            fill(63, 138, 2);
            for (var i = 0; i < fieldSize.width; i += 200) {
                rect(i, 0, 100, fieldSize.height);
            }
            
            // have a rectangle around where the field is
            strokeWeight(5);
            stroke(165, 234, 109);
            noFill();
            rect(0, 0, fieldSize.width, fieldSize.height);
            
            for (const sprite of Object.values(players)) {
                fill(50, 50, 50);
                strokeWeight(5);
                stroke(0, 0, 0);
                if (sprite.kicking) {
                    strokeWeight(7);
                }
                if (sprite.username == me.username) {
                    fill(200, 200, 200);
                }
                ellipse(sprite.x, sprite.y, sprite.size, sprite.size);
            }
            
            fill(40, 200, 200);
            strokeWeight(5);
            stroke(0, 0, 0);
            ellipse(ball.x, ball.y, ball.size, ball.size);
            
            popMatrix();
        };
        
        applyCollisions = () => {
            
            /**   BOUNDARY COLLISIONS  */
            
            var boundaries = {
                left: -50,
                right: fieldSize.width + 50,
                top: -50,
                bottom: fieldSize.height + 50
            };
            
            if (me.x - me.size / 2 < boundaries.left) {
                me.x = boundaries.left + me.size / 2;
                if (me.vel.x < 0) {
                    me.vel.x *= -0.8;
                }
            } else if (me.x + me.size / 2 > boundaries.right) {
                me.x = boundaries.right - me.size / 2;
                if (me.vel.x > 0) {
                    me.vel.x *= -0.8;
                }
            }
            
            if (me.y - me.size / 2 < boundaries.top) {
                me.y = me.size / 2 + boundaries.top;
                if (me.vel.y < 0) {
                    me.vel.y *= -0.8;
                }
            } else if (me.y + me.size / 2 > boundaries.bottom) {
                me.y = boundaries.bottom - me.size / 2;
                if (me.vel.y > 0) {
                    me.vel.y *= -0.8;
                }
            }
            
            /**   BALL TO BALL COLLISIONS  */
            const dampening = 1;
            for (const other of sprites) {
                // handle collisions with sprites that aren't me
                if (other !== me) {
                    if (me.getDistance(other) < (me.size + other.size) / 2) {
                        console.log('COLLISION OCCURRED');
                        
                        /*
                        me.vel.x *= -dampening;
                        me.vel.y *= -dampening;
                        other.vel.x *= -dampening;
                        other.vel.y *= -dampening;
                        */
                        
                        var transferX = me.vel.x - other.vel.x;
                        var transferY = me.vel.y - other.vel.y;
                        
                        me.vel.x -= transferX;
                        me.vel.y -= transferY;
                        
                        other.vel.x += transferX;
                        other.vel.y += transferY;
                    }
                }
            }
        };
        
        draw = () => {
            drawScene();
            for (const s of sprites) {
                s.update();
            }
            applyCollisions();

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