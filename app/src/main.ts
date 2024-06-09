import {
  Map, FullscreenControl, MapMouseEvent, MapGeoJSONFeature, Popup
} from "maplibre-gl";
import polyline from "@mapbox/polyline";
import { area, bbox, bboxPolygon, feature, nearestPointOnLine, point } from "@turf/turf";
import {
  FeatureCollection,
  Feature,
  LineString,
  GeoJsonProperties,
  BBox
} from "geojson";
import {
  CustomAttributionControl,
  ShareControl,
  UploadControl,
  StravaControl,
  DemoRoutesControl,
  FAQControl,
  showInfo,
  displaySpinner,
  flashMessage,
  loadDemoRoutes
} from "./ui";
import { calculateIntersectingWaterwaysGeojson, createWaterwaysMessage, getMainWaterwaysForArea, getWaterwaysForArea, orderAlongRoute, parseGPXToGeoJSON } from "./geo";
import { setUp } from "./initialize";
import { updateStravaActivityDescription } from "./strava";
import { library, dom, icon } from '@fortawesome/fontawesome-svg-core'
import { faGlobe, faRoute, faCloudArrowUp, faUpload, faQuestion, faLink, faFloppyDisk, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { faStrava } from "@fortawesome/free-brands-svg-icons";

declare global {
  interface Window { umami: any; }
}

// Define global variables
export let isMapCenteredToRoute = false;
let hoveredFeatureId: string | number | null | undefined = null;
let selectedFeatureId: string | number | null | undefined = null;
export let shareableTitle = "Kreuzungen 🗺️";
export let shareableDescription =
  "Reveal the waterways that shape your adventures!";
export let shareableUrl = "https://kreuzungen.world";
export let shareableUrlEncoded = encodeURIComponent(shareableUrl);
export let currentRoute: Feature<LineString>;
export const mapInstance = createMap();
loadDemoRoutes();
library.add(faGlobe, faRoute, faCloudArrowUp, faUpload, faStrava, faQuestion, faLink, faFloppyDisk, faShareNodes)
// Replace any existing <i> tags with <svg> and set up a MutationObserver to
// continue doing this as the DOM changes.
dom.watch();

// Parse url params and check storage for strava login state
setUp();

// Get the current location and set the map center
navigator.geolocation.getCurrentPosition(setMapCenter);

// Add file upload event listener for .gpx files and ensure the info box is 
const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", processFileUpload, false);
}
const inputElement = document.querySelector("input");
if (inputElement) {
  inputElement.addEventListener("cancel", (evt) => {
    showInfo();
  });
}

// Set the map center to the user's current location
function setMapCenter(pos: GeolocationPosition) {
  if (!isMapCenteredToRoute) {
    console.log("Setting map center to geo location of user")
    mapInstance.setCenter([pos.coords.longitude, pos.coords.latitude]);
  }
}

// Read and parse and process a uploaded .gpx file
function processFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const selectedFile = target.files?.[0];
  if (!selectedFile) return;
  if (!selectedFile.name.endsWith(".gpx")) {
    flashMessage("Only .gpx files are supported");
    return;
  }
  const fileReader = new FileReader();
  fileReader.readAsText(selectedFile);
  fileReader.onload = async function (e) {
    const fileContents = e.target?.result?.toString();
    if (fileContents) {
      const routeGeoJSON = await parseGPXToGeoJSON(fileContents);
      window.umami.track('processing-local-file');
      processGeojson(routeGeoJSON.features[0]);
    }
  };
}

// Process a GeoJSON object, calculate intersecting waterways and display them on the map with interactions
export async function processGeojson(
  routeGeoJSON: Feature<LineString>,
  fromStrava: boolean = false,
  stravaID?: number
) {
  clearRoute();
  addRoute(routeGeoJSON);
  displayRouteMetadata(routeGeoJSON);
  fitMapToBoundingBox(bbox(routeGeoJSON));
  displaySpinner("info");
  // TODO: if its a big bbox for the geojson, flash a message to say so and it will take a while
  const bboxArea = area(bboxPolygon(bbox(routeGeoJSON)));
  // If the bounding box is large, flash a message to the user
  if (bboxArea > 50000000000) {
    flashMessage("The the route is a big one 🔥 This may take a while...");
  }
  calculateIntersectingWaterwaysGeojson(routeGeoJSON)
    .then(intersectingWaterways => {
      if (intersectingWaterways) {
        displayIntersectingWaterways(intersectingWaterways);
        addMapInteractions()
        if (mapInstance.getLayer("route")) {
          mapInstance.moveLayer("route");
        }
        // TODO: order rivers by intersection index along route
        // const orderedIntersectingWaterways = orderAlongRoute(intersectingWaterways, routeGeoJSON)
        displayWaterwayNames(intersectingWaterways);
        if (fromStrava && stravaID) {
          displayManualUpdateButton(intersectingWaterways, stravaID)
        }
      }
    });
}

