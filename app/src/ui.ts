import { library, icon } from "@fortawesome/fontawesome-svg-core";
import { faQuestion, faShareNodes, faSpinner } from "@fortawesome/free-solid-svg-icons";

// register the icons with the library for future use
library.add(faQuestion, faShareNodes, faSpinner);

// state variable to keep track of which container is currently displayed
export let currentlyDisplayedContainer: "faq" | "info" | null = "info";

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
        hideInfo();
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
  private _shareableUrl: string;
  private _shareableTitle: string;
  private _shareableDescription: string;

  constructor(shareableUrl: string, shareableTitle: string, shareableDescription: string) {
    this._shareableUrl = shareableUrl;
    this._shareableTitle = shareableTitle;
    this._shareableDescription = shareableDescription;
  }

  setShareableUrl(url: string) {
    this._shareableUrl = url;
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
      if (navigator.share) {
        navigator
          .share({
            title: this._shareableTitle,
            url: this._shareableUrl,
            text: this._shareableDescription,
          })
          .then(() => {
            console.log("Shared!");
          })
          .catch(console.error);
      } else {
        navigator.clipboard
          .writeText(this._shareableUrl)
          .then(() => {
            console.log("Url copied to clipboard: " + this._shareableUrl);
            flashMessage(`Url Copied to clipboard! 🪩 <a href="${this._shareableUrl}" target="_blank">${this._shareableUrl}</a>`)
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
