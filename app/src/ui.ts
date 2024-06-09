import maplibregl from "maplibre-gl";
import {
  mapInstance,
  shareableUrl,
  shareableDescription,
  shareableTitle,
  processGeojson,
  currentRoute
} from "./main";
import { saveRoute } from "./stash";
import { feature } from "@turf/helpers";
import { getStravaActivities } from "./strava";
import polyline from "@mapbox/polyline";
import { library, icon } from "@fortawesome/fontawesome-svg-core";
import { faUpload, faQuestion, faLink, faFloppyDisk, faShareNodes, faSpinner, faGlobe, faRoute, faCloudArrowUp, faCircleRight, faCircleLeft, faFileImport, faFileArrowUp } from "@fortawesome/free-solid-svg-icons";
import { faStrava } from "@fortawesome/free-brands-svg-icons";
// Add the icons to the library so you can use it in your page
library.add(faUpload, faStrava, faQuestion, faLink, faFloppyDisk, faShareNodes, faSpinner, faRoute, faGlobe, faCloudArrowUp, faCircleRight, faCircleLeft, faFileImport, faFileArrowUp);

let currentlyDisplayedContainer: 'activities' | 'demoRoutes' | "faq" | null = null;

export class CustomAttributionControl extends maplibregl.AttributionControl {
  _toggleAttribution = () => {
    if (this._container.classList.contains("maplibregl-compact")) {
      if (this._container.classList.contains("maplibregl-compact-show")) {
        this._container.setAttribute("open", "");
        this._container.classList.remove("maplibregl-compact-show");
        showSourceInfo();
      } else {
        this._container.classList.add("maplibregl-compact-show");
        this._container.removeAttribute("open");
        hideSourceInfo();
      }
    }
  };

  _updateCompactMinimize = () => {
    if (this._container.classList.contains("maplibregl-compact")) {
      if (this._container.classList.contains("maplibregl-compact-show")) {
        this._container.classList.remove("maplibregl-compact-show");
        showSourceInfo();
      }
    }
  };

  onAdd(map: maplibregl.Map) {
    const container = super.onAdd(map);
    container.classList.add("maplibregl-compact");
    this._map.on("mousedown", this._updateCompactMinimize);
    return container;
  }
}

export class UploadControl {
  private _fileInput: HTMLInputElement;
  private _map: any;
  private _container: HTMLDivElement;
  constructor(fileInputId, callback) {
    this._fileInput = document.getElementById(fileInputId) as HTMLInputElement;
    this._fileInput.addEventListener("change", callback, false);
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.title = "Upload File";
    button.style.backgroundColor = "#34c6eb";
    button.style.color = "white";
    button.style.borderRadius = "4px";
    button.onclick = () => {
      hideActivitiesContainer();
      hideDemoRoutesContainer();
      hideInfo();
      this._fileInput.click();
    };

    const uploadIcon = icon({ prefix: 'fas', iconName: 'upload' });
    button.appendChild(uploadIcon.node[0]);

    this._container.appendChild(button);

    // Add drag and drop upload functionality
    const mapContainer = document.getElementById("map");
    let dragCounter = 0; // Add a counter
    mapContainer.addEventListener("dragenter", (event) => {
      event.stopPropagation();
      event.preventDefault();
      dragCounter++;
      if (dragCounter === 1) {
        const previousDiv = document.querySelector("#file-upload-container");
        if (previousDiv) {
          previousDiv.parentNode.removeChild(previousDiv);
        }
        const fileUploadIcon = document.createElement("div");
        fileUploadIcon.id = "file-upload-container";
        const uploadIconElement = icon({ prefix: 'fas', iconName: 'file-arrow-up' }, { classes: ['fa-8x'] });
        fileUploadIcon.appendChild(uploadIconElement.node[0]);
        mapContainer.appendChild(fileUploadIcon);
        mapContainer.style.opacity = "0.8"
      }
    }, false);

    mapContainer.addEventListener("dragover", (event) => {
      event.preventDefault();
    }, false);

    mapContainer.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        mapContainer.style.opacity = "1"
        const uploadIcon = document.querySelector("#file-upload-container");
        if (uploadIcon) {
          uploadIcon.parentNode.removeChild(uploadIcon);
        }
      }
    }, false);

    mapContainer.addEventListener("drop", (event) => {
      event.preventDefault();
      const uploadIcon = document.querySelector("#file-upload-container");
      if (uploadIcon) {
        uploadIcon.parentNode.removeChild(uploadIcon);
      }
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this._fileInput.files = files;
        const changeEvent = new Event('change');
        this._fileInput.dispatchEvent(changeEvent);
      }
      dragCounter = 0;
      mapContainer.style.opacity = "1"
    }, false);


    return this._container;
  }



  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export class StravaControl {
  _map: any;
  _container: HTMLDivElement;
  constructor() { }
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.title = "Strava activities";
    button.style.backgroundColor = "#fc4c02";
    button.style.color = "white";
    button.style.borderRadius = "4px";
    button.onclick = () => {
      // toggle the Activities-container
      if (currentlyDisplayedContainer === 'activities') {
        showInfo();
        hideActivitiesContainer();
        currentlyDisplayedContainer = null;
      } else {
        hideInfo();
        hideFAQContainer();
        hideDemoRoutesContainer();
        showActivitiesContainer();
      }
    };

    const stravaIcon = icon({ prefix: 'fab', iconName: 'strava' });
    button.appendChild(stravaIcon.node[0]);
    this._container.appendChild(button);

    // Event to hide activities-container when map is interacted with
    this._map.on("mousedown", () => {
      hideActivitiesContainer();
      currentlyDisplayedContainer = null;
      showInfo();
    });

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map.off("mousedown", this.hideActivitiesContainer); // Remove the event listener
    this._map = undefined;
  }
  hideActivitiesContainer(arg0: string, hideActivitiesContainer: any) {
    throw new Error("Method not implemented.");
  }
}


