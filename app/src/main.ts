import { Map, GeolocateControl } from "maplibre-gl";
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import { ShareControl, FAQControl, hideAllContainers, showSpinButton, hideSpinButton, CustomAttributionControl, showResults, hideRevealButton, showRevealButton, FilterControl } from "./ui";
import { FeatureCollection, Feature, Geometry, GeoJsonProperties } from "geojson";
import { fetchNominatimRelationData, fetchPoisInCircle, fetchPoisInRelation } from "./overpass";
import { confetti } from "@tsparticles/confetti"
import { circle } from "@turf/circle"
import bbox from "@turf/bbox";

export enum Category {
  Drinks = "drinks",
  Cafe = "cafe",
  Food = "food",
  Park = "park",
  Climb = "climb",
}

export type CategoryDetail = {
  tag: string;
  emoji: string;
};


let selectedFeatureId: string | null = null;
let selectedRegionId: string | null = null;
let selectedRegionCenter: any | string | null;
const selectedCircleRadiusKilometers = 3;
let selectedRegionFeature: Feature | null = null;
let boundingBox: [number, number, number, number] | null = null;
let selectedCategory: Category = Category.Drinks; // default selectedCategory is drinks

export const categories: Record<Category, CategoryDetail> = {
  [Category.Drinks]: { tag: 'amenity~"^(pub|bar|biergarten)$"', emoji: "🍺" },
  [Category.Cafe]: { tag: 'amenity~"^(cafe)$"', emoji: "☕" },
  [Category.Food]: { tag: 'amenity~"^(restaurant|fast_food|food_court|ice_cream)$"', emoji: "🍴" },
  [Category.Park]: { tag: 'leisure~"^(park|garden)$"', emoji: "🌳" },
  [Category.Climb]: { tag: 'sport~"^(climbing|bouldering)$"', emoji: "🧗" },
};



function updateUrlWithState(): void {
  console.log('Updating URL with state selectedFeatureId:', selectedFeatureId, 'selectedRegion:', selectedRegionId, "type:", selectedCategory, "selectedRegionCenter:", selectedRegionCenter);
  const queryParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(queryParams.entries());
  console.log(params)
  if (selectedFeatureId) {
    queryParams.set('id', selectedFeatureId);
  } else {
    queryParams.delete('id');
  }
  if (selectedRegionId) {
    queryParams.set('region', selectedRegionId);
  } else {
    queryParams.delete('region');
  }
  if (selectedCategory) {
    queryParams.set('type', selectedCategory);
  } else {
    queryParams.delete('type');
  }
  if (selectedRegionCenter) {
    queryParams.set('center', selectedRegionCenter);
  } else {
    queryParams.delete('center');
  }
  // Update the URL without reloading the page
  window.history.replaceState(null, '', '?' + queryParams.toString());
}

// Function to read state from URL and restore it
async function restoreStateFromUrl() {
  const queryParams = new URLSearchParams(window.location.search);
  selectedFeatureId = queryParams.get('id');
  selectedRegionId = queryParams.get('region');
  selectedRegionCenter = queryParams.get('center')
  // check if the type object is a key in the categories object and if not use the default value and log an error
  // check for a type parameter in the URL and if not use the default value and log an error
  if (queryParams.has('type')) {
    const type = queryParams.get('type');
    if (type && categories[type as Category]) {
      selectedCategory = type as Category;
    } else {
      console.error('Invalid type parameter in URL:', type);
    }
  }
  filterControl.updateFilterControlIcon(selectedCategory);

  if (selectedRegionId) {
    pois = await processOSMAreaRegionID(Number(selectedRegionId));
    if (selectedFeatureId) {
      // get some user input to avoid the error: `Autoplay is only allowed when approved by the user, the site is activated by the user, or media is muted.`
      // The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play

      // check if feature is not in pois
      const feature = pois.features.find(feature => feature.properties?.id === selectedFeatureId);
      if (feature) {
        showRevealButton()
      } else {
        console.error('Feature not found in POIs:', selectedFeatureId);
        showSpinButton()
      }
    } else {
      showSpinButton()
    }
  }
  if (selectedRegionCenter) {
    console.log("circle", selectedRegionCenter)
    pois = await processCircleRegion(selectedRegionCenter.split(',').map(parseFloat), selectedCircleRadiusKilometers)
    if (selectedFeatureId) {
      // get some user input to avoid the error: `Autoplay is only allowed when approved by the user, the site is activated by the user, or media is muted.`
      // The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play

      // check if feature is not in pois
      const feature = pois.features.find(feature => feature.properties?.id === selectedFeatureId);
      if (feature) {
        showRevealButton()
      } else {
        console.error('Feature not found in POIs:', selectedFeatureId);
        showSpinButton()
      }
    } else {
      showSpinButton()
    }
  }
}