export async function loadWaterwaysForArea(areaName: string) {
  clearRoute();
  displaySpinner("info");
  flashMessage("There is a lot of data to compute 🔥 This may take a while...")
  getWaterwaysForArea(areaName).then(waterways => {
    if (waterways) {
      displayIntersectingWaterways(waterways);
      addMapInteractions();
      displayWaterwayNames(waterways);
      fitMapToBoundingBox(bbox(waterways));
    }
  });
}

export async function loadMainWaterwaysForArea(areaName: string) {
  clearRoute();
  displaySpinner("info");
  flashMessage("There is a lot of data to compute 🔥 This may take a while...")
  getMainWaterwaysForArea(areaName).then(waterways => {
    if (waterways) {
      displayIntersectingWaterways(waterways);
      addMapInteractions();
      displayWaterwayNames(waterways);
      fitMapToBoundingBox(bbox(waterways));
    }
  });
}


function createMap() {
  class ExtendedMap extends Map {
    removeLayerAndSource(name: string) {
      this.removeLayer(name);
      this.removeSource(name);
    }
  }
  const map = new ExtendedMap({
    container: "map",
    style:
      "https://api.maptiler.com/maps/topo-v2/style.json?key=ykqGqGPMAYuYgedgpBOY",
    center: [0, 51.4769], // Greenwich meridian
    zoom: 10,
    maxZoom: 18,
    minZoom: 5,
    maxPitch: 85,
    attributionControl: false,
  });
  const attributionControl = new CustomAttributionControl({
    compact: true,
  });

  map.addControl(attributionControl);
  map.addControl(new FullscreenControl());
  const uploadControl = new UploadControl("fileInput", processFileUpload);
  map.addControl(uploadControl, "top-right");
  const stravaControl = new StravaControl();
  map.addControl(stravaControl, "top-right");
  const demoRoutesControl = new DemoRoutesControl();
  map.addControl(demoRoutesControl, "top-right");
  const faqControl = new FAQControl();
  map.addControl(faqControl, "bottom-right");
  const shareControl = new ShareControl();
  map.addControl(shareControl, "bottom-right");
  return map;
}


function clearRoute() {
  // Clear existing info and reset map state
  shareableUrl = "";
  shareableUrlEncoded = "";
  // close any open popups
  const popups = document.querySelectorAll(".mapboxgl-popup");
  popups.forEach((popup) => popup.remove());
  // Remove existing layers and sources
  if (mapInstance.getLayer("route")) {
    mapInstance.removeLayerAndSource("route");
  }
  if (mapInstance.getLayer("intersectingWaterways")) {
    mapInstance.removeLayerAndSource("intersectingWaterways");
  }
  const infoElement = document.getElementById("info");
  if (infoElement) {
    infoElement.innerHTML = "";
    infoElement.style.display = "none";
  }
  const sourceElement = document.getElementById("source");
  if (sourceElement) {
    sourceElement.innerHTML = "";
    sourceElement.style.display = "none";
  }
}

async function addRoute(routeGeoJSON: Feature<LineString>) {
  mapInstance.addSource("route", { type: "geojson", data: routeGeoJSON });
  mapInstance.addLayer({
    id: "route",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#fc03ca", "line-width": 5,
      //  "line-dasharray": [1, 2] 
    },
  });
  currentRoute = routeGeoJSON
  shareableUrl = `https://kreuzungen.world/index.html?route=${encodeURIComponent(
    polyline.fromGeoJSON(routeGeoJSON)
  )}`;
  shareableUrlEncoded = encodeURIComponent(shareableUrl);
  shareableDescription = `Check out the waterways that I crossed on my latest adventures!`;
  // TODO: add more info.. date, length km and altitude gained.
}

