# WhereRoulette 💻🎰🌍

**[https://whereroulette.com](https://whereroulette.com)**

<!-- ![Screenshot](app/src/assets/screenshot.png) -->

WhereRoulette is a web application designed to randomly select a [point of interest](https://wiki.openstreetmap.org/wiki/Points_of_interest) (POI) within a specified area. This tool solves the problem of choosing a place to go when you need somewhere to meet with friends, but the specific location isn't that important.

## Features

- Choose a [POI](https://wiki.openstreetmap.org/wiki/Points_of_interest) randomly in a region specified by:
  - District name
  - Central point and a radius
  - Bounding box
  - The equidistance between your and your friends' locations
- Encode your location into a URL to quickly share with friends and find "somewhere in the middle."
- Quickly filter POIs for bars, restaurants, or cafes.
- Subcategory filters for when you're more picky about where you want to go.
- Access information about each POI through map interactions.
- Share the selected location via a URL with encoded data.
- **SPIN THE WHEEL** animation + sound effects 🎰

## Powered By Open Data

The application heavily relies on open data from [OpenStreetMap](https://www.openstreetmap.org/about).

## External Libraries and Resources

WhereRoulette uses several external libraries and resources:

- **[Nominatim](https://nominatim.openstreetmap.org/ui/about.html)** for geocoding
- **[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)** for serving OpenStreetMap data
- **[maplibregl](https://maplibre.org/)** for rendering interactive maps
- **[osmtogeojson](https://github.com/tyrasd/osmtogeojson)** for converting OpenStreetMap data to GeoJSON
- **[FontAwesome](https://fontawesome.com/)** for icons
- **[Webpack](https://webpack.js.org/)** for bundling assets
- **[Umami](https://umami.is/)** for privacy-focused analytics
- **[Postgres](https://www.postgresql.org/)** for storing analytics data

## Development

### Project Structure

The project is structured as follows:

- `app/`: Webapp.
- `.github/`: CI config.
- `.env`: Variables to be set as secrets.

### Frontend

To serve the webapp frontend locally, navigate to the `app/` directory, install the requirements, and run a development server:

```bash
cd app/
npm install
npm run serve
```

The site should now be served on [`http://localhost:8080/`](http://localhost:8080/).

To bundle the frontend, change into the `app/` directory and run the build command:

```bash
cd app/
npm install
npm run build
```

## Deployment

### Frontend - GitHub Pages

The site is hosted using [GitHub Pages](https://pages.github.com/). A GitHub action bundles the site and deploys all content in the `app/dist` subdirectory for the `main` branch.

The site gets deployed to [https://whereroulette.com](https://whereroulette.com).


## Analytics

The site uses [Umami](https://umami.is/) for privacy-focused analytics. This requires the script `src/assets/analytics.js` to be included in the distributed bundle.

To update the script, run the following command:

```bash
curl https://umani.fly.dev/script.js -o src/assets/analytics.js
```
