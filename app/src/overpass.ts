import { parseOSMToGeoJSON } from "./geo";
import { bbox } from "@turf/bbox";
import { categories, Category } from "./main";

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

export function pubsInRelationQuery(relationID: number): string {
  return `[out:json];node(area:${relationID + 3600000000})["amenity"="pub"];out geom;`;
}

export function poisInRelationQuery(relationID: number, category: Category): string {
  const query = `[out:json];node(area:${relationID + 3600000000})[${categories[category].tag}];out geom;`;
  return query;
}

export function poisInCircleQuery(center: number[], radiusKilometer: number, category: Category): string {
  const query = `[out:json];node(around:${radiusKilometer * 1000},${center[1]},${center[0]})[${categories[category].tag}];out geom;`;
  return query;
}


export async function fetchPubsInRelation(relationID: number) {
  const query = pubsInRelationQuery(relationID);
  const osmData = await fetchOverpassData(query);
  const fc = parseOSMToGeoJSON(osmData)
  fc.features.forEach((feature, index) => {
    if (feature.properties) {
      feature.id = index;
    }
  });
  return fc;
}

export async function fetchPoisInRelation(relationID: string, category: Category) {
  const query = poisInRelationQuery(parseInt(relationID), category);
  const osmData = await fetchOverpassData(query);
  const fc = parseOSMToGeoJSON(osmData)
  fc.features.forEach((feature, index) => {
    if (feature.properties) {
      feature.id = index;
    }
  });
  return fc;
}

// TODO: check for a better type to annotate center 
export async function fetchPoisInCircle(center: number[], radiusKilometer: number, category: Category) {
  const query = poisInCircleQuery(center, radiusKilometer, category);
  const osmData = await fetchOverpassData(query);
  const fc = parseOSMToGeoJSON(osmData)
  fc.features.forEach((feature, index) => {
    if (feature.properties) {
      feature.id = index;
    }
  });
  return fc;
}

export async function fetchNominatimRelationData(relationID: number) {
  const request = `https://nominatim.openstreetmap.org/details?osmtype=R&osmid=${relationID}&format=json&polygon_geojson=1`;
  console.log("Fetching relation data from nominatim... 🎣");
  const response = await fetch(request);
  const feature = await response.json();
  // TODO: add error handling
  const carmen_geojson = {
    type: 'Feature',
    geometry: feature.geometry,
    place_name: feature.names.name,
    text: feature.names.name,
    place_type: ['place'],
    bbox: bbox(feature.geometry, { recompute: true }) as [number, number, number, number],
    // TODO: put all other felids in feature.properties
    properties: feature
  };
  return carmen_geojson;
}