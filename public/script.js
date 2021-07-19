const socket = io("/");
const chatInputBox = document.getElementById("chat_message");
const all_messages = document.getElementById("all_messages");
const main__chat__window = document.getElementById("main__chat__window");
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");

myVideo.muted = true;

console.log("hi");

const myPeer = new Peer(undefined, {
  path: "/",
  host: "/",
  port: "3001",
});

const peers = {};
let myVideoStream;

async function model_init() {
  model = await tf.loadLayersModel("http://127.0.0.1:8080/model.json");
  console.log(model.summary());
}

const getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("http://127.0.0.1:8081/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("http://127.0.0.1:8081/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("http://127.0.0.1:8081/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("http://127.0.0.1:8081/models"),
  model_init(),
]).then(startVideo);

function startVideo() {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: true,
    })
    .then((stream) => {
      myVideoStream = stream;
      console.log(stream);
      addVideoStream(myVideo, stream);

      myPeer.on("call", (call) => {
        call.answer(stream);
        const video = document.createElement("video");

        call.on("stream", (userVideoStream) => {
          addVideoStream(video, userVideoStream);
        });
      });

      socket.on("user-connected", (userId) => {
        connectToNewUser(userId, stream);
      });

      document.addEventListener("keydown", (e) => {
        if (e.which === 13 && chatInputBox.value != "") {
          socket.emit("message", chatInputBox.value);
          chatInputBox.value = "";
        }
      });

      socket.on("createMessage", (msg) => {
        console.log(msg);
        let li = document.createElement("li");
        li.innerHTML = msg;
        all_messages.append(li);
        main__chat__window.scrollTop = main__chat__window.scrollHeight;
      });
    });
}

const outputImage = document.createElement("img");
const _labels = [];

myVideo.addEventListener("play", () => {
  setInterval(async () => {
    const detections = await FaceApi.detectAllFaces(myVideo);
    if (detections.length <= 0) return;
    extractFaceFromBox(outputImage, detections);
    const tensorImg = tf.browser.fromPixels(outputImage);
    const resized = tf.image.resizeBilinear(tensorImg, [48, 48]);
    const reshaped = tf.reshape(resized, [-1, 48, 48, 1]);
    const prediction = await model.predict(reshaped).data();
    const confidence = tf.max(prediction).dataSync();
    const label = await tf.argMax(prediction).data();
    if (confidence > 0.6) {
      _labels.push(label);
    }
  }, 100);
});

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});
myPeer.on("call", function (call) {
  getUserMedia(
    { video: true, audio: true },
    function (stream) {
      call.answer(stream); // Answer the call with an A/V stream.
      const video = document.createElement("video");
      call.on("stream", function (remoteStream) {
        addVideoStream(video, remoteStream);
      });
    },
    function (err) {
      console.log("Failed to get local stream", err);
    }
  );
});

myPeer.on("open", (id) => {
  socket.emit("join-room", ROOM_ID, id);
});

// CHAT

const connectToNewUser = (userId, streams) => {
  const call = myPeer.call(userId, streams);
  console.log(call);
  const video = document.createElement("video");
  call.on("stream", (userVideoStream) => {
    console.log(userVideoStream);
    addVideoStream(video, userVideoStream);
  });
  call.on("close", () => {
    video.remove();
  });

  peers[userId] = call;
};

socket.on("leave-meeting", () => {
  console.log("leave meeting");
  socket.emit("user-predictions", userId, labels);
  if (userId === hostId) {
    window.location.replace(`/sessions/${hostName}`);
  } else {
    window.location.replace("/");
  }
});

const addVideoStream = (videoEl, stream) => {
  videoEl.srcObject = stream;
  videoEl.width = 720;
  videoEl.height = 560;
  videoEl.addEventListener("loadedmetadata", () => {
    videoEl.play();
  });

  videoGrid.append(videoEl);
  let totalUsers = document.getElementsByTagName("video").length;
  if (totalUsers > 1) {
    for (let index = 0; index < totalUsers; index++) {
      document.getElementsByTagName("video")[index].style.width =
        100 / totalUsers + "%";
    }
  }
};

// Play or Pause video
document.getElementById("playPauseVideo").addEventListener("click", () => {
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo();
  } else {
    setStopVideo();
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
});

async function extractFaceFromBox(inputImage, detections) {
  const box = detections[0].detection.box;
  const regionsToExtract = [
    new faceapi.Rect(box.x, box.y, box.width, box.height),
  ];

  let faceImages = await faceapi.extractFaces(inputImage, regionsToExtract);

  if (faceImages.length == 0) {
    console.log("Face not found");
  } else {
    faceImages.forEach((cnv) => {
      outputImage.src = cnv.toDataURL();
      outputImage.width = 224;
      outputImage.height = 224;
      detection.dispose(detections);
    });
  }
}

// Mute or Unmute the participant
document.getElementById("muteButton").addEventListener("click", () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  console.log(enabled);
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
});

// leave meeting
document.getElementById("leave-meeting").addEventListener("click", () => {
  socket.emit("leave-meeting");
});

const setPlayVideo = () => {
  const html = `<i class="unmute fa fa-pause-circle"></i>
  <span class="unmute">Resume Video</span>`;
  document.getElementById("playPauseVideo").innerHTML = html;
};

const setStopVideo = () => {
  const html = `<i class=" fa fa-video-camera"></i>
  <span class="">Pause Video</span>`;
  document.getElementById("playPauseVideo").innerHTML = html;
};

const setUnmuteButton = () => {
  const html = `<i class="unmute fa fa-microphone-slash"></i>
  <span class="unmute">Unmute</span>`;
  document.getElementById("muteButton").innerHTML = html;
};
const setMuteButton = () => {
  const html = `<i class="fa fa-microphone"></i>
  <span>Mute</span>`;
  document.getElementById("muteButton").innerHTML = html;
};