function displayRouteMetadata(routeGeoJSON: Feature<LineString, GeoJsonProperties>) {

  const sourceElement = document.getElementById("source");
  sourceElement.style.display = "block";

  // minimize the attribution on a compact screen
  const attributionControl = mapInstance
    ._controls[0] as CustomAttributionControl;

  if (routeGeoJSON.properties.name) {
    // Create a new div element to contain the icon and link
    const routeContainer = document.createElement("div");
    routeContainer.id = "sourceLinkContainer"

    const routeIcon = icon({ prefix: 'fas', iconName: 'route' });
    routeContainer.appendChild(routeIcon.node[0]);
    routeContainer.innerHTML += ` ${routeGeoJSON.properties?.name}`;
    routeContainer.appendChild(document.createElement("br"));
    sourceElement.appendChild(routeContainer);
  }

  if (routeGeoJSON.properties.stravaUrl) {
    const routeElement = document.createElement("div")
    const routeLink = document.createElement("a")
    const stravaIcon = icon({ prefix: 'fab', iconName: 'strava' });
    routeElement.appendChild(stravaIcon.node[0]);
    routeLink.innerHTML += `View on Strava`;
    routeLink.href = routeGeoJSON.properties.stravaUrl;
    routeLink.target = "_blank";
    routeLink.style.color = "#fff";
    routeLink.style.textDecoration = "underline";
    routeLink.style.cursor = "pointer";
    routeElement.appendChild(routeLink)
    const sourceElement = document.getElementById("source")
    sourceElement.appendChild(routeElement);
  }

  if (routeGeoJSON.properties.upstreamUrl) {
    const routeElement = document.createElement("div")
    const routeLink = document.createElement("a")
    const stravaIcon = icon({ prefix: 'fas', iconName: 'globe' });
    routeElement.appendChild(stravaIcon.node[0]);
    routeLink.innerHTML += `View route source`;
    routeLink.href = routeGeoJSON.properties.url;
    routeLink.target = "_blank";
    routeLink.style.color = "#fff";
    routeLink.style.textDecoration = "underline";
    routeLink.style.cursor = "pointer";
    routeElement.appendChild(routeLink)
    const sourceElement = document.getElementById("source")
    sourceElement.appendChild(routeElement);
  }
}

function displayManualUpdateButton(intersectingWaterways: FeatureCollection, activity_id: number) {


  // if no features then flash a message and return
  if (intersectingWaterways.features.length === 0) {
    console.log("No intersecting waterways found");
    flashMessage("No intersecting waterways found. Pick another activity.")
    return;
  }
  // get the owner access token from local storage
  const owner_access_token = JSON.parse(localStorage.getItem("strava_data")).access_token;
  // handel the case where it is not set
  if (!owner_access_token) {
    console.error("No owner access token found");
    flashMessage("Something went wrong. No local token found. Try authorizing again.")
    return;
  }

  const updateElement = document.createElement("div")
  const cloudIcon = icon({ prefix: 'fas', iconName: 'cloud-arrow-up' });
  const updateLink = document.createElement("a")
  updateElement.appendChild(cloudIcon.node[0]);
  updateLink.innerHTML += `Update description on Strava`;
  updateLink.style.color = "#fff";
  updateLink.style.textDecoration = "underline"; // Add underline to make it look like a link
  updateLink.style.cursor = "pointer"; // Change cursor to pointer on hover
  updateElement.appendChild(updateLink)
  const sourceElement = document.getElementById("source")
  sourceElement.appendChild(updateElement);

  // add click action to update element
  updateElement.addEventListener("click", async () => {
    if (intersectingWaterways.features.length === 0) {
      console.log("No intersecting waterways found");
      return;
    }
    const waterwaysMessage = createWaterwaysMessage(intersectingWaterways);
    // update the activity description with the waterways message if there are waterways
    const success = await updateStravaActivityDescription(
      activity_id,
      owner_access_token,
      waterwaysMessage
    );
    // if success is false
    if (!success) {
      flashMessage("Failed to update the activity description. Something messed up. Try authorizing with Strava again.")
    } else {
      window.umami.track('manual-strava-activity-update', { id: activity_id });
      // feedback to user that the activity has been updated
      flashMessage(`Updated route! 🪩 <a href="https://www.strava.com/activities/${activity_id}" target="_blank">https://www.strava.com/activities/${activity_id}</a>`)
      // remove the update button
      updateElement.remove();
    }
  })
}

function fitMapToBoundingBox(bbox: any) {
  console.log("Fitting map to bounding box");
  mapInstance.fitBounds(bbox, { padding: 50, animate: true });
  isMapCenteredToRoute = true;
}

