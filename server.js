const express = require("express");
const app = express();
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
const io = require("socket.io")(server);
const UserModel = require("./models/user");
const SessionModel = require("./models/session");
const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize(
  "mysql://root:chaithanya2934@localhost:3306/project"
);

const User = UserModel(sequelize, DataTypes);
const Session = SessionModel(sequelize, DataTypes);

let loggedUsers = [];
let hostId = null;

const { ExpressPeerServer } = require("peer");
const { log } = require("console");
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
    res.render("meeting", { meetingId, isNewMeeting: false });
  } else {
    res.render("meeting", {
      meetingId: uuidv4(),
      isNewMeeting: true,
    });
  }
});

app.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const isNewMeeting = req.body.isNewMeeting;
  if (loggedUsers.includes(username)) {
    // TODO: add flash message
    res.send("user already logged in");
  }
  User.findOne({ where: { name: username, password } })
    .then((user) => {
      if (user) {
        loggedUsers.push(user.name);
        const meetingId = req.body.meetingId;
        if (isNewMeeting) {
          hostId = user.name;
        }
        res.redirect(`/${meetingId}`);
      } else {
        // TODO: add flash message
        res.send("Invalid credentials");
      }
    })
    .catch((reason) => {
      console.log(reason);
    });
});

app.get("/sessions", (req, res) => {
  res.render("sessions");
});

app.get("/sessions/:id", (req, res) => {
  res.render("session", { id: req.params.id });
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
      loggedUsers = [];
    });
    socket.on("leave-meeting", () => {
      console.log("leave meeting");
      io.to(roomId).emit("leave-meeting");
    });
  });
});

server.listen(process.env.PORT || 3000);
