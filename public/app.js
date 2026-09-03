const ws = new WebSocket(`ws://${location.host}`);

ws.onmessage = (event) => {
  console.log("message:", event.data);
  dispatch(JSON.parse(event.data));
};

function dispatch(msg) {
  switch (msg.type) {
    case "connection":
      statusPillPulse.className = msg.payload;
      statusPill.textContent = msg.payload.toUpperCase();
      break;
    case "session":
      if (msg.payload !== null) {
        const session = msg.payload;
        speed = session.currentSpeed;
        distance = session.totalDistance;
        time = formatDuration(session.elapsedTime);
        sessionState = session.state;

        speedDisplay.textContent = formatSpeed(speed);
        distanceDisplay.textContent = formatDistance(distance);
        timeDisplay.textContent = time;
      } else {
        speedDisplay.textContent = formatSpeed(0);
        sessionState = "stopped";
      }
      render();
      break;
    case "state":
      sessionState = msg.payload;
      render();
      break;
  }
}

function render() {
  const hasSession = sessionState !== "stopped";
  const isRunning = sessionState === "running";

  // Setup the start/pause/stop buttons depending if ther is a session or not
  startBtn.style.display = hasSession ? "none" : "flex";
  pauseResumeBtn.style.display = hasSession ? "flex" : "none";
  stopBtn.style.display = hasSession ? "flex" : "none";

  // Disable the minus/plus buttons when there is no session
  minusBtn.disabled = !isRunning;
  plusBtn.disabled = !isRunning;

  // Setup the correct pause / resume state
  pauseResumeLabel.textContent = isRunning ? "PAUSE" : "RESUME";
  pauseResumeIcon.className = isRunning
    ? "ph-bold ph-pause"
    : "ph-bold ph-play";
}

// Handle errors
ws.onerror = (error) => {
  console.log("Error: " + error.message);
};

// Handle connection close
ws.onclose = () => {
  console.log("Disconnected from server");
  // mark as disconnected
  // add retry mechanism to try reconnecting with epxonential timeout
};

const minusBtn = document.getElementById("minus");
const plusBtn = document.getElementById("plus");

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const pauseResumeBtn = document.getElementById("pause-resume");
const pauseResumeIcon = document.getElementById("pause-resume-icon");
const pauseResumeLabel = document.getElementById("pause-resume-label");
const statusPill = document.getElementById("status-pill");
const statusPillPulse = document.getElementById("status-pill-pulse");
const distanceMetric = document.getElementById("distance-metric");
const countdownOverlay = document.getElementById("countdown-overlay");
const countdownCount = document.getElementById("countdown-count");

const speedDisplay = document.getElementById("speed");
const distanceDisplay = document.getElementById("distance");
const timeDisplay = document.getElementById("time");

let sessionState = "stopped"; // "stopped" | "running" | "paused"
let speed;
let distance;
let time;

startBtn.addEventListener("click", async () => {
  await fetch("/api/start", {
    method: "POST",
  });
  speedDisplay.textContent = formatSpeed(1); // optimistically prefill the speed to 1
  countDown();
});

function countDown() {
  countdownOverlay.className = ""; // removes the .hidden class so the overlay shows up

  let count = 3;
  function updateCountDown() {
    countdownCount.textContent = count;
    countdownCount.animate(
      [
        { transform: "scale(1.25)", opacity: 0.4 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 300, easing: "ease-out" },
    );
    count--;
    if (count === -1) {
      countdownOverlay.className = "hidden";
      clearInterval(countdownTimer);
    }
  }
  updateCountDown(); // fire immediately
  const countdownTimer = setInterval(updateCountDown, 1000);
}

stopBtn.addEventListener("click", async () => {
  await fetch("/api/stop", {
    method: "POST",
  });
});

pauseResumeBtn.addEventListener("click", async () => {
  if (sessionState === "running") {
    await fetch("/api/pause", {
      method: "POST",
    });
  } else if (sessionState === "paused") {
    await fetch("/api/resume", {
      method: "POST",
    });
    countDown();
  }
});

plusBtn.addEventListener("click", () => {
  if (speed === 600) return;
  speed += 10;
  speedDisplay.textContent = (speed / 100).toFixed(1);
  fetch(`/api/speed?speed=${speed}`, {
    method: "POST",
  });
});

minusBtn.addEventListener("click", () => {
  if (speed === 100) return;
  speed -= 10;
  speedDisplay.textContent = (speed / 100).toFixed(1);
  fetch(`/api/speed?speed=${speed}`, {
    method: "POST",
  });
});

document.addEventListener("touchstart", () => {}, { passive: true }); // fix for ios buttons not pressing down

function formatSpeed(speed) {
  return (speed / 100).toFixed(1);
}
function formatDistance(distance) {
  if (distance < 500) {
    distanceMetric.innerText = "M";
    return distance;
  } else {
    distanceMetric.innerText = "KM";
    return (distance / 1000).toFixed(2);
  }
}

function formatDuration(elapsedTimeInSeconds) {
  const hours = Math.floor(elapsedTimeInSeconds / 3600);
  const minutes = Math.floor((elapsedTimeInSeconds % 3600) / 60);
  const seconds = elapsedTimeInSeconds % 60;

  const mm = String(minutes).padStart(2, "0"); // display with leading 0
  const ss = String(seconds).padStart(2, "0"); // display with leading 0

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
