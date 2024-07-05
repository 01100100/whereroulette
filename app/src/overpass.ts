import { parseOSMToGeoJSON } from "./geo";

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