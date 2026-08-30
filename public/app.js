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

const speedDisplay = document.getElementById("speed");
const distanceDisplay = document.getElementById("distance");
const timeDisplay = document.getElementById("time");

let sessionState = "stopped"; // "stopped" | "running" | "paused"
let speed;
let distance;
let time;

async function init() {
  const response = await fetch("/api/session");

  // if no response, mark as disconnected
  if (!response.ok) {
    statusPillPulse.className = "disconnected";
    statusPill.textContent = "DISCONNECTED";
    return;
  }

  const session = await response.json();
  console.log("session", session);
  if (session) {
    speed = session.currentSpeed;
    distance = session.totalDistance;
    time = formatDuration(session.startTime, new Date());
    sessionState = session.state;

    speedDisplay.textContent = formatSpeed(speed);
    distanceDisplay.textContent = formatDistance(distance);
    timeDisplay.textContent = time;

    pauseResumeBtn.style.display = "flex";
    stopBtn.style.display = "flex";
    startBtn.style.display = "none";
  } else {
    pauseResumeBtn.style.display = "none";
    stopBtn.style.display = "none";
    startBtn.style.display = "flex";
  }

  statusPillPulse.className = "connected";
  statusPill.textContent = "CONNECTED";
}

init();

startBtn.addEventListener("click", async () => {
  const response = await fetch("/api/start", {
    method: "POST",
  });
  if (response.ok) {
    sessionState = "running";
    startBtn.style.display = "none";
    pauseResumeBtn.style.display = "flex";
    stopBtn.style.display = "flex";
  }
});

stopBtn.addEventListener("click", async () => {
  const response = await fetch("/api/stop", {
    method: "POST",
  });
  if (response.ok) {
    sessionState = "stoppped";
    startBtn.style.display = "flex";
    pauseResumeBtn.style.display = "none";
    stopBtn.style.display = "none";
  }
});

pauseResumeBtn.addEventListener("click", async () => {
  if (sessionState === "running") {
    const response = await fetch("/api/pause", {
      method: "POST",
    });
    if (response.ok) {
      sessionState = "paused";
      pauseResumeLabel.textContent = "RESUME";
      pauseResumeIcon.className = "ph-bold ph-play";
    }
  } else if (sessionState === "paused") {
    const response = await fetch("/api/resume", {
      method: "POST",
    });
    if (response.ok) {
      sessionState = "running";
      pauseResumeLabel.textContent = "PAUSE";
      pauseResumeIcon.className = "ph-bold ph-pause";
    }
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

function formatDuration(startTime, endTime) {
  const diffMs = Math.abs(new Date(endTime) - new Date(startTime));
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0"); // display with leading 0
  const ss = String(seconds).padStart(2, "0"); // display with leading 0

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