// Display intersecting waterways on the map, input is an array of FeatureCollections
function displayIntersectingWaterways(
  intersectingWaterways: FeatureCollection
) {
  mapInstance.addSource("intersectingWaterways", {
    type: "geojson",
    data: intersectingWaterways,
    promoteId: "name",
  });

  mapInstance.addLayer({
    id: "intersectingWaterways",
    type: "line",
    source: "intersectingWaterways",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#0080ff",
      "line-opacity": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        1,
        0.6,
      ],
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        6,
        4,
      ],
    },
  });
}

function nearbyFeature(e: MapMouseEvent, layer: string): any {
  // return the single closest feature to the mouse pointer, if there is none then return null
  const pixelDistance = 15;
  let nearbyFeatures = mapInstance.queryRenderedFeatures([
    [e.point.x - pixelDistance / 2, e.point.y - pixelDistance / 2],
    [e.point.x + pixelDistance / 2, e.point.y + pixelDistance / 2]
  ], { layers: [layer] });
  return { ...e, features: nearbyFeatures };
}


function addMapInteractions() {
  // TODO: improve the ui by reducing the sensitivity.
  // https://github.com/acalcutt/maplibre-gl-inspect/blob/main/lib/MaplibreInspect.js#L159C1-L176C6

  // Update selected property on click event and create a popup
  mapInstance.on("click", (e) => {
    // remove and features that are selected
    if (selectedFeatureId) {
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: selectedFeatureId },
        { selected: false }
      );
      selectedFeatureId = null;
    }

    // Create a popup for the near feature, reduce the sensitivity of selecting the feature exactly.
    const nearFeatures = nearbyFeature(e, "intersectingWaterways");
    if (nearFeatures.features.length > 0) {
      createPopUp(nearFeatures);
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: nearFeatures.features[0].id },
        { selected: true }
      );
      selectedFeatureId = nearFeatures.features[0].id;
    }

  });

  // Update selected property on mouseenter event
  mapInstance.on("mouseenter", "intersectingWaterways", (e) => {
    mapInstance.getCanvas().style.cursor = "pointer";
    hoveredFeatureId = e.features[0].id;
    mapInstance.setFeatureState(
      { source: "intersectingWaterways", id: hoveredFeatureId },
      { selected: true }
    );
  });

  // Update selected property on mouseleave event
  mapInstance.on("mouseleave", "intersectingWaterways", () => {
    mapInstance.getCanvas().style.cursor = "";
    if (selectedFeatureId === hoveredFeatureId) {
      return;
    }
    if (hoveredFeatureId) {
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: hoveredFeatureId },
        { selected: false }
      );
    }
    hoveredFeatureId = null;
  });

  // Update selected property on mousemove event
  mapInstance.on("mousemove", "intersectingWaterways", (e) => {
    if (e.features.length > 0) {
      if (hoveredFeatureId) {
        mapInstance.setFeatureState(
          { source: "intersectingWaterways", id: hoveredFeatureId },
          { selected: false }
        );
      }
      hoveredFeatureId = e.features[0].id;
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: hoveredFeatureId },
        { selected: true }
      );
    }
  });
}

