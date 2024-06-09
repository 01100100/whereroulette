import { BBox } from "geojson";
import { area, bboxPolygon } from "@turf/turf";
import { flashMessage } from "./ui"

// Define Constants
const bboxSizeLimit_m2 = 10000000000; // maximum size limit for a bounding box in square meters

// Create a query for the Overpass API to fetch waterways within a bounding box, if the bounding box is too big only fetch relations
export function waterwaysInBboxQuery(bbox: BBox): string {
  let waterwaysQuery = `[out:json];(rel["waterway"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});way["waterway"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});)->._;out geom;`;
  if (area(bboxPolygon(bbox)) > bboxSizeLimit_m2) {
    // TODO: take user input whether to fetch smaller waterways
    console.log(
      "The Bbox is too big. To reduce the computation on the client size the fetch only bigger waterways (OSM relations) and ignore smaller streams (OSM ways) from the OSM overpass api."
    );

    console.log(`${area(bboxPolygon(bbox))} m**2 > ${bboxSizeLimit_m2}`);
    waterwaysQuery = `[out:json];rel["waterway"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});out geom;`;
  }
  return waterwaysQuery;
}

export async function waterwaysInAreaQuery(areaName: string): Promise<string> {
  const areaId = await getAreaIdPhoton(areaName);
  return `[out:json];(rel(area:${areaId + 3600000000})["waterway"];way(area:${areaId + 3600000000})["waterway"];)->._;out geom;`;
}

export async function waterwaysRelationsInAreaQuery(areaName: string): Promise<string> {
  const areaId = await getAreaIdPhoton(areaName);
  return `[out:json]; rel(area:${areaId + 3600000000})["waterway"]; out geom;
  `;
}

// Fetch data from the Overpass API
export async function fetchOverpassData(
  overpassQuery: string
): Promise<string> {
  const response = await fetch("https://www.overpass-api.de/api/interpreter?", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: overpassQuery,
  });
  if (response.ok) {
    const osmData = await response.json();
    return osmData;
  } else {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

// Fetch data from Nominatim API
export async function getAreaIdNominatim(areaName: string): Promise<number> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${areaName}`);
  if (response.ok) {
    const data = await response.json();
    if (data.length > 0) {
      return data[0].osm_id;
    }
  } else {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

export async function getAreaIdPhoton(areaName: string): Promise<number> {
  // https://photon.komoot.io has a more liberal Terms of service then Nominatim 
  const response = await fetch(`https://photon.komoot.io/api/?q=${areaName}&limit=1`);
  if (response.ok) {
    const data = await response.json();
    if (data.features.length > 0) {
      // data.features[0].properties.osm_type ('N', 'W', 'R') indicates the type of the OSM object (node, way, relation)
      return data.features[0].properties.osm_id;
    }
  } else {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}


// [out:json];
// (
//   relation[admin_level="8"]({{bbox}});
// );
// out geom;


export function citiesInBboxQuery(bbox: BBox): string {
  return `[out:json];
  (
    relation[place="city"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
    relation[place="town"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
    relation[place="village"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  );
  out tags;`
}