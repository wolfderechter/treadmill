# Treadmill

## Setup

- Add necessary dependencies with `sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`
- Grant permissions `sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)`
