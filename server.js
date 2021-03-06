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
// TODO: set hostId to null
let hostId;
let hostName;
let userPredictions = [];
let userId;
let sessionId;

const { ExpressPeerServer } = require("peer");
const { hostname } = require("os");
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
  const sessionName = req.body.sessionName;
  const isNewMeeting = req.body.isNewMeeting;
  console.log(isNewMeeting);
  if (loggedUsers.includes(username)) {
    res.send("user already logged in");
  }
  User.findOne({ where: { name: username, password } })
    .then(async (user) => {
      if (user) {
        loggedUsers.push(user.id);
        userId = user.id;
        const meetingId = req.body.meetingId;
        if (isNewMeeting === "true") {
          hostId = user.id;
          hostName = user.name;
          console.log("host id: ", hostId);
          sessionId = meetingId;
          const newSession = Session.build({
            hostId,
            sessionId: meetingId,
            sessionName,
          });
          await newSession.save();
        }
        res.redirect(`/${meetingId}`);
      } else {
        res.send("Invalid credentials");
      }
    })
    .catch((reason) => {
      console.log(reason);
    });
});

app.get(`/sessions/:name`, async (req, res) => {
  hostName = req.params.name;
  Session.findAll({ where: { hostId } }).then((sessions) => {
    const data = sessions.map((session) => ({
      id: session.getDataValue("id"),
      sessionId: session.getDataValue("sessionId"),
      hostName: hostName,
      sessionName: session.getDataValue("sessionName"),
      date: new Date(session.getDataValue("updatedAt")).toLocaleString(
        "en-US",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      ),
      noOfMembers:
        session.getDataValue("sessionData") &&
        JSON.parse(session.getDataValue("sessionData")).length,
    }));
    res.render("sessions", { data });
  });
});

app.get("/sessions/:name/:id", async (req, res) => {
  const id = +req.params.id;
  const hostName = req.params.name;
  const classes = [
    "Neutral",
    "Happy",
    "Sad",
    "Angry",
    "Fearful",
    "Disgusted",
    "Surprised",
  ];
  const session = await Session.findOne({ where: { id } });
  const sessionData =
    session.getDataValue("sessionData") &&
    JSON.parse(session.getDataValue("sessionData"));
  if (sessionData === null || sessionData === undefined) {
    res.send("No Participants joined the meeting");
  }
  console.log(sessionData);
  const users = sessionData.map((user) => {
    const [userName] = Object.keys(user);
    return {
      name: userName,
      expression: classes[user[userName]],
    };
  });
  const overallRating = Math.floor(
    sessionData.reduce((acc, user) => (acc += +[Object.values(user)]), 0) /
      sessionData.length
  );
  console.log("overallRating: ", overallRating);
  const data = {
    id: session.getDataValue("id"),
    sessionId: session.getDataValue("sessionId"),
    hostName,
    sessionName: session.getDataValue("sessionName"),
    users,
    overallRating: classes[overallRating],
  };
  console.log(hostname);
  res.render("session", { id: req.params.id, data });
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room, userId, hostId, hostName });
});

io.on("connection", (socket) => {
  userPredictions = [];
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
    socket.on("user-predictions", async (userId, labels) => {
      if (Number.parseInt(userId) === hostId) return;
      const user = (await User.findOne({ where: { id: userId } })).name;
      const newUserPrediction = {
        [user]: Math.floor(
          labels.reduce((acc, val) => (acc += val), 0) / labels.length
        ),
      };
      console.log(labels);
      userPredictions.push(newUserPrediction);
      console.log(userPredictions);
      const jsonData = JSON.stringify(userPredictions);
      console.log("data:", jsonData);
      Session.update({ sessionData: jsonData }, { where: { sessionId } });
    });
  });
});

server.listen(process.env.PORT || 3000);