export class DemoRoutesControl {
  _map: any;
  _container: HTMLDivElement;
  constructor() { }
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.title = "Famous Routes";
    button.style.borderRadius = "4px";
    button.onclick = () => {
      // toggle the demoRoutes-container
      if (currentlyDisplayedContainer === 'demoRoutes') {
        showInfo();
        hideDemoRoutesContainer();
        currentlyDisplayedContainer = null;
      } else {
        hideInfo();
        hideFAQContainer();
        hideActivitiesContainer();
        showDemoRoutesContainer();
      }
    };

    const stravaIcon = icon({ prefix: 'fas', iconName: 'route' });
    button.appendChild(stravaIcon.node[0]);
    this._container.appendChild(button);

    // Event to hide DemoRoutes-container when map is interacted with
    this._map.on("mousedown", () => {
      hideDemoRoutesContainer();
      showInfo();
      currentlyDisplayedContainer = null;
    });

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map.off("mousedown", this.hideDemoRoutesContainer); // Remove the event listener
    this._map = undefined;
  }
  hideDemoRoutesContainer(arg0: string, hideDemoRoutesContainer: any) {
    throw new Error("Method not implemented.");
  }
}

export class FAQControl {
  _map: any;
  _container: HTMLDivElement;
  constructor() { }
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    this._container.style.margin = "0 10px";
    const button = document.createElement("button");
    button.type = "button";
    button.title = "FAQ's";
    button.style.borderRadius = "4px";
    button.onclick = () => {
      if (currentlyDisplayedContainer === 'faq') {
        showInfo();
        showSourceInfo()
        hideFAQContainer();
        currentlyDisplayedContainer = null;
      } else {
        hideInfo();
        hideSourceInfo()
        hideActivitiesContainer();
        hideDemoRoutesContainer();
        showFAQContainer();
      }
    };
    const questionIcon = icon({ prefix: 'fas', iconName: 'question' });
    button.appendChild(questionIcon.node[0]);
    this._container.appendChild(button);
    this._map.on("mousedown", () => {
      hideFAQContainer();
      currentlyDisplayedContainer = null;
      showInfo();
      showSourceInfo()
    });
    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export class ShareControl {
  _map: any;
  _container: HTMLDivElement;
  _isShareExpanded: boolean;
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    this._isShareExpanded = false;

    const linkButton = document.createElement("button");
    linkButton.id = "linkButton";
    linkButton.type = "button";
    linkButton.style.display = "none";
    linkButton.title = "Copy url to clipboard";
    linkButton.style.borderRadius = "4px";
    linkButton.onclick = () => {
      navigator.clipboard
        .writeText(shareableUrl)
        .then(() => {
          console.log("URL copied to clipboard: " + shareableUrl);
          flashMessage(`URL copied to clipboard: <a href="${shareableUrl}" target="_blank">${shareableUrl}</a>`)
          window.umami.track('copy-polyline-encoded-url');
        })
        .catch((err) => {
          console.error("Unable to copy URL to clipboard", err);
        });
    };


    const linkIcon = icon({ prefix: 'fas', iconName: 'link' });
    linkButton.appendChild(linkIcon.node[0]);

    this._container.appendChild(linkButton);

    const saveButton = document.createElement("button");
    saveButton.id = "saveButton";
    saveButton.type = "button";
    saveButton.style.display = "none";
    saveButton.title = "Save route";
    saveButton.style.borderRadius = "4px";
    const floppyDiskIcon = icon({ prefix: 'fas', iconName: 'floppy-disk' });
    saveButton.appendChild(floppyDiskIcon.node[0]);
    saveButton.addEventListener("click", async () => {

      // TODO: Add a model to the screen, which displays disclaimer and a submit button, we will. store your route for you, and it will be accessible to anyone with the following URL. 

      // The URL will be copied to your clipboard, and you can share it with anyone you want.
      if (!currentRoute) {
        console.error("No route to save")
        flashMessage("Load a route first to save it.")
        return
      }
      const savedRoute = await saveRoute(currentRoute)
      const savedURL = savedRoute.url
      navigator.clipboard
        .writeText(savedURL)
        .then(() => {
          console.log("Route saved and URL copied to clipboard: " + savedURL);
          flashMessage(`Route saved and Url Copied to clipboard! 🪩 <a href="${savedURL}" target="_blank">${savedURL}</a>`)
        })
        .catch((err) => {
          console.error("Unable to copy URL to clipboard", err);
        });


    });
    this._container.appendChild(linkButton);
    this._container.appendChild(saveButton);

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.title = "Share";
    shareButton.style.borderRadius = "4px";
    shareButton.onclick = async () => {
      if (navigator.share) {
        // TODO: ask user for permission to save and share via url
        const savedRoute = await saveRoute(currentRoute)
        const savedURL = savedRoute.url
        navigator
          .share({
            title: shareableTitle,
            url: savedURL,
            text: shareableDescription,
          })
          .then(() => {
            console.log("Shared!");
          })
          .catch(console.error);
      } else {
        if (this._isShareExpanded) {
          this.minimizeShareControl();
        } else {
          this.expandShareControl();
        }
      }
    };

    const shareIcon = icon({ prefix: 'fas', iconName: 'share-nodes' });
    shareButton.appendChild(shareIcon.node[0]);
    this._container.appendChild(shareButton);

    return this._container;
  }