async function processOSMAreaRegionID(selectedRegionId: number): Promise<FeatureCollection> {
  const area = await fetchNominatimRelationData(selectedRegionId);
  boundingBox = area.bbox;
  if (boundingBox) {
    recenterMapOnRegion();
  }
  const pois = await processArea(area);
  return pois;
}

async function processCircleRegion(center: number[], radiusKilometers: number): Promise<FeatureCollection> {
  const area = circle(center, radiusKilometers)
  const fullBoundingBox = bbox(area);
  boundingBox = [fullBoundingBox[0], fullBoundingBox[1], fullBoundingBox[2], fullBoundingBox[3]];
  if (boundingBox) {
    recenterMapOnRegion();
  }
  const pois = await processCircle(area, center, radiusKilometers)
  return pois;

}

async function fetchPoisForCurrentArea(): Promise<FeatureCollection> {
  if (!selectedRegionFeature) {
    console.error('No selected region geometry found');
    return {} as FeatureCollection<Geometry, GeoJsonProperties>;
  }
  const area = selectedRegionFeature;
  // TODO: fix this and don't ignore it!
  // @ts-ignore
  boundingBox = area.bbox;
  if (boundingBox) {
    recenterMapOnRegion();
  }
  const pois = await processArea(area);
  return pois;
}

export function resetselectedFeature() {
  selectedFeatureId = null;
}

export function resetselectedCircle() {
  selectedRegionCenter = null;
}

export function resetSelectedRegion() {
  selectedRegionId = null;
  selectedRegionCenter = null;
}
export function recenterMapOnRegion() {
  if (!boundingBox) {
    console.error('No bounding box found for the selected region');
    return;
  }
  map.fitBounds(boundingBox, {
    padding: {
      bottom: 60,
      top: 45,
      left: 5,
      right: 5
    }
  });
}

let pois: FeatureCollection;

export const map = new Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/dataviz-dark/style.json?key=ykqGqGPMAYuYgedgpBOY",
  center: [0, 51.4769], // Greenwich meridian (Center of the World)
  zoom: 2,
  maxZoom: 18,
  minZoom: 0,
  attributionControl: false,
});


