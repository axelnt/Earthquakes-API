"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../../logger"));
const constants_1 = require("../config/constants");
const errorMessages_1 = require("../config/errorMessages");
const distance_model_1 = require("../models/distance.model");
const earthquake_model_1 = __importDefault(require("../models/earthquake.model"));
const time_type_1 = require("../types/time.type");
const utils_1 = require("../utils");
const getLatestEarthquake = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const earthquake = yield earthquake_model_1.default.findOne({ deleted: false }).sort({ "time.value": -1 });
        if (!earthquake) {
            throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_NOT_FOUND);
        }
        return earthquake;
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_NOT_FOUND);
    }
});
const getEarthquakeByCode = (code) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const earthquake = yield earthquake_model_1.default.findOne({ code, deleted: false });
        if (!earthquake) {
            throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_NOT_FOUND);
        }
        return earthquake;
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_NOT_FOUND);
    }
});
const getEarthquakes = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const timeNormalized = data.time ? (0, time_type_1.convertTimeToMilliseconds)(data.time) : null;
        const magnitudeNormalized = (0, utils_1.safeParseFloat)(data.magnitude) || 0;
        const timeAgo = timeNormalized
            ? new Date(Date.now() - timeNormalized).toISOString()
            : new Date(Date.now() - (0, time_type_1.convertTimeToMilliseconds)("24h")).toISOString();
        let query = Object.assign(Object.assign({ "time.value": { $gte: timeAgo }, "magnitude.value": { $gte: magnitudeNormalized } }, (data.showDeleted
            ? {}
            : {
                deleted: false,
            })), (data.distance != null && data.unit != null
            ? {
                "coordinates.raw": {
                    $geoWithin: {
                        $centerSphere: [
                            [data.longitude, data.latitude],
                            new distance_model_1.Distance(data.distance, data.unit).toEarthRadian(),
                        ],
                    },
                },
            }
            : {}));
        console.log(query);
        const earthquakes = yield earthquake_model_1.default.find(query)
            .sort({ "magnitude.value": -1, "time.value": -1 })
            .skip((data.page - 1) * data.limit)
            .limit(data.limit);
        return earthquakes;
    }
    catch (error) {
        console.log(error);
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKES_FETCH);
    }
});
const createEarthquake = (data, forceUpdate) => __awaiter(void 0, void 0, void 0, function* () {
    const earthquake = new earthquake_model_1.default(data);
    try {
        const existing = yield earthquake_model_1.default.findOne({ code: data.code });
        if (existing) {
            if (forceUpdate) {
                existing.set(data);
                yield existing.save();
                logger_1.default.info("Earthquake updated: " + data.code);
            }
            return existing;
        }
        const newEarthquake = yield earthquake.save();
        return newEarthquake;
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_CREATE);
    }
});
const deleteEarthquake = (id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const earthquake = yield earthquake_model_1.default.findById(id);
        if (!earthquake) {
            throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_NOT_FOUND);
        }
        earthquake.deleted = true;
        yield earthquake.save();
        return earthquake;
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_DELETE);
    }
});
const updateEarthquake = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const earthquake = yield earthquake_model_1.default.findById(id);
        if (!earthquake) {
            throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_NOT_FOUND);
        }
        earthquake.set(data);
        yield earthquake.save();
        return earthquake;
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKE_UPDATE);
    }
});
const fetchEarthquakes = (forceUpdate, soft) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!soft) {
            yield hardFetchEarthquakes(forceUpdate);
        }
        else {
            yield softFetchEarthquakes(forceUpdate);
        }
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKES_FETCH);
    }
});
const softFetchEarthquakes = (forceUpdate) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield axios_1.default.get(constants_1.FEED_URL);
    if (response.status !== 200) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKES_FETCH);
    }
    const latestEarthquakeCode = response.data["features"][0]["properties"]["code"];
    const existing = yield earthquake_model_1.default.findOne({ code: latestEarthquakeCode });
    if (existing) {
        logger_1.default.info("Earthquakes are up to date! Skipping fetch.");
        return;
    }
    const data = response.data["features"];
    parseEarthquakes(data, forceUpdate, true);
});
const hardFetchEarthquakes = (forceUpdate) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(constants_1.FEED_URL);
        if (response.status !== 200) {
            throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKES_FETCH);
        }
        const data = response.data["features"];
        parseEarthquakes(data, forceUpdate, false);
    }
    catch (error) {
        throw new Error(errorMessages_1.ERROR_MESSAGES.ERR_EARTHQUAKES_FETCH);
    }
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseEarthquakes = (earthquakes, forceUpdate, soft) => __awaiter(void 0, void 0, void 0, function* () {
    for (const earthquake of earthquakes) {
        try {
            // If earthquake's code exists in the database, stop all operations
            const existing = yield earthquake_model_1.default.findOne({ code: earthquake.properties.code });
            if (existing && soft) {
                logger_1.default.info("Earthquakes are up to date! Skipping fetch.");
                return;
            }
            yield parseEarthquake(earthquake, forceUpdate);
        }
        catch (error) {
            continue;
        }
        yield delay(300);
    }
});
const parseEarthquake = (earthquake, forceUpdate) => __awaiter(void 0, void 0, void 0, function* () {
    const { properties, geometry } = earthquake;
    const { coordinates } = geometry;
    logger_1.default.info("Parsing earthquake: " + properties.code);
    const detailedData = (yield axios_1.default.get(properties.detail)).data;
    logger_1.default.info("Fetched detailed data for earthquake: " + properties.code);
    const otherDetails = detailedData ? detailedData["properties"]["products"]["origin"][0]["properties"] : {};
    const earthquakeData = {
        code: properties.code,
        location: properties.place,
        magnitude: {
            value: properties.mag,
            uncertainty: (0, utils_1.safeParseFloat)(otherDetails["magnitude-error"]),
        },
        magType: properties.magType,
        time: {
            value: new Date(properties.time).toISOString(),
            uncertainty: (0, utils_1.safeParseFloat)(otherDetails["eventtime-error"]),
        },
        epochTime: properties.time,
        source: properties.net,
        status: properties.status,
        coordinates: {
            latitude: {
                value: coordinates[1],
                uncertainty: (0, utils_1.safeParseFloat)(otherDetails["latitude-error"]),
            },
            longitude: {
                value: coordinates[0],
                uncertainty: (0, utils_1.safeParseFloat)(otherDetails["longitude-error"]),
            },
            raw: {
                type: "Point",
                coordinates: [coordinates[0], coordinates[1]],
            },
        },
        depth: {
            meters: {
                value: coordinates[2],
                uncertainty: (0, utils_1.safeParseFloat)(otherDetails["vertical-error"]),
            },
        },
        numberOfStations: (0, utils_1.safeParseFloat)(properties.nst),
        type: properties.type,
        tsunami: properties.tsunami === 1,
        placeInformation: yield (0, utils_1.addressFindByLatLon)(coordinates[1], coordinates[0]),
    };
    return createEarthquake(earthquakeData, forceUpdate);
});
exports.default = {
    createEarthquake,
    deleteEarthquake,
    fetchEarthquakes,
    getEarthquakes,
    updateEarthquake,
    softFetchEarthquakes,
    hardFetchEarthquakes,
    getEarthquakeByCode,
    getLatestEarthquake,
};
