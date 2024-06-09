import polyline from "@mapbox/polyline";
import { processGeojson, mapInstance, loadWaterwaysForArea, loadMainWaterwaysForArea } from "./main";
import {
  getAndStoreStravaAccessToken,
  refreshStravaAccessToken,
} from "./strava";
import { flashMessage, loadStravaActivities } from "./ui";
import { feature } from "@turf/turf";
import { getSavedRoute } from "./stash";

export async function setUp() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("route")) {
    await loadPolylineEncodedRoute(urlParams.get("route"));
  }
  if (urlParams.has("showAll")) {
    await loadAllWaterways(urlParams.get("showAll"));
  }
  if (urlParams.has("showMain")) {
    await loadMainWaterways(urlParams.get("showMain"));
  }
  if (urlParams.has("saved")) {
    await loadSavedRoute(urlParams.get("saved"));
  }
  if (urlParams.has("scope")) {
    await handleStravaOauthRedirect(urlParams.get("scope"), urlParams.get("code"));
  }
  const stravaAuthData = JSON.parse(localStorage.getItem("strava_data"));
  await handleStravaAuthentication(stravaAuthData);
}

async function loadPolylineEncodedRoute(pl: string) {
  let geojson = feature(polyline.toGeoJSON(pl));
  geojson.properties = { name: "✨ Route shared with magic link ✨" };
  if (mapInstance.isStyleLoaded()) {
    processGeojson(geojson);
  } else {
    mapInstance.once("style.load", () => {
      processGeojson(geojson);
    });
  }
}

async function loadAllWaterways(areaName: string) {
  if (mapInstance.isStyleLoaded()) {
    loadWaterwaysForArea(areaName)
  } else {
    mapInstance.once("style.load", () => {
      loadWaterwaysForArea(areaName);
    });
  }
}

async function loadMainWaterways(areaName: string) {
  if (mapInstance.isStyleLoaded()) {
    loadMainWaterwaysForArea(areaName)
  } else {
    mapInstance.once("style.load", () => {
      loadMainWaterwaysForArea(areaName);
    });
  }
}

async function loadSavedRoute(savedId: string) {
  const savedGeojson = await getSavedRoute(savedId)
  processGeojson(savedGeojson);
}

async function handleStravaOauthRedirect(scopes: string, code: string) {
  if (!hasRequiredScopes(scopes)) {
    flashMessage('To Sync with strava, you need to authorize Kreuzungen it to read your activity data. Please authenticate again and check the box for "View data about your activities".');
    document.getElementById("stravaConnect").style.display = "flex";
    document.getElementById("stravaPowered").style.display = "none";
    return;
  }
  if (!hasWriteScope(scopes)) {
    flashMessage('You have not granted Strava "Write" permissions to Kreuzungen.<br><p>Grant the permissions and enable Kreuzungen to Automagically update newly created Strava activities .</p><hr><p style="">Crossed 5 waterways 🏞️ Nile | Amazon River | Mississippi River | Danube River | Ganges | River Thames 🌐 <a href="https://kreuzungen.world">https://kreuzungen.world</a> 🗺️</p>');
  }
  try {
    const accessToken = await getAndStoreStravaAccessToken(code);
    loadStravaActivities(accessToken);
  } catch (error) {
    console.error()
    return;
  }
}

async function handleStravaAuthentication(stravaData: any) {
  let token_exists = stravaData !== null;
  let expires_at = token_exists ? stravaData.expires_at : 0;
  // Token exists and is still valid
  if (token_exists && new Date().getTime() / 1000 < expires_at) {
    console.log("Strava token exists and is still valid");
    const accessToken = stravaData.access_token;
    loadStravaActivities(accessToken);
  }
  // Token exists but is expired
  else if (token_exists && new Date().getTime() / 1000 >= expires_at) {
    console.log("Strava token exists but is expired");
    const refreshToken = stravaData.refresh_token;
    let newAccessToken = await refreshStravaAccessToken(refreshToken);
    loadStravaActivities(newAccessToken);
  }
  // Token does not exist
  else {
    console.log("Strava token does not exist");
    document.getElementById("stravaConnect").style.display = "flex";
    document.getElementById("stravaPowered").style.display = "none";
  }
}


function hasRequiredScopes(scopes: string): boolean {
  return ["activity", "activity:read_all"].some(scope => scopes.includes(scope));
}

function hasWriteScope(scopes: string): boolean {
  return scopes.includes("activity:write");
}