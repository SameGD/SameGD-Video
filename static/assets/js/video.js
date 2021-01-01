const socket = io.connect(document.documentURI);

const localView = document.getElementById("localVideo");
const videoContainer = document.getElementById("videos");
const connectedVideos = [];
// Sets the constraints of the media devices that this code will be using.

const constraints = {audio: true, video: true};

// Configures the addresses of the ICE servers that this code will be using. The ICE servers get around port forwarding / network fuckery by outsourcing the determination of each peers network location to chumps like Google. (Or something like that, idk I'm a scientist, not a network engineer).

const config = {
  iceServers: [{
    urls: "stun:stun.l.google.com:19302"
  }]
};

// Sets a new peer connection, that will be found with the ice servers declared in the config variable.

const peerCon = new RTCPeerConnection(config);

async function start() {

  try {

    // Gets the local stream (so video stream and audio stream)

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Adds each stream to the peer connection, for it to be sent later

    stream.getTracks().forEach((track) => peerCon.addTrack(track, stream));

    // Adds the local stream to the video object

    localView.srcObject = stream;

  } catch (err) {
    console.error(err);
  }

};

function dial(id) {
  
  start();

  // Once the ICE server finds a viable candidate route for the two connections to talk down, an event will be called. This allows the candidate route to be sent over the sockets server to the other client.

  peerCon.onicecandidate = ({candidate}) => {
    socket.emit("request", {sender: socket.id, receiver: id, candidate});
  };

  // Ugh i don't even know what's happening here.

  peerCon.onnegotiationneeded = async () => {
    try {
      await peerCon.setLocalDescription(await peerCon.createOffer());
      socket.emit("request", {sender: socket.id, receiver: id, desc: peerCon.localDescription});
    } catch (err) {
      console.error(err);
    }
};

  
}

// I think what this is doing is that once it gets a connection with the peer with a stream attached, it attaches that stream to the video object.

peerCon.ontrack = (event) => {
  
  let vidID = event.streams[0].id;
  
  if (!connectedVideos.includes(vidID)) {
  
    connectedVideos.push(vidID);

    let remoteView = document.createElement("video");

    remoteView.srcObject = event.streams[0];
    remoteView.autoplay = true;
    remoteView.playsinline = true;

    videoContainer.appendChild(remoteView);
  }

};


// So this gets messages from other clients

socket.on("request", async ({sender, receiver, desc, candidate}) => {
  try {
    if (desc) {

      if (desc.type === "offer") {
        await peerCon.setRemoteDescription(desc);

        // I thought this was already being done in the start function? Oh wait, this is if we don't start, and instead the other client starts.

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        stream.getTracks().forEach((track) => peerCon.addTrack(track, stream));

        localView.srcObject = stream;

        await peerCon.setLocalDescription(await peerCon.createAnswer());

        socket.emit("request", {sender: socket.id, receiver: sender, desc:  peerCon.localDescription});

      } else if (desc.type === "answer") {
        await peerCon.setRemoteDescription(desc);
      }

    } else if (candidate) {
      await peerCon.addIceCandidate(candidate);
    }
  } catch (err) {
    console.error(err);
  }
});

// Name Vars

let userName = "";
let userList = document.getElementById("userList");
let nameInput = document.getElementById("nameInput");
let nameButton = document.getElementById("nameButton");
const storedName = localStorage.getItem('userName');

//Handling Name Shit 

if (storedName) {
  nameInput.value = storedName;
}

nameButton.addEventListener("click", function() {
  event.preventDefault();

  if (nameInput.value != "") {
    userName = nameInput.value;
    localStorage.setItem('userName', userName);
    
    socket.emit("join", {id: socket.id, name: userName});
    
    document.getElementById("nameField").classList.add("is-hidden");
    document.getElementById("interface").classList.remove("is-hidden");
    
    
  } else {
    nameInput.placeholder = "You need to enter something my dude";
  }

});

nameInput.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    // Cancel the default action, if needed
    event.preventDefault();   
    nameButton.click();
  }
});


// Getting User List

socket.on("updateUsers", data => {

  userList.innerHTML = "";
  
  data.forEach(user => {
    
    if (user[0] === socket.id) {
    
      userList.innerHTML += `<p>${user[1]} (You)</p>`;
    } else {
      userList.innerHTML += `<p><a onClick="dial('${user[0]}');">${user[1]}</a></p>`;
    }
    
  });
});
