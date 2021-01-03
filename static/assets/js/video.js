const socket = io.connect(document.documentURI);

// Name Vars

let userName = "";
const userList = document.getElementById("userList");
const nameInput = document.getElementById("nameInput");
const nameButton = document.getElementById("nameButton");
const storedName = localStorage.getItem('userName');
let usernameDict = [];

// Video / Stream Vars

const localView = document.getElementById("localVideo");
const videoContainer = document.getElementById("videos");
const peerList = [];
let stream;

// Sets the constraints of the media devices that this code will be using.

const constraints = {audio: true, video: true};

// Configures the addresses of the ICE servers that this code will be using. The ICE servers get around port forwarding / network fuckery by outsourcing the determination of each peers network location to chumps like Google. (Or something like that, idk I'm a scientist, not a network engineer).

const config = {
  iceServers: [{
    urls: "stun:stun.l.google.com:19302"
  }]
};

async function start() {

  try {

    // Gets the local stream (so video stream and audio stream)

    stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Adds the local stream to the video object

    localView.srcObject = stream;
    
    // Joins the server, so other users are able to find and connect to this stream
    
    socket.emit("join", {id: socket.id, name: userName});
    
    document.getElementById("nameField").classList.add("is-hidden");
    document.getElementById("interface").classList.remove("is-hidden");

  } catch (err) {
    console.error(err);
  }

};

async function createPeerConnection(peerId) {
  
  // Checks if Peer Connection has already been made for the 
  
  if (!(peerId in peerList)) {
  
    // Sets a new peer connection, that will be found with the ice servers declared in the config variable.
    
    peerList[peerId] = new RTCPeerConnection(config);
    
    // Adds each stream to the peer connection, for it to be sent later
    
    stream.getTracks().forEach((track) => peerList[peerId].addTrack(track, stream));
    
    // Once the ICE server finds a viable candidate route for the two connections to talk down, an event will be called. This allows the candidate route to be sent over the sockets server to the other client.

    peerList[peerId].onicecandidate = (event) => {
      socket.emit("request", {sender: socket.id, receiver: peerId, candidate: event.candidate});
      console.log("Sent Ice Candidate to " + peerId);
    };

    // So what I think is happening is that this proposes a connection between the peer and the user. So it sets the description of the proposed connection locally, creates an offer to the other peer, and sends the proposed description that was just sent to the other peer. This probably ensures both connections are on the same page or something.

    peerList[peerId].onnegotiationneeded = async () => {
      try {

        await peerList[peerId].setLocalDescription(await peerList[peerId].createOffer());

        socket.emit("request", {sender: socket.id, receiver: peerId, desc: peerList[peerId].localDescription});

      } catch (err) {
        console.error(err);
      }
    };

    
//    peerList[peerId].oniceconnectionstatechange = async () => {
//      
//      if (peerList[peerId].iceConnectionState != "connected") {
//        console.log(peerId + " Disconnected!");
//        document.getElementById(peerId).remove();
//        delete peerList[peerId];
//      }
//      
//    }
    
    // It always generates two video streams for some reason, so this stops that from happening
    
    let hasVideo = false;
    
    // I think what this is doing is that once it gets a connection with the peer with a stream attached, it attaches that stream to the video object.
    
    peerList[peerId].ontrack = async (event) => {

      if (hasVideo == false) {
      
        addVideo(event, peerId);
        hasVideo = true;
      };

    };
    
  }
}

async function addVideo(video, peerId) {
  
  let videoDiv = document.createElement("div");
  
  videoDiv.classList.add("video");
  
  videoDiv.id = peerId;
  
  // Adds the username of the peer to the div for some CSS shenanigans
  
  videoDiv.setAttribute("username", usernameDict[peerId]);
  
  // Creates the video element 
  
  let remoteView = document.createElement("video");
  
  // Attaches the video stream
  
  remoteView.srcObject = video.streams[0];
  
  // Sets the settings of the video element
  
  remoteView.autoplay = true;
  remoteView.playsinline = true;
  
  videoDiv.appendChild(remoteView)
  
  videoContainer.appendChild(videoDiv);
  
  video.track.onended = (event) => {
    
    console.log("Stream ended");
    
    videoDiv.remove();
    delete peerList[peerId];
    
  };
  
  
}

async function dial(e) {

  let id = e.getAttribute("caller");
  console.log(id);
  createPeerConnection(id);
  
}

// So this gets messages from other clients

socket.on("request", async ({sender, receiver, desc, candidate}) => {
  try {
    
    createPeerConnection(sender);
    
    if (desc) {

      if (desc.type === "offer") {
        
        console.log("Got Offer from " + sender);
        
        await peerList[sender].setRemoteDescription(desc);

        // I thought this was already being done in the start function? Oh wait, this is if we don't start, and instead the other client starts.

        // const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // stream.getTracks().forEach((track) => peerCon.addTrack(track, stream));

        // localView.srcObject = stream;

        await peerList[sender].setLocalDescription(await peerList[sender].createAnswer());

        socket.emit("request", {sender: socket.id, receiver: sender, desc: peerList[sender].localDescription});

      } else if (desc.type === "answer") {
        
        console.log("Got Answer from " + sender);
        
        await peerList[sender].setRemoteDescription(desc);
      }

    } else if (candidate) {
      
      console.log("Got Candidate from " + sender);
      
      await peerList[sender].addIceCandidate(candidate);
    }
  } catch (err) {
    console.error(err);
  }
});


socket.on("userDisconnected", async (id) => {
  if (id in peerList) {
    document.getElementById(id).remove();
    delete peerList[id];
  }
})

//Handling Name Shit 

if (storedName) {
  nameInput.value = storedName;
}

nameButton.addEventListener("click", function() {
  event.preventDefault();

  if (nameInput.value != "") {
    userName = nameInput.value;
    localStorage.setItem('userName', userName);
    
    start();
    
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

  usernameDict = [];
  userList.innerHTML = "";
  
  data.forEach(user => {
    
    usernameDict[user[0]] = user[1];
    
    if (user[0] === socket.id) {
      userList.innerHTML += `<p>${user[1]} (You)</p>`;
    } else {
      userList.innerHTML += `<p><a caller="${user[0]}" onClick="dial(this);">${user[1]}</a></p>`;
    }
    
  });
});


// Rainbow Mode

function rainbow(e) {
  
  let videos = document.getElementsByTagName("video");
  let rainbowYes = e.checked;
  let hue = 0;
  
  if (rainbowYes) {
    rainbowloop = setInterval(function(){ 
      
      for (let video of videos) {
        video.style.filter = "hue-rotate(" + hue + "deg)";
      };
      
      hue += 1;
    
      if (hue == 360) {
        hue = 0;
      }
      
    }, 1);
    
  } else {
    clearInterval(rainbowloop);
    
  };
  
}
