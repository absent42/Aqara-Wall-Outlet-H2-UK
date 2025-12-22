# Aqara-Wall-Outlet-H2-UK
Zigbee2MQTT external converter for Aqara Wall Outlet H2 UK

## Installation

In Zigbee2MQTT go to **settings** → **dev console** → **external converters**, create a new converter named **aeu002.mjs** and paste in the contents of the file. Click save then restart Zigbee2MQTT via **settings** → **tools**

Alternatively place the file **aeu002.mjs** in the folder **zigbee2mqtt/data/external_converters** and restart Zigbee2MQTT.

If an external converter is active for a device a cyan icon with "Supported: external" will be displayed under the device name in Zigbee2MQTT.

## Pairing

First switch the device to the Zigbee firmware by connecting it to the Aqara Home app via Bluetooth on your phone. 

Double tap either button on the outlet then long press it for 5 seconds, the button LED should start to blink when it enters pairing mode. Now join it to the Zigbee2MQTT network in the standard way. 

## Features
- Individual socket 1, socket 2, & USB switching
- Power readings for socket 1 and USB combined (this is a hardware limitation), socket 2, and the total for the device
- Energy usage for overall device
- Current draw for the overall device
- Multi-Tap function for each button, single press, double press, hold and release
- Child lock for each button
- LED controls
- Overload protection
- Power outage memory
