import { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import osmtogeojson from "osmtogeojson";

export function parseOSMToGeoJSON(
    osmData: string
): FeatureCollection<Geometry, GeoJsonProperties> {
    return osmtogeojson(osmData);
}