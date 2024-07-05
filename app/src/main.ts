import { Map } from "maplibre-gl";
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import { ShareControl, FAQControl } from "./ui";
import { FeatureCollection, Geometry } from "geojson";
import { fetchPubsInRelation } from "./overpass";

export const map = new Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/dataviz-dark/style.json?key=ykqGqGPMAYuYgedgpBOY",
  center: [0, 51.4769], // Greenwich meridian (Center of the World)
  zoom: 10,
  maxZoom: 18,
  minZoom: 5,
  maxPitch: 85,
});

const geocoderApi = {
  forwardGeocode: async (config: { query: string }) => {
    // Forward geocode function should return an object including a collection of Features in Carmen GeoJSON format 
    // https://web.archive.org/web/20210224184722/https://github.com/mapbox/carmen/blob/master/carmen-geojson.md
    // It actually only needs a array of features with the place_name and bbox properties to be able to display the results in the menu and know where to fly to.
    // Other properties are optional and can be used in further processing.
    const features = [];
    try {
      // featureType=settlement
      const request = `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&polygon_geojson=1&featureType=settlement&limit=5`;
      const response = await fetch(request);
      const geojson = await response.json();
      for (const feature of geojson.features) {
        const carmen_geojson = {
          type: 'Feature',
          geometry: feature.geometry,
          place_name: feature.properties.display_name,
          properties: feature.properties,
          text: feature.properties.display_name,
          place_type: ['place'],
          bbox: feature.bbox,
        };
        features.push(carmen_geojson);
      }
    } catch (error) {
      console.error(`Failed to forwardGeocode with error: ${error}`);
    }
    return {
      features
    };
  },
};

const geocoderControl = new MaplibreGeocoder(geocoderApi,
  {
    map,
    showResultsWhileTyping: true,
    trackProximity: true,
    minLength: 3, // be nice to the geocoder api and only request after 3 chars and 300ms
    debounceSearch: 300,
  }
)

map.addControl(geocoderControl, "top-right");
map.addControl(new FAQControl(), "bottom-right");
map.addControl(new ShareControl("https://whereroulette.com", "Spin the wheel!", "WhereRoulette helps you choose a place to meet! 🌍 Powered by OSM ❤️‍🔥"), "bottom-right");


geocoderControl.on('result', async (event: any) => {
  // result geo could be a point, polygon, or multiline polygon.
  // In this first version, we will only handle polygons and log the rest... #MVP
  if (event.result.geometry.type !== 'Polygon' && event.result.geometry.type !== 'MultiPolygon') {
    console.log('Unsupported geometry type:', event.result.geometry.type);
    console.log('Result:', event.result);
    // TODO: support other geometry types
    //
    // sometimes a point is returned for a OSM node that is the center of a type=boundary relation.
    // eg) for "maidenhead" https://nominatim.openstreetmap.org/ui/details.html?osmtype=N&osmid=604393285&class=place
    // The node is a "label" part of the relation https://www.openstreetmap.org/relation/13998730
    // This is different from "Berlin" https://nominatim.openstreetmap.org/ui/details.html?osmtype=R&osmid=62422&class=boundary
    // The center node is a "admin_centre" of the relation https://www.openstreetmap.org/relation/62422
    // TODO: understand why nominatim returns only the center node.
    // ref) https://wiki.openstreetmap.org/wiki/Relation:boundary#Relation_members
    return;
  }

  displayBoundaryOnMap(event.result.geometry)
  const pubs = await fetchPubsInRelation(event.result.properties.osm_id);
  displayPointsOnMap(pubs)
  // TODO: add a button to give the manual control of spinning the wheel.
  const selectedPOI = await spinTheWheel(pubs.features.length, pubs);
  console.log('Selected POI:', pubs.features[selectedPOI]);
  // TODO: display the selected pub in a popup.
});

function displayBoundaryOnMap(geometry: Geometry) {
  const layerId = 'selected-item';
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
    map.removeSource(layerId);
  }

  map.addSource(layerId, {
    type: 'geojson',
    data: geometry,
  });
  map.addLayer({
    id: layerId,
    type: 'fill',
    source: layerId,
    paint: {
      'fill-color': '#ff71b8',
      'fill-opacity': 0.2,
    },
  });
}

function displayPointsOnMap(fc: FeatureCollection) {
  const layerId = 'pois';
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
    map.removeSource(layerId);
  }

  map.addSource(layerId, {
    type: 'geojson',
    data: fc,
  });
  map.addLayer({
    id: layerId,
    type: 'circle',
    source: layerId,
    paint: {
      // set the color based on the id of the feature in the FeatureCollection
      'circle-color': [
        'match',
        ['%', ['id'], 7],
        0, '#ffd700',
        1, '#ffb14e',
        2, '#fa8775',
        3, '#ea5f94',
        4, '#cd34b5',
        5, '#9d02d7',
        6, '#0000ff',
        '#000000'
      ],
      // set the size to be conditional on the feature-state selected value 
      "circle-radius": [
        "case",
        ['boolean', ['feature-state', 'selected'], false],
        10,
        5
      ]
    }
  });
}


function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function spinTheWheel(n: number, fc: FeatureCollection): Promise<number> {
  // This function selects a random number between 1 and n but cycles through the numbers in the same way a roulette wheel does.
  // for the first second it spins fast, then it slows down on every increment by adding a upto 300ms to the delay and stopping when the delay is > 1000ms.
  // initial spin

  // Initial delay time should be 1000 ms divided by the number of items
  let delayTime = Math.floor(1000 / n);
  let selected = Math.floor(Math.random() * n);
  console.log('startingIndex:', selected);
  console.log('delayTime:', delayTime, 'ms');

  // Initial spin through all points
  for (let i = 0; i < n; i++) {
    await delay(delayTime);
    map.setFeatureState({
      source: 'pois',
      id: selected,
    }, {
      selected: false
    });
    selected = (selected + 1) % n;
    map.setFeatureState({
      source: 'pois',
      id: selected,
    }, {
      selected: true
    });
  }
  delayTime = 30;

  // Slow down
  while (delayTime < 1000) {
    await delay(delayTime);
    map.setFeatureState({
      source: 'pois',
      id: selected,
    }, {
      selected: false
    });
    selected = (selected + 1) % n;
    map.setFeatureState({
      source: 'pois',
      id: selected,
    }, {
      selected: true
    });
    delayTime += Math.random() * 300;
  }

  return selected;
}
