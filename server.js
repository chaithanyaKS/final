const express = require("express");
const app = express();
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
const io = require("socket.io")(server);
// Peer

const { ExpressPeerServer } = require("peer");
const peerServer = ExpressPeerServer(server, {
  debug: true,
});

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/peerjs", peerServer);
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("action");
});

app.post("/", (req, res) => {
  const meetingId = req.body.meetingId;
  console.log(meetingId);
  if (meetingId) {
    res.render("join_meeting_login", { meetingId });
  } else {
    res.render("new_meeting_login");
  }
});

app.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const meetingId = req.body.meetingId;
  if (meetingId) {
    console.log(meetingId);
    res.redirect(`/${meetingId}`);
  } else {
    res.redirect(`/${uuidv4()}`);
  }
});

// app.get("/", (req, rsp) => {
//   rsp.redirect(`/${uuidv4()}`);
// });

app.get("/sessions", (req, res) => {
  res.send("session history");
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", userId);

    socket.on("message", (message) => {
      io.to(roomId).emit("createMessage", message);
    });

    socket.on("disconnect", () => {
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });
  });
});

server.listen(process.env.PORT || 3000);
