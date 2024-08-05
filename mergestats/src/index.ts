import { parse } from 'csv-parse/sync';
import fs from 'fs';

type NodeData = {
  id: string;
  name: string;
  description: string;
  datacenter: string;
  serviceEndpoint: string;
  establishmentDate: string;
  countryLocation: string;
};

type CountryRegion = {
  name: string;
  "alpha-2": string;
  "alpha-3": string;
  "country-code": number;
  "iso_3166-2": string;
  region: "Africa" | "Americas" | "Asia" | "Europe" | "Oceania" | ""; // Antarctica is "" (!!)
  "sub-region": string;
  "intermediate-region": string;
  "region-code": number;
  "sub-region-code": number;
  "intermediate-region-code": number;
};

type NodeSummaryData = {
  id: string;
  name: string;
  description: string;
  datacenter: string;
  serviceEndpoint: string;
  countryCode: string;
  country: string;
  region: string;
  subregion: string;
  storageSlotsUsed?: number;
  maxStorageSlots?: number;
};

type NodeStats = {
  datetime_utc: string
  storage_slots_used: number,
  max_storage_slots: number
}


async function run(): Promise<void> {
  try {
    // We assume all the latest data has been checked out via a git pull action


    for (const networkName of ["myrtle", "banksia"]) {

      // get the network description file
      const nodeRegistryUrl = `https://assets.verida.io/registry/storageNodes/${networkName}.json`

      const nodeRegistryResponse = await fetch(nodeRegistryUrl);
      if (!nodeRegistryResponse.ok) {
        throw new Error(`Could not fetch ${nodeRegistryUrl}`);
      }

      const storageNodes: NodeData[] = await nodeRegistryResponse.json() as NodeData[];

      // get region data
      const contriesDetailsUrl = `https://assets.verida.io/registry/ISO-3166-Countries-with-Regional-Codes.json`

      const contriesDetailsResponse = await fetch(contriesDetailsUrl);
      if (!contriesDetailsResponse.ok) {
        throw new Error(`Could not fetch ${contriesDetailsUrl}`);
      }

      const regionCodes: CountryRegion[] = await contriesDetailsResponse.json() as unknown as CountryRegion[];

      // convert to a map indexed by the 2-letter ISO code for a country
      // eg
      // AU: {name: Australia,..}
      const countryData = Object.fromEntries(
        regionCodes.map((country) => [country["alpha-2"], country])
      );

      let domainRegEx = new RegExp('https:\\/\\/(.*):\\d*');

      const results: NodeSummaryData[] = [];
      for (const node of storageNodes) {
        const nodeCountryData = countryData[node.countryLocation];

        // need to get the stats for this node. These are all checked into this repo

        // extract the domain name from the URL
        const matches = node.serviceEndpoint.match(domainRegEx);
        if (!matches) {
          console.error(`could not extract domain name from ${node.serviceEndpoint}. Will not collect stats.`);
        } else {
          let mostRecentNodeStats: NodeStats | undefined = undefined
          try {
            const rawNodeStats = fs.readFileSync(`../nodes/${matches[1]}/stats.csv`)
            const nodeStats = parse(rawNodeStats, { columns: true, trim: true }) as NodeStats[];
            mostRecentNodeStats = nodeStats.pop()
          } catch (error) {
            console.error(error);
          }

          results.push({
            id: node.id,
            name: node.name,
            description: node.description,
            datacenter: node.datacenter,
            serviceEndpoint: node.serviceEndpoint,
            countryCode: node.countryLocation,
            country: nodeCountryData["name"],
            region: nodeCountryData["region"],
            subregion: nodeCountryData["sub-region"],
            storageSlotsUsed: mostRecentNodeStats?.storage_slots_used,
            maxStorageSlots: mostRecentNodeStats?.max_storage_slots,
          });
        }
      }

      fs.writeFileSync(`../nodes/${networkName}-nodes-summary.json`, JSON.stringify(results, null, 2));
    }


  } catch (error) {
    console.error(error);
  }
}

run()
