import {
  bbox,
  combine,
  featureCollection, length, lineIntersect, lineSlice
} from "@turf/turf";
import { feature, point } from "@turf/helpers";
import { booleanIntersects } from "./durf"
import osmtogeojson from "osmtogeojson";
import { groupBy } from "lodash";
import {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Feature,
  LineString,
  BBox,
  MultiLineString,
  Point
} from "geojson";
import polyline from "@mapbox/polyline";
import toGeoJSON from "@mapbox/togeojson";
import { fetchOverpassData, waterwaysInBboxQuery, waterwaysInAreaQuery, waterwaysRelationsInAreaQuery, citiesInBboxQuery } from "./overpass";


export async function calculateIntersectingWaterwaysPolyline(polylineString: string): Promise<FeatureCollection | undefined> {
  const geojson = feature(polyline.toGeoJSON(polylineString));
  return calculateIntersectingWaterwaysGeojson(geojson);
}


export async function checkForCompletedCities(intersectingWaterways: FeatureCollection, routeGeoJSON: Feature<LineString>) {
  // Get all city and town area ids that the route intersects
  const cityIds = await getCityAdTownAreaIds(routeGeoJSON)

  // Then get all waterways for each of the cities
  const waterways = await Promise.all(cityIds.map((cityId) => getWaterwaysForArea(cityId.toString())))

  // then check for each city, if every waterway in the city is also in intersectingWaterways
  const completedCities = waterways.map((waterwaysForCity, index) => {
    const intersectingWaterwaysForCity = intersectingFeatures(waterwaysForCity as FeatureCollection<LineString | MultiLineString, { [name: string]: any; }>, routeGeoJSON)
    if (waterwaysForCity.features.length === intersectingWaterwaysForCity.features.length) {
      return cityIds[index]
    }
    return null
  }).filter((cityId) => cityId !== null) as number[]

  // if so, mark the city as completed
  console.log(completedCities)

  // update the hall of fame
  // TODO:

  // update the activity description with the completed cities and a crown and city emoji
}


export async function calculateIntersectingWaterwaysGeojson(
  routeGeoJSON: Feature<LineString>
): Promise<FeatureCollection | undefined> {
  try {
    const routeBoundingBox: BBox = bbox(routeGeoJSON);
    const waterwaysQuery = waterwaysInBboxQuery(routeBoundingBox);
    const osmData = await fetchOverpassData(waterwaysQuery);
    if (!osmData) {
      console.error(
        `No osm features returned for Overpass query: ${waterwaysQuery}`
      );
      return;
    }
    const waterwaysGeoJSON = parseOSMToGeoJSON(osmData);
    const combined = combineSameNameFeatures(waterwaysGeoJSON) as FeatureCollection<LineString | MultiLineString>;
    const intersectingWaterways = intersectingFeatures(
      combined,
      routeGeoJSON
    );
    return intersectingWaterways;
  } catch (error) {
    console.error("Error processing GeoJSON:", error);
    return;
  }
}

export async function getWaterwaysForArea(areaName: string): Promise<FeatureCollection | undefined> {
  const waterwaysQuery = await waterwaysInAreaQuery(areaName);
  const osmData = await fetchOverpassData(waterwaysQuery);
  if (!osmData) {
    console.error(
      `No osm features returned for Overpass query: ${waterwaysQuery}`
    );
    return;
  }
  const waterwaysGeoJSON = parseOSMToGeoJSON(osmData);
  const combined = combineSameNameFeatures(waterwaysGeoJSON) as FeatureCollection<LineString | MultiLineString>;
  return combined;
}

export async function getMainWaterwaysForArea(areaName: string): Promise<FeatureCollection | undefined> {
  const waterwaysQuery = await waterwaysRelationsInAreaQuery(areaName);
  const osmData = await fetchOverpassData(waterwaysQuery);
  if (!osmData) {
    console.error(
      `No osm features returned for Overpass query: ${waterwaysQuery}`
    );
    return;
  }
  const waterwaysGeoJSON = parseOSMToGeoJSON(osmData);
  const combined = combineSameNameFeatures(waterwaysGeoJSON) as FeatureCollection<LineString | MultiLineString>;
  return combined;
}

export async function getCityAdTownAreaIds(routeGeoJSON: Feature<LineString, {
  [name: string]: any;
}>): Promise<number[]> {
  const routeBoundingBox: BBox = bbox(routeGeoJSON);
  const overpassQuery = citiesInBboxQuery(routeBoundingBox);
  const response = await fetchOverpassData(overpassQuery);
  const data = JSON.parse(response);
  const cityIds = data.elements.map((element: any) => element.id);
  return cityIds;
}

