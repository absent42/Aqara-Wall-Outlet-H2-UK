import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import {fromZigbee} from "zigbee-herdsman-converters/lib/lumi";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";

const {lumiModernExtend, manufacturerCode, numericAttributes2Payload} = lumi;

const e = exposes.presets;
const ea = exposes.access;

// Pre-existing lumiElectricityMeter exposes voltage which is not supported by this device
// Device appears to only report overall readings, not per-socket
const lumiElectricityMeter = (args) => {
    const options = {
        energy: true,
        voltage: true,
        current: true,
        ...args,
    };

    const exposes = [];
    if (options.energy) exposes.push(e.energy());
    if (options.voltage) exposes.push(e.voltage());
    if (options.current) exposes.push(e.current());

    let fromZigbeeConverters;

    if (!options.energy || !options.voltage || !options.current) {
        fromZigbeeConverters = [
            {
                cluster: "manuSpecificLumi",
                type: ["attributeReport", "readResponse"],
                convert: async (model, msg, publish, opts, meta) => {
                    const result = await numericAttributes2Payload(msg, meta, model, opts, msg.data);
                    if (!result) return;

                    const filtered = {};
                    for (const [key, value] of Object.entries(result)) {
                        if (value === undefined || value === null) continue;

                        if (key === "energy" && !options.energy) continue;
                        if (key === "voltage" && !options.voltage) continue;
                        if (key === "current" && !options.current) continue;

                        filtered[key] = value;
                    }

                    return Object.keys(filtered).length > 0 ? filtered : undefined;
                },
            },
        ];
    } else {
        fromZigbeeConverters = [
            {
                cluster: "manuSpecificLumi",
                type: ["attributeReport", "readResponse"],
                convert: async (model, msg, publish, opts, meta) => {
                    return await numericAttributes2Payload(msg, meta, model, opts, msg.data);
                },
            },
        ];
    }

    return {exposes, fromZigbee: fromZigbeeConverters, isModernExtend: true};
};

// Power reporting for each socket is at a different endpoint to the switch state
const lumiActivePower = (args) => {
    const {name, description, endpoint} = args;

    const fromZigbeeConverters = [
        {
            cluster: "haElectricalMeasurement",
            type: ["attributeReport", "readResponse"],
            convert: (model, msg) => {
                if (!("activePower" in msg.data)) return;
                if (msg.endpoint.ID !== endpoint) return;

                const power = msg.data.activePower;
                if (typeof power !== "number") return;

                return {[name]: power};
            },
        },
    ];

    const exposes = [e.numeric(name, ea.STATE).withUnit("W").withDescription(description)];

    return {
        isModernExtend: true,
        fromZigbee: fromZigbeeConverters,
        exposes,
    };
};