const geocoderApi = {
  forwardGeocode: async (config: { query: string }) => {
    // Forward geocode function should return an object including a collection of Features in Carmen GeoJSON format 
    // https://web.archive.org/web/20210224184722/https://github.com/mapbox/carmen/blob/master/carmen-geojson.md
    // It actually only needs a array of features with the place_name and bbox properties to be able to display the results in the menu and know where to fly to.
    // Other properties are optional and can be used in further processing.
    const features = [];
    try {
      // featureType=settlement returns any human inhabited feature from 'state' down to 'neighbourhood'.
      // ref: https://nominatim.org/release-docs/develop/api/Search/#result-restriction
      const request = `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&polygon_geojson=1&featureType=settlement&limit=15`;
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
    maplibregl: map,
    marker: false,
    showResultsWhileTyping: true,
    trackProximity: true,
    minLength: 3, // be nice to the geocoder api and only request after 3 chars and 300ms
    debounceSearch: 300,
    flyTo: {
      padding: {
        bottom: 60,
        top: 45,
        left: 5,
        right: 5
      }
    },
    collapsed: true,
    // A filter to only list features that are a polygon or a multipolygon
    // This filters out many of the results from nominatim that are points or lines.
    // The app is not yet ready to handle these types of geometries.
    // TODO: accommodate other geometry types
    filter: (carmen_geojson: any) => {
      return (carmen_geojson.geometry.type === 'Polygon' || carmen_geojson.geometry.type === 'MultiPolygon')
    },
  }
)

// wait for map to load first
map.on('load', () => {
  restoreStateFromUrl()
})

geocoderControl.on('result', async (event: any) => {
  hideRevealButton();
  hideSpinButton();
  clearBoundary();
  clearPoints();
  resetSelectedRegion()
  selectedRegionId = event.result.properties.osm_id;
  updateUrlWithState();
  processArea(event.result);
  showSpinButton();
});

// TODO: annotate this better.
async function processArea(carmen: any): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
  hideAllContainers()
  console.log('Processing area:', carmen.place_name);
  // result geo could be a point, polygon, or multiline polygon.
  // In this first version, we will only handle polygons and log the rest... #MVP
  if (carmen.geometry.type !== 'Polygon' && carmen.geometry.type !== 'MultiPolygon') {
    console.log('Unsupported geometry type:', carmen.geometry.type);
    // TODO: support other geometry types
    //
    // sometimes a point is returned for a OSM node that is the center of a type=boundary relation.
    // eg) for "maidenhead" https://nominatim.openstreetmap.org/ui/details.html?osmtype=N&osmid=604393285&class=place
    // The node is a "label" part of the relation https://www.openstreetmap.org/relation/13998730
    // This is different from "Berlin" https://nominatim.openstreetmap.org/ui/details.html?osmtype=R&osmid=62422&class=boundary
    // The center node is a "admin_centre" of the relation https://www.openstreetmap.org/relation/62422
    // TODO: understand why nominatim returns only the center node.
    // ref) https://wiki.openstreetmap.org/wiki/Relation:boundary#Relation_members
    return {} as FeatureCollection<Geometry, GeoJsonProperties>;
  }
  boundingBox = carmen.bbox;
  displayBoundaryOnMap(carmen.geometry)
  selectedRegionFeature = carmen
  selectedRegionId = carmen.properties.osm_id;
  console.log('Fetching pois for category:', selectedCategory, categories[selectedCategory].emoji);
  pois = await fetchPoisInRelation(carmen.properties.osm_id, selectedCategory);
  displayPointsOnMap(pois);
  return pois;
}


async function processCircle(circle: Feature, center: number[], radiusKilometers: number): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
  hideAllContainers()
  console.log('Processing circle:', center, radiusKilometers);
  displayBoundaryOnMap(circle.geometry)
  selectedRegionFeature = circle
  console.log('Fetching pois for category:', selectedCategory, categories[selectedCategory].emoji);
  pois = await fetchPoisInCircle(center, radiusKilometers, selectedCategory)
  displayPointsOnMap(pois);
  return pois;
}

async function loadingPoisInRealtion(relationID: string, category: Category) {
  // show loading spinner

  // fetch pois
  pois = await fetchPoisInRelation(relationID, category)
  displayPointsOnMap(pois)
}

const shareControl = new ShareControl("https://whereroulette.com", "Spin the wheel!", "WhereRoulette helps you choose a place to meet! 🌍 Powered by OSM ❤️‍🔥")
map.addControl(geocoderControl, "top-right");
map.addControl(new CustomAttributionControl({ compact: true }), "bottom-right");
map.addControl(new FAQControl(), "bottom-right");
map.addControl(shareControl, "bottom-right");
const filterControl = new FilterControl(categories);
map.addControl(filterControl, "bottom-right");
const geolocateControl = new GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  showAccuracyCircle: false
})
map.addControl(geolocateControl, "bottom-right");
geolocateControl.on('geolocate', async (position) => {
  resetSelectedRegion()
  console.log('A geolocate event has occurred.')
  const center = [position.coords.longitude, position.coords.latitude]
  console.log('Processing circle:', center, selectedCircleRadiusKilometers);
  selectedRegionCenter = center
  updateUrlWithState()
  pois = await processCircle(circle(center, selectedCircleRadiusKilometers), center, selectedCircleRadiusKilometers)
  showSpinButton();
});



