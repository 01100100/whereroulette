import { Map, LngLatBounds } from "maplibre-gl";
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import { ShareControl, FAQControl, hideAllContainers, showSpinButton, hideSpinButton, CustomAttributionControl, showResults, hideRevealButton, showRevealButton, FilterControl } from "./ui";
import { fanfareSound, popSound } from "./sounds";
import { FeatureCollection, Feature, Geometry, GeoJsonProperties } from "geojson";
import { fetchNominatimRelationData, fetchPoisInRelation } from "./overpass";
import { confetti } from "@tsparticles/confetti"

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
  console.log('Updating URL with state selectedFeatureId:', selectedFeatureId, 'selectedRegion:', selectedRegionId, "type:", selectedCategory);
  const queryParams = new URLSearchParams(window.location.search);
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
  // Update the URL without reloading the page
  window.history.replaceState(null, '', '?' + queryParams.toString());
}

// Function to read state from URL and restore it
async function restoreStateFromUrl() {
  const queryParams = new URLSearchParams(window.location.search);
  selectedFeatureId = queryParams.get('id');
  selectedRegionId = queryParams.get('region');
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
    pois = await fetchPoisForAreaID(Number(selectedRegionId));
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


async function fetchPoisForAreaID(selectedRegionId: number): Promise<FeatureCollection> {
  const area = await fetchNominatimRelationData(selectedRegionId);
  boundingBox = area.bbox;
  if (boundingBox) {
    recenterMapOnRegion();
  }
  const pois = await processArea(area);
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
  selectedRegionId = event.result.properties.osm_id;
  resetselectedFeature();
  updateUrlWithState();
  processArea(event.result);
  showSpinButton();
});

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
      popSound.play();
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
  popSound.play();
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
  updateUrlWithState();
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

async function reveal(selectedFeature: Feature<Geometry, GeoJsonProperties>): Promise<any> {
  if (!selectedFeature) {
    console.error("No feature selected");
    return;
  }
  fanfareSound.play();
  console.log("🎺🎺🎺🎺🎺")
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
