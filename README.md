# Aqara-Wall-Outlet-H2-UK
Zigbee2MQTT external converter for Aqara Wall Outlet H2 UK

**Dual UBC-C model only currently supported, ZigbeModel for single USB-C version not known**

## Installation

In Zigbee2MQTT go to **settings** → **dev console** → **external converters**, create a new converter named **aeu002.mjs** and paste in the contents of the file. Click save then restart Zigbee2MQTT via **settings** → **tools**

Alternatively place the file **aeu002.mjs** in the folder **zigbee2mqtt/data/external_converters** and restart Zigbee2MQTT.

If an external converter is active for a device a cyan icon with "Supported: external" will be displayed under the device name in Zigbee2MQTT.

## Pairing

Double tap either button on the outlet then long press it for 5 seconds, the button LED should start to blink when it enters pairing mode.
