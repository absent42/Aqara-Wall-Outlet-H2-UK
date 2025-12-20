import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";

const {lumiModernExtend, manufacturerCode, numericAttributes2Payload} = lumi;

const e = exposes.presets;
const ea = exposes.access;

// Pre-existing lumiElectricityMeter exposes voltage which is not supported by this device
// Device appears to only report overall readings, not per-socket
const lumiH2ElectricityMeter = {
    cluster: "manuSpecificLumi",
    type: ["attributeReport", "readResponse"],
    convert: async (model, msg, publish, options, meta) => {
        const result = await numericAttributes2Payload(msg, meta, model, options, msg.data);
        if (!result) return;

        const filtered = {};
        for (const [key, value] of Object.entries(result)) {
            if (value !== undefined && value !== null) {
                filtered[key] = value;
            }
        }

        return Object.keys(filtered).length > 0 ? filtered : undefined;
    },
};

// Power reporting for each socket is at a different endpoint to the switch state
const lumiH2Power = {
    cluster: "haElectricalMeasurement",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg) => {
        if (!("activePower" in msg.data)) return;

        const power = msg.data.activePower;
        if (typeof power !== "number") return;

        switch (msg.endpoint.ID) {
            case 1:
                return {total_power: power};
            case 2:
                return {power_socket_1_usb: power};
            case 3:
                return {power_socket_2: power};
            default:
                return;
        }
    },
};

export default {
    zigbeeModel: ["lumi.plug.aeu002"],
    model: "WP-P09D",
    vendor: "Aqara",
    description: "Aqara Wall Outlet H2 UK (Dual USB-C)",

    fromZigbee: [lumiH2Power, lumiH2ElectricityMeter],

    configure: async (device, coordinatorEndpoint) => {
        const endpoint1 = device.getEndpoint(1);
        const endpoint2 = device.getEndpoint(2);

        // Global settings - endpoint 1 only
        await endpoint1.read("manuSpecificLumi", [0x00f0], {manufacturerCode: manufacturerCode}); // Flip indicator light
        await endpoint1.read("manuSpecificLumi", [0x0203], {manufacturerCode: manufacturerCode}); // LED indicator
        await endpoint1.read("manuSpecificLumi", [0x020b], {manufacturerCode: manufacturerCode}); // Overload protection
        await endpoint1.read("manuSpecificLumi", [0x0517], {manufacturerCode: manufacturerCode}); // Power on behavior

        // Per-socket settings - both endpoints
        await endpoint1.read("manuSpecificLumi", [0x0285], {manufacturerCode: manufacturerCode}); // Socket 1 Child lock
        await endpoint2.read("manuSpecificLumi", [0x0285], {manufacturerCode: manufacturerCode}); // Socket 2 Child lock
        await endpoint1.read("manuSpecificLumi", [0x0286], {manufacturerCode: manufacturerCode}); // Socket 1 MultiClick
        await endpoint2.read("manuSpecificLumi", [0x0286], {manufacturerCode: manufacturerCode}); // Socket 2 MultiClick
    },

    extend: [
        // Device temperateure sensor appears not to be present on this model
        m.deviceEndpoints({endpoints: {1: 1, 2: 2, usb: 3}}),
        m.forcePowerSource({powerSource: "Mains (single phase)"}),
        lumiModernExtend.lumiZigbeeOTA(),
        lumiModernExtend.lumiOnOff({
            endpointNames: ["1", "2", "usb"],
        }),

        lumiModernExtend.lumiPowerOnBehavior(),

        lumiModernExtend.lumiMultiClick({description: "Multi-click mode for socket 1 button", endpointName: "1"}),
        lumiModernExtend.lumiMultiClick({description: "Multi-click mode for socket 2 button", endpointName: "2"}),

        lumiModernExtend.lumiAction({
            endpointNames: ["1", "2"],
            actionLookup: {hold: 0, single: 1, double: 2, release: 255},
        }),

        m.binary({
            name: "child_lock",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0285, type: 0x20},
            endpointName: "1",
            description: "Lock button on socket 1",
            valueOn: [true, 1],
            valueOff: [false, 0],
            access: "STATE_SET",
            entityCategory: "config",
            zigbeeCommandOptions: {manufacturerCode},
        }),

        m.binary({
            name: "child_lock",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0285, type: 0x20},
            endpointName: "2",
            description: "Lock button on socket 2",
            valueOn: [true, 1],
            valueOff: [false, 0],
            access: "STATE_SET",
            entityCategory: "config",
            zigbeeCommandOptions: {manufacturerCode},
        }),

        // Pre-existing lumiOverloadProtection produces config error due to access: "ALL"
        m.numeric({
            name: "overload_protection",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x020b, type: 0x39},
            description: "Maximum allowed load, turns off if exceeded",
            valueMin: 100,
            valueMax: 3250,
            unit: "W",
            access: "STATE_SET",
            entityCategory: "config",
            zigbeeCommandOptions: {manufacturerCode},
        }),

        lumiModernExtend.lumiLedIndicator(),
        lumiModernExtend.lumiFlipIndicatorLight(),
        m.identify(),
    ],

    exposes: [
        e.numeric("total_power", ea.STATE).withUnit("W").withDescription("Total combined outlet power consumption"),
        e.numeric("power_socket_1_usb", ea.STATE).withUnit("W").withDescription("Combined power of socket 1 and USB"),
        e.numeric("power_socket_2", ea.STATE).withUnit("W").withDescription("Power of socket 2"),
        e.energy(),
        e.current(),
    ],
};