document.getElementById("spin-button")?.addEventListener("click", async () => {
  if (pois.features.length === 0) {
    console.log('No POIs to spin');
    return;
  }
  hideSpinButton();
  const selectedPOI = await spinTheWheel(pois);
  selectedFeatureId = selectedPOI.properties?.id;
  updateUrlWithState();
  reveal(selectedPOI)
  console.log('Selected POI:', selectedPOI?.properties?.name);
})

document.getElementById("reveal-button")?.addEventListener("click", async () => {
  if (selectedFeatureId === null) {
    console.log('No feature selected to reveal');
    return;
  }
  if (pois.features.length === 0) {
    console.log('No POIs to spin');
    return;
  }
  hideRevealButton();
  const selectedPOI = await spinTheRiggedWheel(selectedFeatureId, pois);
  reveal(selectedPOI)
  console.log('Selected POI:', selectedPOI.properties?.name);
})

document.getElementById("info-close-button")?.addEventListener("click", async () => {
  hideAllContainers();
})


function displayBoundaryOnMap(geometry: Geometry) {
  console.log("Displaying boundary on map... 🗺️")
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

function clearBoundary() {
  const layerId = 'selected-item';
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
    map.removeSource(layerId);
  }
}

function displayPointsOnMap(fc: FeatureCollection) {
  const layerId = 'pois';
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
    map.removeSource(layerId);
  }

  const topLayerId = 'top-layer-pois';
  if (map.getLayer(topLayerId)) {
    map.removeLayer(topLayerId);
    map.removeSource(topLayerId);
  }

  map.addSource(layerId, {
    type: 'geojson',
    data: fc,
  });
  map.addSource(topLayerId, {
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
      "circle-radius": 5
    },
  });
  map.addLayer({
    id: topLayerId,
    type: 'circle',
    source: topLayerId,
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
      "circle-radius": 10,
      "circle-opacity": [
        "case",
        ['boolean', ['feature-state', 'selected'], false],
        1,
        0
      ],
    },
  });
}

