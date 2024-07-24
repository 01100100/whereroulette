import { library, icon } from "@fortawesome/fontawesome-svg-core";
import { faQuestion, faShareNodes, faSpinner } from "@fortawesome/free-solid-svg-icons";
import maplibregl from "maplibre-gl";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { updateSelectedCategory, resetSpin } from "./main";

// register the icons with the library for future use
library.add(faQuestion, faShareNodes, faSpinner);

// state variable to keep track of which container is currently displayed
export let currentlyDisplayedContainer: "faq" | "info" | "results" | null = "info";

// TODO: refactor this
const emojiMap: { [key: string]: string } = {
  "pub": "🍺",
  "bar": "🍷",
  "biergarten": "🍺",
  "cafe": "☕",
  "restaurant": "🍽️",
  "fast_food": "🍔",
  "food_court": "🍔",
  "ice_cream": "🍦",
  "climbing": "🧗",
  "bouldering": "🧗",
  "garden": "🌳",
  "park": "🌳",
}

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

export class FilterControl {
  // filter button (filter icon) to select the filter option, it displays the current filter using a emoji
  // when its clicked, it expands to show the rest of the categories emojis and when a different filter is clicked, it updates the selectedCategory value in ./main.ts, minimizes with the updated emoji displayed
  _map: any;
  _container!: HTMLDivElement;
  _hiddenEmojiContainer!: HTMLDivElement;
  _categories: { [key: string]: { tag: string; emoji: string } };
  private _selectedEmoji: string;
  private _isFilterExpanded: boolean = false;

  constructor(categories: { [key: string]: { tag: string; emoji: string } }) {
    this._categories = categories;
    // Initialize with the first category's emoji
    this._selectedEmoji = Object.values(categories)[0].emoji;
  }

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const button = document.createElement("button");
    button.id = "filter-button";
    button.type = "button";
    button.title = "Filter";
    button.style.borderRadius = "4px";
    button.onclick = () => {
      if (this._isFilterExpanded) {
        this.minimizeFilterControl();
      } else {
        this.expandFilterControl();
      }
    };
    const emojiTextNode = document.createTextNode(this._selectedEmoji);
    button.appendChild(emojiTextNode);
    this._container.appendChild(button);
    this._map.on("mousedown", () => {
      if (this._isFilterExpanded) {
        this.minimizeFilterControl();
      }
    });
    return this._container;
  }

  updateFilterControlIcon(category: string) {
    this._selectedEmoji = this._categories[category].emoji;
    this.updateFilterControl();
  }


  updateAndMinimizeFilterControl(category: string) {
    this._selectedEmoji = this._categories[category].emoji;
    updateSelectedCategory(category);
    this.updateFilterControl();
    this.minimizeFilterControl();
  }

  minimizeFilterControl() {
    if (this._hiddenEmojiContainer) {
      this._hiddenEmojiContainer.remove();
    }
    this._isFilterExpanded = false;
  }

  updateFilterControl() {
    const button = document.getElementById("filter-button");
    if (!button) {
      console.error("Filter button not found");
      return;
    }
    button.textContent = this._selectedEmoji;
  }

  expandFilterControl() {
    this._isFilterExpanded = true;
    this._hiddenEmojiContainer = document.createElement("div");
    this._hiddenEmojiContainer.id = "hidden-emoji-container";
    this._container.prepend(this._hiddenEmojiContainer);
    Object.entries(this._categories).forEach(([key, { emoji }]) => {
      if (emoji === this._selectedEmoji) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = emoji;
      button.onclick = () => {
        console.log(`Expanded filter button clicked: ${emoji}`);
        this._selectedEmoji = emoji;
        this.updateAndMinimizeFilterControl(key);
      };
      this._hiddenEmojiContainer.appendChild(button);
    });
  }

  onRemove() {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._map = undefined;
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
  const resultsContainer = document.createElement("div");
  resultsContainer.id = "results";
  resultsContainer.className = "results-container";
  resultsContainer.style.display = "block";
  const featureProperties = feature.properties;
  if (!featureProperties) {
    console.error("Feature properties not found");
    return;
  }
  const featureName = featureProperties.name;
  let featureType: string = ""
  let featureEmoji: string = ""
  if (featureProperties.amenity) {
    featureType = featureProperties.amenity;
  }
  else if (featureProperties.sport) {
    featureType = featureProperties.sport;
  }
  else if (featureProperties.leisure) {
    featureType = featureProperties.leisure;
  }
  if (featureType) {
    featureEmoji = emojiMap[featureType];
  }
  console.log(featureProperties)
  const featureOpeningHours = featureProperties.opening_hours;
  const featureId = featureProperties.id;
  const featureDetails = document.createElement("div");
  featureDetails.className = "feature-details";
  featureDetails.innerHTML = `
    <h2>${featureName}</h2>
    <p>Type: ${featureType} ${featureEmoji}</p>
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
    resetSpin();
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

