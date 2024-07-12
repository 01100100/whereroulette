import { library, icon } from "@fortawesome/fontawesome-svg-core";
import { faQuestion, faShareNodes, faSpinner } from "@fortawesome/free-solid-svg-icons";
import maplibregl from "maplibre-gl";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { recenterMapOnRegion, resetselectedFeature } from "./main";


// register the icons with the library for future use
library.add(faQuestion, faShareNodes, faSpinner);

// state variable to keep track of which container is currently displayed
export let currentlyDisplayedContainer: "faq" | "info" | "results" | null = "info";

export class CustomAttributionControl extends maplibregl.AttributionControl {
  _toggleAttribution = () => {
    if (this._container.classList.contains("maplibregl-compact")) {
      if (this._container.classList.contains("maplibregl-compact-show")) {
        this._container.setAttribute("open", "");
        this._container.classList.remove("maplibregl-compact-show");
      } else {
        this._container.classList.add("maplibregl-compact-show");
        this._container.removeAttribute("open");
      }
    }
  };

  _updateCompactMinimize = () => {
    if (this._container.classList.contains("maplibregl-compact")) {
      if (this._container.classList.contains("maplibregl-compact-show")) {
        this._container.classList.remove("maplibregl-compact-show");
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

export class FAQControl {
  _map: any;
  _container!: HTMLDivElement;
  constructor() { }
  onAdd(map: any) {
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
        hideAllContainers();
      } else {
        hideAllContainers();
        showFAQContainer();
      }
    };
    const questionIcon = icon({ prefix: 'fas', iconName: 'question' });
    button.appendChild(questionIcon.node[0]);
    this._container.appendChild(button);
    this._map.on("mousedown", () => {
      hideFAQContainer();
    });
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}

export class ShareControl {
  // share button (share-nodes icon) to use the web share api if available
  // if not available, it copies a shareable url to the clipboard
  _map: any;
  _container!: HTMLDivElement;
  private _shareableTitle: string;
  private _shareableDescription: string;

  constructor(shareableUrl: string, shareableTitle: string, shareableDescription: string) {
    this._shareableTitle = shareableTitle;
    this._shareableDescription = shareableDescription;
  }

  setShareableTitle(title: string) {
    this._shareableTitle = title;
  }

  setShareableDescription(description: string) {
    this._shareableDescription = description;
  }

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.title = "Share";
    shareButton.style.borderRadius = "4px";
    shareButton.onclick = async () => {
      const currentUrl = window.location.href;
      if (navigator.share) {
        navigator
          .share({
            title: this._shareableTitle,
            url: currentUrl,
            text: this._shareableDescription,
          })
          .then(() => {
            console.log("Shared!");
          })
          .catch(console.error);
      } else {
        navigator.clipboard
          .writeText(currentUrl)
          .then(() => {
            console.log("Url copied to clipboard: " + currentUrl);
            flashMessage(`Url Copied to clipboard! 🪩 <a href="${currentUrl}" target="_blank">${currentUrl}</a>`)
          })
          .catch((err) => {
            console.error("Unable to copy URL to clipboard", err);
          });
      }
    };

    const shareIcon = icon({ prefix: 'fas', iconName: 'share-nodes' });
    shareButton.appendChild(shareIcon.node[0]);
    this._container.appendChild(shareButton);

    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
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
  if (infoContainer) {
    infoContainer.style.display = "flex";
  }
  currentlyDisplayedContainer = 'info';
}

export function showResults(feature: Feature<Geometry, GeoJsonProperties>) {
  // make a container and add it to the dom
  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";
  resultsContainer.className = "results-container";
  resultsContainer.style.display = "block";
  // {
  //   "type": "Feature",
  //   "id": 15,
  //   "properties": {
  //     "amenity": "pub",
  //     "name": "The Pond House",
  //     "opening_hours": "Mo-Th 12:00-23:00, Fr,Sa 12:00-24:00, Su 12:00-22:30",
  //     "wheelchair": "yes",
  //     "id": "node/318562248"
  //   },
  //   "geometry": {
  //     "type": "Point",
  //     "coordinates": [
  //       -1.008412,
  //       51.4601031
  //     ]
  //   }
  // }
  // TODO: display this nicely
  const featureProperties = feature.properties;
  if (!featureProperties) {
    console.error("Feature properties not found");
    return;
  }
  const featureName = featureProperties.name;
  const featureAmenity = featureProperties.amenity;
  const featureOpeningHours = featureProperties.opening_hours;
  const featureId = featureProperties.id;
  const featureDetails = document.createElement("div");
  featureDetails.className = "feature-details";
  featureDetails.innerHTML = `
    <h2>${featureName}</h2>
    <p>Type: ${featureAmenity}</p>
    `
    + (featureOpeningHours ? `<p>Opening Hours: ${featureOpeningHours}</p>` : "")
    + `
    <p>OSM: <a href="https://www.openstreetmap.org/${featureId}" target="_blank">https://www.openstreetmap.org/${featureId}</a></p>
  `;
  resultsContainer.appendChild(featureDetails);

  const spinAgainButton = document.createElement("button");
  spinAgainButton.id = "spin-button";
  spinAgainButton.className = "spin-again-button";
  spinAgainButton.innerHTML = "Spin Again";
  spinAgainButton.onclick = () => {
    resetselectedFeature();
    recenterMapOnRegion();
    hideAllContainers();
    showSpinButton();
  };
  resultsContainer.appendChild(spinAgainButton);



  // TODO: add share and directions buttons
  const shareButton = document.createElement("button");
  shareButton.id = "share-button";
  shareButton.className = "share-button";
  shareButton.innerHTML = "Share";
  shareButton.onclick = () => {

  };


  const mapContainer = document.getElementById("map");
  if (mapContainer) {
    mapContainer.appendChild(resultsContainer);
    currentlyDisplayedContainer = 'results';
  }
}

export function hideResults() {
  const resultsContainer = document.getElementById("results");
  if (resultsContainer) {
    resultsContainer.remove();

  }
}

export function showSpinButton() {
  const spinButton = document.getElementById("spin-button");
  if (spinButton) {
    spinButton.style.display = "block";
  }
}

export function hideSpinButton() {
  const spinButton = document.getElementById("spin-button");
  if (spinButton) {
    spinButton.style.display = "none";
  }
}

export function showRevealButton() {
  const revealButton = document.getElementById("reveal-button");
  if (revealButton) {
    revealButton.style.display = "block";
  }
}

export function hideRevealButton() {
  const revealButton = document.getElementById("reveal-button");
  if (revealButton) {
    revealButton.style.display = "none";
  }
}

export function hideFAQContainer() {
  const faqContainer = document.getElementById("faq");
  if (faqContainer) {
    faqContainer.style.display = "none";
  }
}

export function showFAQContainer() {
  const faqContainer = document.getElementById("faq");
  if (faqContainer) {
    faqContainer.style.display = "block";
    currentlyDisplayedContainer = 'faq';
  }
}

export function hideAllContainers() {
  hideInfo();
  hideFAQContainer();
  hideResults();
  currentlyDisplayedContainer = null;
}

export function displaySpinner(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    console.error(`Element with id ${id} not found`);
    return;
  }
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

export function flashMessage(html: string) {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    console.log("Map container not found")
    return;
  }
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
