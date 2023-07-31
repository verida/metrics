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
const sync_1 = require("csv-parse/sync");
const fs_1 = __importDefault(require("fs"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // We assume all the latest data has been checked out via a git pull action
            const networkName = "testnet";
            // get the network description file
            let url = `https://assets.verida.io/registry/storageNodes/${networkName}.json`;
            let response = yield fetch(url);
            if (!response.ok) {
                throw new Error(`Could not fetch ${url}`);
            }
            const storageNodes = yield response.json();
            // get region data
            url = `https://assets.verida.io/registry/ISO-3166-Countries-with-Regional-Codes.json`;
            response = yield fetch(url);
            if (!response.ok) {
                throw new Error(`Could not fetch ${url}`);
            }
            const regionCodes = yield response.json();
            // convert to a map indexed by the 2-letter ISO code for a country
            // eg
            // AU: {name: Australia,..} 
            const countryData = Object.fromEntries(regionCodes.map((country) => [country["alpha-2"], country]));
            let domainRegEx = new RegExp('https:\\/\\/(.*):\\d*');
            const results = [];
            for (const node of storageNodes) {
                const nodeCountryData = countryData[node.countryLocation];
                // need to get the stats for this node. These are all checked into this repo
                // extract the domain name from the URL
                const matches = node.serviceEndpoint.match(domainRegEx);
                if (!matches) {
                    console.error(`could not extract domain name from ${node.serviceEndpoint}. Will not collect stats.`);
                }
                else {
                    const rawNodeStats = fs_1.default.readFileSync(`../nodes/${matches[1]}/stats.csv`);
                    const nodeStats = (0, sync_1.parse)(rawNodeStats, { columns: true, trim: true });
                    const mostRecentNodeStats = nodeStats.pop();
                    results.push({
                        id: node.id,
                        name: node.name,
                        description: node.description,
                        datacenter: node.datacenter,
                        serviceEndpoint: node.serviceEndpoint,
                        country: nodeCountryData["name"],
                        region: nodeCountryData["region"],
                        subregion: nodeCountryData["sub-region"],
                        storageSlotsUsed: mostRecentNodeStats['storage_slots_used'],
                        maxStorageSlots: mostRecentNodeStats['max_storage_slots'],
                    });
                }
            }
            fs_1.default.writeFileSync(`../nodes/${networkName}-nodes-summary.json`, JSON.stringify(results, null, 2));
        }
        catch (error) {
            console.error(error);
        }
    });
}
run();
