// ✅ Step 1: Initialize the Mapbox map
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9sZW5waHlhIiwiYSI6ImNtOGk3bXB1MzBhM2Qyc292ZjZrZ2tjMHMifQ.ZItrPCguE2g3w99InSdzLQ';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/nolenphya/cm8hobpgo00u101s5d3ebdjdz',
  center: [-74.006, 40.7128],
  zoom: 10
});

// Add the geocoder (autocomplete search box) to the map
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  placeholder: 'Search for an address',
  marker: { color: 'red' },
  proximity: {
    longitude: -74.006,
    latitude: 40.7128
  },
  countries: 'us',
  limit: 5
});
map.addControl(geocoder);

// Optionally, listen for the result event
geocoder.on('result', function(e) {
  console.log('Selected location:', e.result);
});

// ✅ Step 2: Fetch and parse CSV using Papa Parse (unchanged)
function fetchData() {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT9tYTUHZn_xeNv_blqO8x8RngTQ1Fg14tBbhhqPvJ-BfGPyE0O54jngg-pUjuTNzhpYR6WySwdM_cu/pub?gid=1517657781&single=true&output=csv';
  fetch(sheetURL)
    .then(response => response.text())
    .then(csvData => {
      Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          console.log("Parsed Data:", results.data);
          addMarkers(results.data);
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
        }
      });
    })
    .catch(error => console.error("Failed to fetch CSV:", error));
}

// Pick some predefined colors
const artistColors = {};
const availableColors = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000'
];

function getColorForArtist(artist) {
  if (!artistColors[artist]) {
    // Rotate through colors (fallback if we run out)
    const color = availableColors[Object.keys(artistColors).length % availableColors.length];
    artistColors[artist] = color;
  }
  return artistColors[artist];
}


// ✅ Step 3: Add markers to the map

let allMarkers = []; // Declare this at the global level

const artistGroups = {}; // Artist name → list of markers

function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];

  data.forEach(row => {
    const lat = parseFloat(row.Latitude);
const lng = parseFloat(row.Longitude);
if (isNaN(lat) || isNaN(lng)) {
  console.warn('Skipping row with bad coordinates:', row);
  return;
}

  
    const artist = row.Name || 'Anonymous';
    const markerColor = getColorForArtist(artist); // ✅ define color here
  
    const marker = new mapboxgl.Marker({ color: markerColor })
    .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="max-width: 300px;">
          <img src="${row.PhotoURL}" 
               alt="User Photo" 
               style="width:100%; max-height:250px; object-fit:cover; border-radius:8px;" />
          <h3>${row.Name || 'Anonymous'}</h3>
          <p><b>Age:</b> ${row.Age || 'N/A'}</p>
          <p><b>Social Media:</b> ${row.Social || 'N/A'}</p>
          <p><b>Photography Experience:</b> ${row.Experience || 'N/A'}</p>
          <p><b>Description:</b> ${row.Description || 'N/A'}</p>
        </div>
      `))
      .addTo(map);
  
    marker.rowData = row;
    allMarkers.push(marker);
  
    if (!artistGroups[artist]) {
      artistGroups[artist] = [];
    }
  
    artistGroups[artist].push(marker);
  });
  

  buildLegend();
}

// Add Legend

function buildLegend() {
  const legendContainer = document.getElementById('legend');
  legendContainer.innerHTML = ''; // Clear existing

  Object.keys(artistGroups).forEach(artist => {
    const color = getColorForArtist(artist);

    const item = document.createElement('label');
    item.className = 'legend-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.marginBottom = '5px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    checkbox.onchange = () => {
      const visible = checkbox.checked;

      artistGroups[artist].forEach(marker => {
        marker.getElement().style.display = visible ? 'block' : 'none';
      });
    };

    const swatch = document.createElement('span');
    swatch.style.backgroundColor = color;
    swatch.style.width = '16px';
    swatch.style.height = '16px';
    swatch.style.borderRadius = '50%';
    swatch.style.display = 'inline-block';

    const nameText = document.createElement('span');
    nameText.textContent = artist;

    item.appendChild(checkbox);
    item.appendChild(swatch);
    item.appendChild(nameText);

    legendContainer.appendChild(item);
  });
}



// ✅ Step 4: Start fetching data
map.on('load', fetchData);
