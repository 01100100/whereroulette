import type { Context } from 'https://edge.netlify.com';

// Define categories
enum Category {
  Drinks = "drinks",
  Cafe = "cafe",
  Food = "food",
  Park = "park",
  Climb = "climb",
}

// Define category details
const categories = {
  [Category.Drinks]: { tag: 'amenity~"^(pub|bar|biergarten)$"', emoji: "🍺" },
  [Category.Cafe]: { tag: 'amenity~"^(cafe)$"', emoji: "☕" },
  [Category.Food]: { tag: 'amenity~"^(restaurant|fast_food|food_court|ice_cream)$"', emoji: "🍴" },
  [Category.Park]: { tag: 'leisure~"^(park|garden)$"', emoji: "🌳" },
  [Category.Climb]: { tag: 'sport~"^(climbing|bouldering)$"', emoji: "🧗" },
};

// Define response type
type ApiResponse = {
  osm_node: string;
  name: string;
  type: string;
  emoji: string;
  opening_hours?: string;
  url: string;
  geojson?: any; // Add GeoJSON to response type
  error?: string;
};

// Helper function to fetch data from Overpass API
async function fetchOverpassData(overpassQuery: string) {
  const response = await fetch("https://www.overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: overpassQuery,
  });
  
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Overpass API error: ${response.statusText}`);
  }
}

// Function to generate query for POIs in a relation
function poisInRelationQuery(relationID: number, category: Category): string {
  return `[out:json];node(area:${relationID + 3600000000})[${categories[category].tag}];out geom;`;
}

// Function to generate query for a specific node
function specificNodeQuery(nodeId: string): string {
  return `[out:json];node(${nodeId});out geom;`;
}

// Simplified implementation of osmtogeojson for node elements only
function simplifiedOsmToGeoJson(osmData: any) {
  const features = [];
  
  // Process nodes from OSM data
  if (osmData.elements) {
    for (const element of osmData.elements) {
      if (element.type === 'node') {
        const properties: any = {};
        
        // Copy all tags to properties
        if (element.tags) {
          Object.assign(properties, element.tags);
        }
        
        // Add ID to properties
        properties.id = `node/${element.id}`;
        
        // Create feature
        features.push({
          type: 'Feature',
          id: `node/${element.id}`,
          properties: properties,
          geometry: {
            type: 'Point',
            coordinates: [element.lon, element.lat]
          }
        });
      }
    }
  }
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

// Function to fetch POIs in a relation
async function fetchPoisInRelation(relationID: string, category: Category) {
  const query = poisInRelationQuery(parseInt(relationID), category);
  const osmData = await fetchOverpassData(query);
  return simplifiedOsmToGeoJson(osmData);
}

// Function to fetch a specific node by ID
async function fetchSpecificNode(nodeId: string) {
  // Extract the numeric ID if it's in the format "node/123456"
  const numericId = nodeId.includes('/') ? nodeId.split('/')[1] : nodeId;
  const query = specificNodeQuery(numericId);
  const osmData = await fetchOverpassData(query);
  return simplifiedOsmToGeoJson(osmData);
}

export default async (request: Request, context: Context) => {
  console.log("Edge function called with URL:", request.url);
  
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers,
    });
  }

  try {
    // Parse query parameters from URL
    const url = new URL(request.url);
    const regionId = url.searchParams.get('region');
    const categoryName = url.searchParams.get('type') || 'drinks'; // Default to drinks
    const specificId = url.searchParams.get('id');

    // Validate parameters
    if (!regionId) {
      return new Response(JSON.stringify({ 
        error: "Missing required parameter: region" 
      }), { 
        status: 400, 
        headers 
      });
    }

    // Validate category
    if (!Object.values(Category).includes(categoryName as Category)) {
      return new Response(JSON.stringify({ 
        error: `Invalid type. Must be one of: ${Object.values(Category).join(", ")}` 
      }), { 
        status: 400, 
        headers 
      });
    }

    const category = categoryName as Category;
    
    let selectedFeature;
    let properties;
    let geoData;
    
    // If specific ID is provided, fetch that specific node
    if (specificId) {
      // Check if it's a full OSM ID (e.g., "node/123456") or just a numeric ID
      geoData = await fetchSpecificNode(specificId);
      
      if (geoData.features && geoData.features.length > 0) {
        selectedFeature = geoData.features[0];
        properties = selectedFeature.properties || {};
      } else {
        return new Response(JSON.stringify({ 
          error: `Node with ID ${specificId} not found` 
        }), { 
          status: 404, 
          headers 
        });
      }
    } else {
      // Otherwise, fetch POIs for the region and category and select randomly
      geoData = await fetchPoisInRelation(regionId, category);

      // Check if any POIs were found
      if (!geoData.features || geoData.features.length === 0) {
        return new Response(JSON.stringify({ 
          error: `No ${category} found in region ${regionId}` 
        }), { 
          status: 404, 
          headers 
        });
      }

      // Randomly select a POI
      const randomIndex = Math.floor(Math.random() * geoData.features.length);
      selectedFeature = geoData.features[randomIndex];
      properties = selectedFeature.properties || {};
    }

    // Get the OSM ID
    const osmId = properties.id || "";
    const idParts = osmId.split("/");
    const osmNodeType = idParts[0] || "node";
    const osmNodeId = idParts[1] || "";

    // Create response
    const response: ApiResponse = {
      osm_node: osmNodeId,
      name: properties.name || "Unnamed location",
      type: category,
      emoji: categories[category].emoji,
      opening_hours: properties.opening_hours,
      url: `https://whereroulette.com/?region=${regionId}&type=${category}&id=${encodeURIComponent(osmId)}`,
      geojson: selectedFeature // Include the GeoJSON feature
    };
    return new Response(JSON.stringify(response), { headers });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error" 
    }), { 
      status: 500, 
      headers 
    });
  }
}