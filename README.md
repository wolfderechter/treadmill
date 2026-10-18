# Treadmill

## Setup

- Add necessary dependencies with `sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`

## Running with Docker

Needs `bluez` running on the host; the container talks to it through the host's D-Bus socket.

```sh
docker compose up -d --build
```

Sessions are stored in `./treadmill.db`; create it before the first start (`touch treadmill.db`), otherwise Docker mounts an empty directory there. Logs: `docker compose logs -f`.
