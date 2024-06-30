import { Map } from "maplibre-gl";
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import {
  ShareControl,
  FAQControl,
} from "./ui";
// import {} from "./geo";
// import { setUp } from "./initialize";
// import { library, dom, icon } from '@fortawesome/fontawesome-svg-core'
// import { faGlobe, faRoute, faCloudArrowUp, faUpload, faQuestion, faLink, faFloppyDisk, faShareNodes } from "@fortawesome/free-solid-svg-icons";

// declare global {
//   interface Window { umami: any; }
// }

// Define global variables
export const map = new Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/topo-v2/style.json?key=ykqGqGPMAYuYgedgpBOY",
  center: [0, 51.4769], // Greenwich meridian
  zoom: 10,
  maxZoom: 18,
  minZoom: 5,
  maxPitch: 85,
});

const geocoderApi = {
  forwardGeocode: async (config: { query: any; }) => {
    const features = [];
    try {
      const request =
        `https://nominatim.openstreetmap.org/search?q=${config.query
        }&format=geojson&polygon_geojson=1&addressdetails=1`;
      const response = await fetch(request);
      const geojson = await response.json();
      for (const feature of geojson.features) {
        const center = [
          feature.bbox[0] +
          (feature.bbox[2] - feature.bbox[0]) / 2,
          feature.bbox[1] +
          (feature.bbox[3] - feature.bbox[1]) / 2
        ];
        const point = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: center
          },
          place_name: feature.properties.display_name,
          properties: feature.properties,
          text: feature.properties.display_name,
          place_type: ['place'],
          center
        };
        features.push(point);
      }
    } catch (e) {
      console.error(`Failed to forwardGeocode with error: ${e}`);
    }

    return {
      features
    };
  }
};

map.addControl(
  new MaplibreGeocoder(geocoderApi, {}), "top-right"
);
map.addControl(new FAQControl(), "bottom-right");
map.addControl(new ShareControl(), "bottom-right");

// TODO: Parse url params and set app state
// setUp();