// Custom lumiOnOff function with optional device_temperature and power_outage_count exposes
const lumiOnOff = (args) => {
    const options = {
        operationMode: false,
        lockRelay: false,
        deviceTemperature: true,
        powerOutageCount: true,
        ...args,
    };

    const result = m.onOff({powerOnBehavior: false, ...options});

    if (!result.fromZigbee) result.fromZigbee = [];
    if (!result.toZigbee) result.toZigbee = [];
    if (!result.exposes) result.exposes = [];

    if (!options.deviceTemperature || !options.powerOutageCount) {
        result.fromZigbee.push({
            ...fromZigbee.lumi_specific,
            convert: async (model, msg, publish, opts, meta) => {
                const lumiResult = await fromZigbee.lumi_specific.convert(model, msg, publish, opts, meta);
                if (!lumiResult) return;

                const filtered = {};
                for (const [key, value] of Object.entries(lumiResult)) {
                    if (value === undefined || value === null) continue;

                    if (key === "device_temperature" && !options.deviceTemperature) continue;
                    if (key === "power_outage_count" && !options.powerOutageCount) continue;

                    filtered[key] = value;
                }

                return Object.keys(filtered).length > 0 ? filtered : undefined;
            },
        });
    } else {
        result.fromZigbee.push(fromZigbee.lumi_specific);
    }

    if (options.deviceTemperature) {
        result.exposes.push(e.device_temperature());
    }
    if (options.powerOutageCount) {
        result.exposes.push(e.power_outage_count());
    }

    if (options.powerOutageMemory === "binary") {
        const extend = lumiModernExtend.lumiPowerOutageMemory();
        if (extend.toZigbee && result.toZigbee) result.toZigbee.push(...extend.toZigbee);
        if (extend.exposes && result.exposes) result.exposes.push(...extend.exposes);
    } else if (options.powerOutageMemory === "enum") {
        const extend = lumiModernExtend.lumiPowerOnBehavior();
        if (extend.toZigbee && result.toZigbee) result.toZigbee.push(...extend.toZigbee);
        if (extend.exposes && result.exposes) result.exposes.push(...extend.exposes);
    }
    if (options.operationMode === true) {
        const extend = lumiModernExtend.lumiOperationMode({description: "Decoupled mode for a button"});
        if (options.endpointNames) {
            options.endpointNames.forEach((ep) => {
                const epExtend = lumiModernExtend.lumiOperationMode({
                    description: `Decoupled mode for ${ep.toString()} button`,
                    endpointName: ep,
                });
                if (epExtend.toZigbee && result.toZigbee) result.toZigbee.push(...epExtend.toZigbee);
                if (epExtend.exposes && result.exposes) result.exposes.push(...epExtend.exposes);
            });
        } else {
            if (extend.toZigbee && result.toZigbee) result.toZigbee.push(...extend.toZigbee);
            if (extend.exposes && result.exposes) result.exposes.push(...extend.exposes);
        }
    }
    if (options.lockRelay) {
        const extend = lumiModernExtend.lumiLockRelay();
        if (options.endpointNames) {
            options.endpointNames.forEach((ep) => {
                const epExtend = lumiModernExtend.lumiLockRelay({
                    description: `Locks ${ep.toString()} relay and prevents it from operating`,
                    endpointName: ep,
                });
                if (epExtend.toZigbee && result.toZigbee) result.toZigbee.push(...epExtend.toZigbee);
                if (epExtend.exposes && result.exposes) result.exposes.push(...epExtend.exposes);
            });
        } else {
            if (extend.toZigbee && result.toZigbee) result.toZigbee.push(...extend.toZigbee);
            if (extend.exposes && result.exposes) result.exposes.push(...extend.exposes);
        }
    }
    return result;
};

const lumiChildLock = (args) =>
    m.binary({
        name: "child_lock",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x0285, type: 0x20},
        valueOn: [true, 1],
        valueOff: [false, 0],
        description: "Child lock (disables physical button)",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

export default {
    zigbeeModel: ["lumi.plug.aeu002"],
    model: "WP-P09D",
    vendor: "Aqara",
    description: "Wall Outlet H2 UK",

    configure: async (device, coordinatorEndpoint) => {
        const endpoint1 = device.getEndpoint(1);
        const endpoint2 = device.getEndpoint(2);

        // Global settings
        await endpoint1.read("manuSpecificLumi", [0x00f0], {manufacturerCode: manufacturerCode}); // Flip indicator light
        await endpoint1.read("manuSpecificLumi", [0x0203], {manufacturerCode: manufacturerCode}); // LED indicator
        await endpoint1.read("manuSpecificLumi", [0x020b], {manufacturerCode: manufacturerCode}); // Overload protection
        await endpoint1.read("manuSpecificLumi", [0x0517], {manufacturerCode: manufacturerCode}); // Power on behavior

        // Per-socket settings
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
        lumiOnOff({
            endpointNames: ["1", "2", "usb"],
            deviceTemperature: false,
        }),

        // Power reporting for each socket is at a different endpoint to the socket switch state
        lumiActivePower({name: "total_power", description: "Total combined outlet power consumption", endpoint: 1}),
        lumiActivePower({name: "power_socket_1_and_usb", description: "Combined power of socket 1 and USB", endpoint: 2}),
        lumiActivePower({name: "power_socket_2", description: "Power of socket 2", endpoint: 3}),

        lumiElectricityMeter({voltage: false}),

        lumiModernExtend.lumiPowerOnBehavior(),

        lumiModernExtend.lumiMultiClick({description: "Multi-click mode for socket 1 button", endpointName: "1"}),
        lumiModernExtend.lumiMultiClick({description: "Multi-click mode for socket 2 button", endpointName: "2"}),

        lumiModernExtend.lumiAction({
            endpointNames: ["1", "2"],
            actionLookup: {hold: 0, single: 1, double: 2, release: 255},
        }),

        lumiChildLock({endpointName: "1", description: "Lock button on socket 1"}),
        lumiChildLock({endpointName: "2", description: "Lock button on socket 2"}),

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
};