export function parseOSMToGeoJSON(
  osmData: string
): FeatureCollection<Geometry, GeoJsonProperties> {
  return osmtogeojson(osmData);
}

export async function parseGPXToGeoJSON(GPXContents: string) {
  const doc = new DOMParser().parseFromString(GPXContents, "text/xml");
  return toGeoJSON.gpx(doc);
}

// Find intersecting features between a route and a FeatureCollection of LineStrings or MultiLineStrings
export function intersectingFeatures(
  fc: FeatureCollection<LineString | MultiLineString>,
  routeLineString: Feature<LineString>
): FeatureCollection {
  const intersectingFeatures = [];
  for (const feature of fc.features) {
    if (booleanIntersects(feature, routeLineString)) {
      intersectingFeatures.push(feature);
    }
  }
  return featureCollection(intersectingFeatures);
}


// Combine features with the same name into single features
function combineSameNameFeatures(
  osmData: FeatureCollection<Geometry, GeoJsonProperties>
): FeatureCollection<Geometry, GeoJsonProperties> {
  const namedFeatures = osmData.features.filter((feature: Feature) => feature.properties?.name);


  const groupedFeatures: object = groupBy(
    namedFeatures,
    (feature: Feature) => feature.properties && feature.properties.name
  );

  const combinedFeatures: Feature[] = Object.values(groupedFeatures).map(
    (group) => {
      if (group.length > 1) {
        const combined = combine(featureCollection(group));

        const combinedFeature = combined.features[0] as any;
        if (combined.features.length > 1) {
          console.error(
            "combined.features.length > 1",
            combined.features.length,
            combined
          );
        }

        // add a name property to the combinedfeature.properties and set to group[0].properties.name for later use as a identifier
        combinedFeature.properties.name = group[0].properties.name;
        return combinedFeature;
      }
      return group[0];
    }
  );
  return featureCollection(combinedFeatures);
}

// For a fc which has only intersecting features, return the first point that each feature intersects and the distance along the LineString from the start, then return the intersecting waterways ordered by the ascending distance 
export function orderAlongRoute(
  fc: FeatureCollection<any>,
  routeLineString: Feature<LineString>
): FeatureCollection<LineString | MultiLineString> {
  // for each of the features in the feature collection, find the first intersection point with the routeLineString and the distance along the routeLineString

  const enrichedFeatures = fc.features.map((feature) => {
    const intersection = firstIntersection(feature, routeLineString);
    if (intersection) {
      const slicedLine = lineSlice(
        point(routeLineString.geometry.coordinates[0]),
        intersection,
        routeLineString
      );
      const distance = length(slicedLine);
      return {
        feature,
        intersection,
        distance
      };
    }
    return null;
  }).filter((enrichedFeature) => enrichedFeature !== null) as { feature: Feature<LineString | MultiLineString>, intersection: Feature<Point>, distance: number }[];
  console.log(enrichedFeatures)

  // return the orderedFeatureCollection as a FeatureCollection of LineStrings or MultiLineStrings with a property intersection which is the first intersection point, they should be ordered by the distance
  const orderFeatures = enrichedFeatures.sort((a, b) => a.distance - b.distance)
  // TODO: add the intersection to properties.intersection 

  return featureCollection(orderFeatures.map((feature) => feature.feature))
}

function firstIntersection(
  feature: Feature<LineString | MultiLineString>,
  routeLineString: Feature<LineString>
): Feature<Point> | null {
  const intersections = lineIntersect(feature, routeLineString);
  if (intersections.features.length > 0) {
    // sort the intersections by the distance along the routeLineString
    intersections.features.sort((a, b) => {
      const aDistance = length(lineSlice(
        point(routeLineString.geometry.coordinates[0]),
        a as Feature<Point>,
        routeLineString
      ));
      const bDistance = length(lineSlice(
        point(routeLineString.geometry.coordinates[0]),
        b as Feature<Point>,
        routeLineString
      ));
      return aDistance - bDistance;
    });
    return intersections.features[0];
  }
  return null;
}

export function createWaterwaysMessage(
  featureCollection: FeatureCollection
): string {
  let names: string[] = [];
  featureCollection.features.forEach((feature) => {
    names.push(feature.properties.name);
  });
  if (names.length > 1) {
    return `Crossed ${names.length} waterways 🏞️ ${names.join(
      " | "
    )} 🌐 https://kreuzungen.world 🗺️`
  } else {
    return `Crossed ${names.length} waterway 🏞️ ${names[0]} 🌐 https://kreuzungen.world 🗺️`
  }
}