function clearPoints() {
  const layerId = 'pois';
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
    map.removeSource(layerId);
  }

  const topLayerId = 'top-layer-pois';
  if (map.getLayer(topLayerId)) {
    map.removeLayer(topLayerId);
    map.removeSource(topLayerId);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function spinTheWheel(fc: FeatureCollection): Promise<Feature> {
  console.log('Spinning the wheel... 🎡');
  map.zoomIn({ duration: 10000 });
  // clear the selected state of all features
  fc.features.forEach(feature => {
    map.setFeatureState({
      source: 'top-layer-pois', id: feature.id
    }, { selected: false });
  });


  // This function starts with a random feature index between 1 and n. It then cycles through the features in the same way a roulette wheel does.
  // It initially spins fast, then it slows down exponentially untill it stops.
  // Every time it stops on a feature, it beeps.
  let n = fc.features.length;
  let delayTime = 20;
  let selected = Math.floor(Math.random() * n); // start from a different random feature each time
  let startTime = performance.now();
  let lastFrameTime = startTime;

  const animate = async (time: number) => {
    const elapsed = time - lastFrameTime;
    if (elapsed > delayTime) {
      map.setFeatureState({
        source: 'top-layer-pois', id: selected
      }, { selected: false });
      selected = (selected + 1) % n;
      map.setFeatureState({
        source: 'top-layer-pois', id: selected
      }, { selected: true });
      pop();
      lastFrameTime = time;
      delayTime += Math.random() * delayTime; // Increase delay exponentially to slow down the spin
    }

    if (delayTime < 1250) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);

  // Wait for the animation to finish
  while (delayTime < 1250) {
    await delay(200); // Small delay to prevent freezing
  }
  return fc.features[selected];
}

async function spinTheRiggedWheel(osmId: string, fc: FeatureCollection): Promise<Feature<Geometry, GeoJsonProperties>> {
  await spinTheWheel(fc);
  const riggedResult = fc.features.find(feature => feature.properties?.id === osmId) as Feature<Geometry, GeoJsonProperties>;
  // set the feature-state and turn off the selected state for all other features
  await delay(1000)
  fc.features.forEach(feature => {
    map.setFeatureState({
      source: 'top-layer-pois', id: feature.id
    }, { selected: false });
  });
  map.setFeatureState({
    source: 'top-layer-pois', id: riggedResult.id
  }, { selected: true });
  pop();
  return riggedResult;
}

export async function updateSelectedCategory(category: Category) {
  if (!categories[category]) {
    console.error('Invalid category:', category);
    return;
  }
  if (selectedCategory === category) {
    console.log('Category already selected:', category);
    return;
  }
  selectedCategory = category;
  console.log('Updating for category:', category);
  if (selectedRegionId) {
    reload()
  }
  if (selectedRegionCenter) {
    reloadCircle()
  }
}


function celebrate() {
  const defaults = {
    spread: 360,
    ticks: 100,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    shapes: ["heart"],
    colors: ["FFC0CB", "FF69B4", "FF1493", "C71585"],
  };

  confetti({
    ...defaults,
    particleCount: 50,
    scalar: 2,
  });

  confetti({
    ...defaults,
    particleCount: 25,
    scalar: 3,
  });

  confetti({
    ...defaults,
    particleCount: 10,
    scalar: 4,
  });
}

export function resetSpin() {
  // Resets the map state to spin the wheel again for the current region
  console.log('Reloading the wheel ready to spin again... 🔄');
  hideSpinButton();
  hideRevealButton();
  resetselectedFeature();
  updateUrlWithState();
  recenterMapOnRegion();
  hideAllContainers();
  showSpinButton();
}

export async function reload() {
  // Resets the map state and fetches new POIs based on the selectedCategory for the current region
  console.log('Full Reloading... fetching pois for new category:', categories[selectedCategory].emoji);
  hideSpinButton();
  hideRevealButton();
  clearPoints();
  resetselectedFeature();
  hideAllContainers();
  pois = await fetchPoisForCurrentArea();
  showSpinButton();
}

export async function reloadCircle() {
  // Resets the map state and fetches new POIs based on the selectedCategory for the current region
  console.log('Full Reloading... fetching pois for new category:', categories[selectedCategory].emoji);
  hideSpinButton();
  hideRevealButton();
  clearPoints();
  resetselectedFeature();
  hideAllContainers();
  console.log(selectedRegionCenter, selectedCircleRadiusKilometers)
  pois = await processCircle(circle(selectedRegionCenter.split(',').map(parseFloat), selectedCircleRadiusKilometers), selectedRegionCenter.split(',').map(parseFloat), selectedCircleRadiusKilometers);
  showSpinButton();
}

async function reveal(selectedFeature: Feature<Geometry, GeoJsonProperties>): Promise<any> {
  if (!selectedFeature) {
    console.error("No feature selected");
    return;
  }
  fanfare();
  celebrate();
  hideAllContainers();
  showResults(selectedFeature);
  if (selectedFeature.geometry.type === 'Point') {
    // TODO: handle other geometries
    const coordinates = selectedFeature.geometry.coordinates
    map.flyTo({
      center: coordinates as [number, number],
      screenSpeed: 0.05,
    });
  }
}


function beep() {
  var snd = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");
  snd.play();
}

function pop() {
  var snd = new Audio("data:audio/wav;base64,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")
  snd.play()
}

function fanfare() {
  console.log("🎺🎺🎺🎺🎺")
  var snd = new Audio("data:audio/wav;base64,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")
  snd.play();
}