  minimizeShareControl() {
    const linkButton = document.getElementById("linkButton");
    if (linkButton) {
      linkButton.style.display = "none";
    }
    const saveButton = document.getElementById("saveButton");
    saveButton.style.display = "none";
    this._isShareExpanded = false;
  }

  expandShareControl() {
    const linkButton = document.getElementById("linkButton");
    linkButton.style.display = "block";
    const saveButton = document.getElementById("saveButton");
    saveButton.style.display = "block";
    this._isShareExpanded = true;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export function hideInfo() {
  const infoContainer = document.getElementById("info");
  if (infoContainer) {
    infoContainer.style.display = "none";
  }
}

export function hideSourceInfo() {
  const sourceContainer = document.getElementById("source");
  if (sourceContainer) {
    sourceContainer.style.display = "none";
  }
}

export function showInfo() {
  const infoContainer = document.getElementById("info");
  infoContainer.style.display = "flex";
}

export function showSourceInfo() {
  const sourceContainer = document.getElementById("source");
  if (mapInstance.isSourceLoaded("route")) {
    sourceContainer.style.display = "block";
  }
}

export function hideActivitiesContainer() {
  const activitiesContainer = document.getElementById("activities");
  if (activitiesContainer) {
    activitiesContainer.style.display = "none";
  }
}

export function hideDemoRoutesContainer() {
  const demoRoutesContainer = document.getElementById("demoRoutes");
  if (demoRoutesContainer) {
    demoRoutesContainer.style.display = "none";
  }
}

export function hideFAQContainer() {
  const faqContainer = document.getElementById("faq");
  if (faqContainer) {
    faqContainer.style.display = "none";
  }
}

export function showDemoRoutesContainer() {
  const demoRoutesContainer = document.getElementById("demoRoutes");
  demoRoutesContainer.style.display = "block";
  currentlyDisplayedContainer = 'demoRoutes';
}

export function showActivitiesContainer() {
  const activitiesContainer = document.getElementById("activities");
  activitiesContainer.style.display = "block";
  currentlyDisplayedContainer = 'activities';
}

export function showFAQContainer() {
  const activitiesContainer = document.getElementById("faq");
  activitiesContainer.style.display = "block";
  currentlyDisplayedContainer = 'faq';
}

export function displaySpinner(id) {
  const element = document.getElementById(id);
  const spinnerContainer = document.getElementById("spinner");
  if (!spinnerContainer) {
    const spinnerElement = document.createElement("div");
    spinnerElement.id = "spinner";
    spinnerElement.style.textAlign = "center";
    spinnerElement.style.display = "flex";
    spinnerElement.style.justifyContent = "center";
    spinnerElement.style.alignItems = "center";
    const spinnerIcon = icon({ prefix: 'fas', iconName: 'spinner' }, { classes: ['fa-spin', 'fa-3x'] });
    spinnerElement.appendChild(spinnerIcon.node[0]);
    element.appendChild(spinnerElement);
  }
  showInfo();
}

export async function loadStravaActivities(owner_access_token: string) {
  displaySpinner("activitiesList");
  // todo add error handling
  getStravaActivities(owner_access_token).then((activities) => {
    if (activities) {
      displayActivities(activities);
    }
  });
}

function displayActivities(activities: any[], startIndex: number = 0) {
  const activitiesPerPage = 5;
  const currentPageActivities = activities.slice(
    startIndex,
    startIndex + activitiesPerPage
  );
  const activitiesList = document.getElementById("activitiesList");
  activitiesList.style.width = "250px";
  activitiesList.innerHTML = "";
  currentPageActivities.forEach(function (activity) {
    const activityElement = createActivityElement(activity);
    activityElement.addEventListener("click", function () {
      console.log("Activity clicked: ", activity.name);
      loadActivityOnMap(activity)
    });
    activitiesList.appendChild(activityElement);
  });
  activitiesList.style.cursor = "pointer";
  const activitiesControl = document.getElementById("activitiesControl")
  activitiesControl.innerHTML = ""
  activitiesControl.style.paddingTop = "4px"
  // add right arrow
  if (activities.length > startIndex + activitiesPerPage) {
    const nextLink = document.createElement("a");
    const rightIcon = icon({ prefix: 'fas', iconName: 'circle-right' }, { classes: ['fa-2xl'] });
    nextLink.appendChild(rightIcon.node[0]);
    nextLink.style.float = "right";
    nextLink.style.cursor = "pointer";
    nextLink.addEventListener("click", function () {
      displayActivities(activities, startIndex + activitiesPerPage);
    });
    activitiesControl.appendChild(nextLink);
  }

  // add left arrow
  if (startIndex >= activitiesPerPage) {
    const prevLink = document.createElement("a");
    const leftIcon = icon({ prefix: 'fas', iconName: 'circle-left' }, { classes: ['fa-2xl'] });
    prevLink.appendChild(leftIcon.node[0]);
    prevLink.style.float = "right";
    prevLink.style.cursor = "pointer";
    prevLink.style.paddingRight = "5px"
    prevLink.addEventListener("click", function () {
      displayActivities(activities, startIndex - activitiesPerPage);
    });
    activitiesControl.appendChild(prevLink);
  }
}

export async function loadDemoRoutes() {
  displaySpinner("demoRoutesList");
  // TODO: get routes from routes.json file and display them
  const response = await fetch("routes.json");
  const routes = await response.json();
  displayDemoRoutes(routes);
}

function displayDemoRoutes(activities: any[], startIndex: number = 0) {
  const activitiesPerPage = 5;
  const currentPageActivities = activities.slice(
    startIndex,
    startIndex + activitiesPerPage
  );
  const activitiesList = document.getElementById("demoRoutesList");
  activitiesList.style.width = "250px";
  activitiesList.innerHTML = "";
  currentPageActivities.forEach(function (activity) {
    const activityElement = createDemoRouteElement(activity);
    activityElement.addEventListener("click", function () {
      console.log("Demo route clicked: ", activity.name);
      loadDemoRouteOnMap(activity)
    });
    activitiesList.appendChild(activityElement);
  });
  activitiesList.style.cursor = "pointer";
  const activitiesControl = document.getElementById("demoRoutesControl")
  activitiesControl.innerHTML = ""
  activitiesControl.style.paddingTop = "4px"
  // add right arrow
  if (activities.length > startIndex + activitiesPerPage) {
    const nextLink = document.createElement("a");
    const rightIcon = icon({ prefix: 'fas', iconName: 'circle-right' }, { classes: ['fa-2xl'] });
    nextLink.appendChild(rightIcon.node[0]);
    nextLink.style.float = "right";
    nextLink.style.cursor = "pointer";
    nextLink.addEventListener("click", function () {
      displayDemoRoutes(activities, startIndex + activitiesPerPage);
    });
    activitiesControl.appendChild(nextLink);
  }

  // add left arrow
  if (startIndex >= activitiesPerPage) {
    const prevLink = document.createElement("a");
    const leftIcon = icon({ prefix: 'fas', iconName: 'circle-left' }, { classes: ['fa-2xl'] });
    prevLink.appendChild(leftIcon.node[0]);
    prevLink.style.float = "right";
    prevLink.style.cursor = "pointer";
    prevLink.style.paddingRight = "5px"
    prevLink.addEventListener("click", function () {
      displayDemoRoutes(activities, startIndex - activitiesPerPage);
    });
    activitiesControl.appendChild(prevLink);
  }
}


function createActivityElement(activity) {
  const activityElement = document.createElement("div");
  activityElement.className =
    "activity-item";
  activityElement.style.display = "flex";
  activityElement.style.flexDirection = "column";
  const nameElement = document.createElement("div");
  nameElement.innerHTML = activity.name;
  nameElement.style.fontWeight = "bold";
  nameElement.style.whiteSpace = "nowrap";
  nameElement.style.overflow = "hidden";
  nameElement.style.textOverflow = "ellipsis";
  nameElement.style.maxWidth = "100%";
  activityElement.appendChild(nameElement);

  const detailsElement = document.createElement("div");
  detailsElement.style.display = "flex";
  detailsElement.style.justifyContent = "space-between";
  activityElement.appendChild(detailsElement);

  const distanceElement = document.createElement("div");
  distanceElement.innerHTML = (activity.distance / 1000).toFixed(2) + " km";
  detailsElement.appendChild(distanceElement);

  if (activity.start_date) {
    const dateElement = document.createElement("div");
    const date = new Date(activity.start_date);
    const formattedDate = date.toISOString().split("T")[0];
    dateElement.innerHTML = formattedDate;
    detailsElement.appendChild(dateElement);
  }
  return activityElement;
}

function createDemoRouteElement(activity) {
  const activityElement = document.createElement("div");
  activityElement.className =
    "demo-route-item";
  activityElement.style.display = "flex";
  activityElement.style.flexDirection = "column";
  const nameElement = document.createElement("div");
  nameElement.innerHTML = activity.name;
  nameElement.style.fontWeight = "bold";
  nameElement.style.whiteSpace = "nowrap";
  nameElement.style.overflow = "hidden";
  nameElement.style.textOverflow = "ellipsis";
  nameElement.style.maxWidth = "100%";
  activityElement.appendChild(nameElement);

  const detailsElement = document.createElement("div");
  detailsElement.style.display = "flex";
  detailsElement.style.justifyContent = "space-between";
  activityElement.appendChild(detailsElement);

  const distanceElement = document.createElement("div");
  distanceElement.innerHTML = (activity.distance / 1000).toFixed(2) + " km";
  detailsElement.appendChild(distanceElement);

  if (activity.start_date) {
    const dateElement = document.createElement("div");
    const date = new Date(activity.start_date);
    const formattedDate = date.toISOString().split("T")[0];
    dateElement.innerHTML = formattedDate;
    detailsElement.appendChild(dateElement);
  }
  return activityElement;
}

function loadActivityOnMap(activity) {
  hideActivitiesContainer();
  const geojson = feature(polyline.toGeoJSON(activity.map.summary_polyline));
  geojson.properties = {
    name: activity.name,
    stravaUrl: `https://www.strava.com/activities/${activity.id}`,
  };
  window.umami.track('processing-strava-activity', { user: activity.athlete.id, id: activity.id });
  processGeojson(geojson, true, activity.id);
}

function loadDemoRouteOnMap(demoRoute) {
  hideDemoRoutesContainer();
  const geojson = feature(polyline.toGeoJSON(demoRoute.summary_polyline));
  geojson.properties = {
    name: demoRoute.name,
  };
  if (demoRoute.stravaRouteId) {
    geojson.properties.stravaUrl = `https://www.strava.com/route/${demoRoute.stravaRouteId}`;
  }

  if (demoRoute.rideWithGPSId) {
    geojson.properties.rideWithGPSUrl = `https://ridewithgps.com/routes/${demoRoute.rideWithGPSId}`;
  }
  window.umami.track('loading-demo-route', { route: demoRoute.name });
  processGeojson(geojson);
}

export function flashMessage(html: string) {
  const mapContainer = document.getElementById("map");
  const previousMessages = document.getElementsByClassName("flash-message");
  for (let i = 0; i < previousMessages.length; i++) {
    mapContainer.removeChild(previousMessages[i]);
  }
  const messageContainer = document.createElement("div");
  messageContainer.className = "flash-message";
  messageContainer.innerHTML = html;
  mapContainer.appendChild(messageContainer);
  setTimeout(() => {
    messageContainer.style.opacity = "0";
    setTimeout(() => {
      mapContainer.removeChild(messageContainer);
    }, 1500); // Fade out in milliseconds
  }, 3500); // Displayed solid in milliseconds
}
