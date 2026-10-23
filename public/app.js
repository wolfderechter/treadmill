const ws = new WebSocket(
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host,
);
const STEP_LENGTH_M = 0.6;

ws.onmessage = (event) => {
  console.log("message:", event.data);
  dispatch(JSON.parse(event.data));
};

function dispatch(msg) {
  switch (msg.type) {
    case "connection":
      statusPillPulse.className = msg.payload;
      statusPill.textContent = msg.payload.toUpperCase();
      const isConnected = msg.payload.toUpperCase() === "CONNECTED";
      startBtn.disabled = !isConnected;
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
        stepsDisplay.textContent =
          convertDistanceToSteps(distance).toLocaleString();
      } else {
        // No active session found (session could have just ended)
        speedDisplay.textContent = formatSpeed(0);
        sessionState = "stopped";
        renderHistory(periodState); // refresh history to show the one that just finished
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
const countdownOverlay = document.getElementById("countdown-overlay");
const countdownCount = document.getElementById("countdown-count");

const speedDisplay = document.getElementById("speed");
const distanceDisplay = document.getElementById("distance");
const timeDisplay = document.getElementById("time");
const stepsDisplay = document.getElementById("steps");

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
    return distance + " m";
  } else {
    return (distance / 1000).toFixed(2) + " km";
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

// History Deck
const periodSwitch = document.querySelector(".period-switch");
const periodLabel = document.querySelector(".period-label");
const stepsThisPeriod = document.getElementById("period-steps-count");
const periodEnergy = document.getElementById("period-energy");
const periodSessions = document.getElementById("period-sessions");
const periodDistance = document.getElementById("period-distance");
const periodTime = document.getElementById("period-time");
let periodState = "week"; // "week" | "month" | "year" | "all"

periodSwitch.addEventListener("change", (e) => {
  periodState = e.target.value; // "week" | "month" | "year" | "all"
  renderHistory(periodState);
  if (periodState === "all") {
    periodLabel.textContent = "all time";
  } else {
    periodLabel.textContent = "this " + periodState;
  }
});

function renderHistory(period) {
  fetch(`/api/sessions?period=${period}`)
    .then((res) => res.json())
    .then((sessionsThisPeriod) => {
      let distanceThisPeriod = 0;
      let timeThisPeriod = 0;
      let energyThisPeriod = 0;
      sessionsThisPeriod.forEach((session) => {
        distanceThisPeriod += session.totalDistance;
        timeThisPeriod += session.elapsedTime;
        energyThisPeriod += session.totalEnergy;
      });
      const stepsThisPeriodCount = convertDistanceToSteps(distanceThisPeriod);
      stepsThisPeriod.textContent = stepsThisPeriodCount.toLocaleString();
      periodDistance.textContent = formatDistance(distanceThisPeriod);
      periodEnergy.textContent = energyThisPeriod.toLocaleString() + " kcal";
      periodSessions.textContent = sessionsThisPeriod.length;
      periodTime.textContent = Math.round(timeThisPeriod / 60) + " min";

      // overview of sessions
      const lastSessions = document.getElementById("last-sessions");
      lastSessions.innerHTML = ""; // clear the list
      if (sessionsThisPeriod.length === 0) {
        lastSessions.innerText = "no sessions yet";
      }

      sessionsThisPeriod.forEach((session) => {
        const start = new Date(session.startTime);
        const time = start.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const minutes = Math.round(session.elapsedTime / 60);
        const distance = formatDistance(session.totalDistance);
        const avgSpeed = (session.totalDistance / session.elapsedTime) * 3.6; // m/s -> km/h
        const steps = convertDistanceToSteps(session.totalDistance);

        const item = document.createElement("li");
        item.innerHTML = `
          <div class="session-when">
            <span class="session-day">${formatDay(start).toLowerCase()}</span>
            <span class="session-meta">${time}</span>
          </div>
          <span class="session-steps">${steps} steps</span>
          <span class="session-distance">${distance}</span>
          <span class="session-time">${minutes} min</span>
          <div class="session-stats">
            <span class="session-speed">${avgSpeed.toFixed(1)} km/h</span>
            <span class="session-meta">${session.totalEnergy} kcal</span>
          </div>
        `;
        lastSessions.appendChild(item);
      });
    });
}

// "Today", "Yesterday", "Mon" for the last week, "12 Oct" before that (with year if not this year)
function formatDay(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((today - day) / 86_400_000); // round to handle DST days of 23/25h

  if (daysAgo === 0) return "today";
  if (daysAgo < 7)
    return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function convertDistanceToSteps(distanceInMeters) {
  return Math.round(distanceInMeters / STEP_LENGTH_M);
}

// load in history in page load
renderHistory(periodState);
