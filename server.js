const express = require("express");
const app = express();
app.use(express.static("static"));
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const users = [];
const sockets = [];

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

function updateUserNameList() {
  let userNameList = [];
  
  console.log(users);
  
  for (const [key, value] of Object.entries(users)) {
    userNameList.push([key, value]);
  }
  
  io.emit('updateUsers', userNameList);
  
}

io.on("connection", function(socket) {
  
  sockets[socket.id] = socket;
  
  socket.on("disconnect", (data) => {

    delete users[socket.id];
    
    updateUserNameList();
    
  });
  
  socket.on("join", (data) => {
    
    users[data.id] = data.name;
    updateUserNameList();
    
  });
  
  socket.on("request", (data) => {
    
    sockets[data.receiver].emit("request", data);
    
  });
  
});

http.listen(process.env.PORT || 80);