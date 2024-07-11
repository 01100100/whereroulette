import { Map } from "maplibre-gl";
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import { ShareControl, FAQControl, hideAllContainers, hideInfo, showSpinButton, hideSpinButton, currentlyDisplayedContainer, CustomAttributionControl } from "./ui";
import { FeatureCollection, Feature, Geometry } from "geojson";
import { fetchPubsInRelation } from "./overpass";


let pubs: FeatureCollection;

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


geocoderControl.on('result', async (event: any) => {
  hideAllContainers()
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
  pubs = await fetchPubsInRelation(event.result.properties.osm_id);
  displayPointsOnMap(pubs)
  showSpinButton();
});

map.addControl(geocoderControl, "top-right");
map.addControl(new CustomAttributionControl({ compact: true }), "bottom-right");
map.addControl(new FAQControl(), "bottom-right");
map.addControl(new ShareControl("https://whereroulette.com", "Spin the wheel!", "WhereRoulette helps you choose a place to meet! 🌍 Powered by OSM ❤️‍🔥"), "bottom-right");


document.getElementById("spin-button")?.addEventListener("click", async () => {
  if (pubs.features.length === 0) {
    console.log('No POIs to spin');
    return;
  }
  hideSpinButton();
  const selectedPOI = await spinTheWheel(pubs.features.length, pubs);
  console.log('Selected POI:', selectedPOI);

  // moveCircleOnTopLayer() // TODO: find another way of doing this, the reason for it is to ensure that the circle representing the selected POI is on top of the other circle, but this s. 
})

document.getElementById("info-close-button")?.addEventListener("click", async () => {
  hideAllContainers();
})


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
      ],
    },
  });
}

// function moveCircleOnTopLayer(feature: Feature, map: Map) { // remove a single feature from the source and add it back to the source to ensure it is on top of the other features.
//   const layerId = 'pois';
//   const source = map.getSource(layerId).updateData()
//   if (!source) {
//     console.error('Source not found:', layerId);
//     return;
//   }
//   source.setData(
//     {}
//   )
// }



function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function spinTheWheel(n: number, fc: FeatureCollection): Promise<Feature> {
  // This function starts with a random feature index between 1 and n. It then cycles through the features in the same way a roulette wheel does.
  // It initially spins fast, then it slows down exponentially untill it stops.
  // Every time it stops on a feature, it beeps.
  let delayTime = 20;
  let selected = Math.floor(Math.random() * n); // start from a different random feature each time
  let startTime = performance.now();
  let lastFrameTime = startTime;

  const animate = async (time: number) => {
    const elapsed = time - lastFrameTime;
    if (elapsed > delayTime) {
      map.setFeatureState({ source: 'pois', id: selected }, { selected: false });
      selected = (selected + 1) % n;
      map.setFeatureState({ source: 'pois', id: selected }, { selected: true });
      beep();
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


function beep() {
  var snd = new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");
  snd.play();
}
