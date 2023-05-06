console.log("start");

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

const initiator = location.hash === '#host';

// go from /lobby/123124#something to 123124
var url = window.location.href;
var lobbyId = url.substring(url.lastIndexOf('/') + 1);
var hashLoc = lobbyId.lastIndexOf('#');
if (hashLoc !== -1) {
    lobbyId = lobbyId.substring(0, lobbyId.lastIndexOf('#'));
}

const p = new SimplePeer({
    initiator: initiator,
    trickle: false
})

if (initiator) {
    addChatMessage("tell your friend to go to this link: " + url.substring(0, url.lastIndexOf("#")));
}

// goes from http://localhost:3000/other/stuff to http://localhost:3000
var socket = io(window.location.href.split("/").splice(0, 3).join("/"));

socket.on('send-p2p-offer', function (message) {
    if (message.offer === null) {
        window.location.href="/";
        console.log("invalid lobby");
    } else {
        p.signal(message.offer);
    }
});
socket.on('send-p2p-answer', function (message) {
    if (message.answer === null) {
        window.location.href="/";
        console.log("invalid lobby");
    } else {
        p.signal(message.answer);
    }
});

socket.on('connect', function (message) {
    console.log('client socket connection');
    if (!initiator) {
        console.log('not initiator');
        // ask for the associated offer for the lobby
        socket.emit('request-p2p-offer', {
            lobbyId: lobbyId
        });
    }
});


p.on('error', err => console.log('error', err))

p.on('signal', data => {
    var strData = JSON.stringify(data);
    
    // console.log('SIGNAL', JSON.stringify(data));
    // document.querySelector('#outgoing').textContent = JSON.stringify(data);
    
    if (initiator) {
        socket.emit('set-p2p-offer', {
            lobbyId: lobbyId,
            offer: strData
        });
    } else {
        socket.emit('set-p2p-answer', {
            lobbyId: lobbyId,
            answer: strData
        });
    }
})
/*
document.getElementById('initialize').addEventListener('submit', ev => {
    ev.preventDefault()
    p.signal(JSON.parse(document.querySelector('#incoming').value))
})
*/
p.on('connect', () => {
    console.log('CONNECT');
    document.getElementById("chatWindow").removeAttribute("hidden");
    p.send('Connected at ' + (new Date()).toString())
})

p.on('data', data => {
    addChatMessage(data);
})

document.getElementById('chatForm').addEventListener('submit', ev => {
    ev.preventDefault()
    var message = document.getElementById("messageBox").value;
    console.log("attempting to send: " + message);
    p.send(message);
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