function createPopUp(
  x: MapMouseEvent & {
    features?: MapGeoJSONFeature[];
  } & Object
) {
  const riverName = x.features[0].properties.name;
  let destination = null
  let wikipedia = null
  let wikidata = null
  let type = null
  let urls = []
  if (x.features[0].geometry.type === "MultiLineString") {
    // cheque if it has the collected property field. If it does, then use it, otherwise use the features property.
    if (!x.features[0].properties.collectedProperties) {
      console.error("No collectedProperties field found")
      destination = x.features[0].properties.destination
      wikipedia = x.features[0].properties.wikipedia
      wikidata = x.features[0].properties.wikidata
      type = x.features[0].properties.type
      urls = [x.features[0].properties.id]
    }
    else {
      const collectedProps = JSON.parse(
        x.features[0].properties.collectedProperties
      );
      for (let i = 0; i < collectedProps.length; i++) {
        if (collectedProps[i].destination) {
          destination = collectedProps[i].destination
        }
        if (collectedProps[i].wikipedia) {
          wikipedia = collectedProps[i].wikipedia
        }
        if (collectedProps[i].wikidata) {
          wikidata = collectedProps[i].wikidata
        }
        if (collectedProps[i].type) {
          type = collectedProps[i].type
        }

        if (collectedProps[i].id) {
          urls.push(collectedProps[i].id)
        }
      }
    }
  } else if (x.features[0].geometry.type === "LineString") {
    destination = x.features[0].properties.destination
    wikipedia = x.features[0].properties.wikipedia
    wikidata = x.features[0].properties.wikidata
    type = x.features[0].properties.type
    urls = [x.features[0].properties.id]
  } else {
    console.error("Unknown geometry type")
  }

  let osmUrlsContent = "";

  osmUrlsContent = `
    <br>
    <details class="osm-details">
      <summary>OSM data source</summary>
        ${urls.map((url) => `<a href="https://www.openstreetmap.org/${url}" target="_blank">https://www.openstreetmap.org/${url}</a><br>`).join("")}
    </details>
  `;

  let popupContent = `Name: ${riverName}`;

  if (destination) {
    popupContent += `<br>Destination: ${destination}`;
  }

  if (wikipedia) {
    const wikipediaUrl = `https://www.wikipedia.org/wiki/${wikipedia}`;
    popupContent += `<br>Wikipedia: <a href="${wikipediaUrl}" target="_blank">${wikipedia}</a>`;
  }

  if (wikidata) {
    const wikidataUrl = `https://www.wikidata.org/wiki/${wikidata}`;
    popupContent += `<br>Wikidata: <a href="${wikidataUrl}" target="_blank">${wikidata}</a>`;
  }

  if (type) {
    popupContent += `<br>Type: ${type}`;
  }

  popupContent += osmUrlsContent;

  const p = point([x.lngLat.lng, x.lngLat.lat]);
  if (x.features && x.features.length > 0) {
    const snappedCoordinates = nearestPointOnLine((x.features[0].geometry as LineString), p);
    const [lng, lat] = snappedCoordinates.geometry.coordinates;
    new Popup({ closeButton: true, closeOnClick: true })
      .setLngLat([lng, lat])
      .setHTML(popupContent)
      .addTo(mapInstance);
  } else {
    console.error("No features found");
  }
}

function displayWaterwayNames(intersectingWaterways: FeatureCollection) {
  console.log(intersectingWaterways)
  // Display all the river names in the info-container
  // extract the name and geometry from the intersectingWaterways

  const riverNames = intersectingWaterways.features
    .map((feature) => ({
      name: feature.properties.name,
      geometry: feature.geometry,
      intersection: feature.properties.intersection
    }))
    .filter((item) => item.name);

  const infoElement = document.getElementById("info");

  infoElement.innerHTML = `<strong>Waterways crossed: ${riverNames.length}</strong>`;

  // Create a separate container for the river names
  const riverNamesContainer = document.createElement("div");
  riverNamesContainer.className = "river-names-container";

  // Create a list of clickable items for each waterway name
  riverNames.forEach((item) => {
    const riverElement = document.createElement("div");
    riverElement.className = "river-name";
    riverElement.textContent = item.name;
    // Event listener when mouse enters over the element
    riverElement.addEventListener("mouseenter", () => {
      // Set line-opacity to 1 when hovered.
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: item.name },
        { selected: true }
      );
    });

    // Event listener when mouse leaves the element
    riverElement.addEventListener("mouseleave", () => {
      if (item.name === selectedFeatureId) {
        return;
      }
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: item.name },
        { selected: false }
      );
    });
    // Event listener for click event to center the map on the intersection property value
    riverElement.addEventListener("click", () => {
      // unset the selected feature state
      if (selectedFeatureId) {
        mapInstance.setFeatureState(
          { source: "intersectingWaterways", id: selectedFeatureId },
          { selected: false }
        );
        selectedFeatureId = null;
      }
      // Use turf to calculate the bounding box of the feature's geometry
      const routeBoundingBox = bbox(item.geometry);
      fitMapToBoundingBox(routeBoundingBox);
      // mapInstance.flyTo({ center: item.intersection })
      // set the selected feature id to and set the feature state to selected
      selectedFeatureId = item.name;
      mapInstance.setFeatureState(
        { source: "intersectingWaterways", id: item.name },
        { selected: true }
      );

    });

    // Append the waterway name element to the river names container
    riverNamesContainer.appendChild(riverElement);
  });

  // Append the river names container to the info container
  infoElement.appendChild(riverNamesContainer);

  infoElement.style.display = "flex";
}

