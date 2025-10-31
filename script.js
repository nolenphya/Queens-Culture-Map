// Mapbox Setup

mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWRmZHFxb2EwY2p3MmlxM3JoMmJwNDVrIn0.KDnT79yQuUeYVaqcKlmQGQ';
const map = new mapboxgl.Map({
  container: 'map',
 style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.94, 40.73],
  zoom: 11
});


// Airtable Setup
const AIRTABLE_API_KEY = 'patboskAQTJUi9FlQ.1c30c3c632cd4d7bd03cf949e50edd922425aba8dcbf0c8a6002e98db67c74a3';
const BASE_ID = 'apppBx0a9hj0Z1ciw';
const TABLE_NAME = 'tblgqyoE5TZUzQDKw';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

// Icon mapping for tags
const iconMap = {
  'Community Garden': 'community-garden',
  'Gallery': 'gallery',
  'Museum/Cultural Institution': 'museum',
  'Music Group/Vocal Ensembles': 'music-group-vocal-ensemble',
  'Dance Company': 'dance-studio',
  'Multidisciplinary Arts Center': 'multidisciplinary-arts-center',
  'Community Center': 'community-center',
  'Theatre': 'theatre',
  'Video-Film Company': 'video-film-company',
  'Art Center-Studio': 'art-center-studio',
  'Cultural Arts Center': 'cultural-arts-center',
  'Historical Society-Preservation Group': 'archive'
};

// Globals
let allMarkers = [];
const colorMap = {};
const colorPalette = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8',
  '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff'
];

function getColorFor(tag) {
  if (!colorMap[tag]) {
    const index = Object.keys(colorMap).length % colorPalette.length;
    colorMap[tag] = colorPalette[index];
  }
  return colorMap[tag];
}

// Fetch data
// =======================
// Data Fetching (with Pagination)
// =======================
async function fetchData() {
  const filterFormula = encodeURIComponent("{Approved}=TRUE()");
  const viewName = encodeURIComponent("main");
  let allRecords = [];
  let offset = null;

  try {
    do {
      const fetchUrl = `${AIRTABLE_URL}?view=${viewName}&filterByFormula=${filterFormula}${
        offset ? `&offset=${offset}` : ""
      }`;

      const res = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Airtable Error (${res.status}):`, errorText);
        return allRecords;
      }

      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null; // Airtable gives a new offset if more pages exist
    } while (offset);

    return allRecords;

  } catch (err) {
    console.error("Fetch failed:", err);
    return allRecords;
  }
}

// Geocode missing
async function geocodeAndSaveMissingCoords(record) {
  if (!record.Address) return null;

  const query = encodeURIComponent(record.Address);
  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}`;

  try {
    const res = await fetch(geocodeUrl);
    const json = await res.json();
    if (!json.features.length) return null;

    const [lng, lat] = json.features[0].center;

    await fetch(`${AIRTABLE_URL}/${record.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: { Latitude: lat, Longitude: lng } })
    });

    record.Latitude = lat;
    record.Longitude = lng;
    return record;
  } catch (error) {
    console.error('Geocoding failed:', record.Address, error);
    return null;
  }
}

// Create markers + build legend + build searchable directory
function createMarkers(data) {
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const tagGroups = {};
  const groupedOptions = {};

  data.forEach((row, index) => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const tags = (row.Tags || "").split(',').map(t => t.trim()).filter(Boolean);
    const primaryTag = tags[0] || 'Uncategorized';
    const iconKey = iconMap[primaryTag] || 'default';

    const el = document.createElement('div');
    el.style.backgroundImage = `url(icons/${iconKey}.png)`;
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';

     // ✅ Add label here, where `row` is defined
  const label = document.createElement('div');
  label.className = 'marker-label';
  label.innerText = row["Org Name"] || "Unnamed";
  label.style.position = 'absolute';
  label.style.top = '36px';
  label.style.left = '50%';
  label.style.transform = 'translateX(-50%)';
  label.style.whiteSpace = 'nowrap';
  label.style.backgroundColor = 'rgba(255,255,255,0.8)';
  label.style.padding = '2px 6px';
  label.style.borderRadius = '4px';
  label.style.fontSize = '12px';
  label.style.display = 'none';

  el.appendChild(label);

    const imageUrl = Array.isArray(row.Image) && row.Image.length > 0 ? row.Image[0].url : '';

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="max-width: 250px;">
        ${imageUrl ? `<img src="${imageUrl}" alt="${row["Org Name"]}" style="width: 100%; margin-bottom: 10px;">` : ''}
        <h3>${row["Org Name"] || "Untitled"}</h3>
        ${row.Description ? `<p>${row.Description}</p>` : ''}
        ${row.Address ? `<p><b>Address:</b><br>${row.Address}</p>` : ''}
        ${row.Email ? `<p><b>Email:</b> <a href="mailto:${row.Email}">${row.Email}</a></p>` : ''}
        ${row.Website ? `<p><a href="${row.Website}" target="_blank">Website</a></p>` : ''}
        ${row.Social ? `<p><a href="${row.Social}" target="_blank">Social</a></p>` : ''}
      </div>
    `);

    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map);

    marker.labelElement = label; // ✅ Store for zoom visibility toggling
    marker.rowData = row;
    allMarkers.push(marker);

    // Group by tag
    tags.forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(marker);
    });

    // Grouped select dropdown
    if (!groupedOptions[primaryTag]) groupedOptions[primaryTag] = [];
    groupedOptions[primaryTag].push({ label: row["Org Name"] || "Unnamed", index });
  });

  buildLegend(tagGroups);
}

map.on('zoom', () => {
  const zoomLevel = map.getZoom();
  allMarkers.forEach(marker => {
    if (marker.labelElement) {
      marker.labelElement.style.display = zoomLevel >= 14 ? 'block' : 'none';
    }
  });
});


document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = ''; // Clear old results

    if (!query) return;

    const matches = allMarkers.filter(marker => {
      const name = (marker.rowData["Org Name"] || "").toLowerCase();
      const tags = (marker.rowData.Tags || "").toLowerCase();
      return name.includes(query) || tags.includes(query);
    });

    if (matches.length === 0) {
      resultsContainer.innerHTML = '<p>No matches found.</p>';
      return;
    }

    // Optional: Zoom to first match
    const first = matches[0];
    map.flyTo({ center: first.getLngLat(), zoom: 14, essential: true });
    first.togglePopup();

    // Show results
    const list = document.createElement('ul');
    list.style.padding = '0';
    list.style.listStyle = 'none';

    matches.forEach(marker => {
      const li = document.createElement('li');
      li.style.marginBottom = '6px';

      const link = document.createElement('a');
      link.href = '#';
      link.textContent = marker.rowData["Org Name"] || "Unnamed";
      link.style.textDecoration = 'underline';
      link.style.color = '#007bff';
      link.addEventListener('click', (ev) => {
        ev.preventDefault();
        map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
        marker.togglePopup();
      });

      li.appendChild(link);
      list.appendChild(li);
    });

    resultsContainer.appendChild(list);
  }
});

document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.trim().toLowerCase();
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = ''; // Clear previous results

  if (!query) return;

  const matches = allMarkers.filter(marker => {
    const name = (marker.rowData["Org Name"] || "").toLowerCase();
    const tags = (marker.rowData.Tags || "").toLowerCase();
    return name.includes(query) || tags.includes(query);
  });

  if (matches.length === 0) {
    resultsContainer.innerHTML = '<p>No matches found.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.style.padding = '0';
  list.style.listStyle = 'none';

  matches.forEach(marker => {
    const li = document.createElement('li');
    li.style.marginBottom = '6px';

    const link = document.createElement('a');
    link.href = '#';
    link.textContent = marker.rowData["Org Name"] || "Unnamed";
    link.style.textDecoration = 'underline';
    link.style.color = '#007bff';

    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
      marker.togglePopup();
    });

    li.appendChild(link);
    list.appendChild(li);
  });

  resultsContainer.appendChild(list);
});



document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim().toLowerCase();
    if (!query) return;

    const match = allMarkers.find(marker => {
      const name = (marker.rowData["Org Name"] || "").toLowerCase();
      const tags = (marker.rowData.Tags || "").toLowerCase();
      return name.includes(query) || tags.includes(query);
    });

    if (match) {
      map.flyTo({ center: match.getLngLat(), zoom: 15, essential: true });
      match.togglePopup(); // ensure popup is toggled open
    } else {
      alert("No matching organization or tag found.");
    }
  }
});


function buildLegend(tagGroups) {
  const container = document.getElementById('legend-content');
  container.innerHTML = '';

  Object.entries(tagGroups)
    .sort(([a], [b]) => a.localeCompare(b)) // Alphabetize tags
    .forEach(([tag, markers]) => {
      const iconKey = iconMap[tag] || 'default';

      const section = document.createElement('div');
      section.className = 'legend-category';

      const header = document.createElement('h4');
      header.innerHTML = `<span class="arrow">▾</span> ${tag}`;
      header.style.cursor = 'pointer';

      // Create org list and expand it by default
      const list = document.createElement('ul');
      list.className = 'legend-org-list';
      list.style.display = 'block'; // Initially expanded

// Sort markers alphabetically by organization name
markers.sort((a, b) => {
  const nameA = (a.rowData["Org Name"] || "").toLowerCase();
  const nameB = (b.rowData["Org Name"] || "").toLowerCase();
  return nameA.localeCompare(nameB);
});

      // Create each marker entry under this tag
      markers.forEach(marker => {
        const li = document.createElement('li');

        const icon = document.createElement('img');
        icon.src = `icons/${iconKey}.png`;
        icon.alt = `${tag} icon`;
        icon.style.width = '20px';
        icon.style.height = '20px';
        icon.style.marginRight = '6px';
        icon.style.verticalAlign = 'middle';

        const label = document.createElement('span');
        label.textContent = marker.rowData["Org Name"] || "Unnamed";
        label.style.cursor = 'pointer';
        label.style.textDecoration = 'underline';

        label.addEventListener('click', () => {
          map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
          marker.togglePopup();
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.addEventListener('change', () => {
          marker.getElement().style.display = checkbox.checked ? 'block' : 'none';
        });

        li.appendChild(checkbox);
        li.appendChild(icon);
        li.appendChild(label);
        list.appendChild(li);
      });

      // Toggle visibility and marker display
      header.addEventListener('click', () => {
        const collapsed = list.style.display === 'none';
        list.style.display = collapsed ? 'block' : 'none';
        header.querySelector('.arrow').textContent = collapsed ? '▾' : '▸';

        // Show/hide all markers in this tag group
        markers.forEach(marker => {
          marker.getElement().style.display = collapsed ? 'block' : 'none';
        });
      });

      section.appendChild(header);
      section.appendChild(list);
      container.appendChild(section);
    });
}

document.getElementById('reset-legend').addEventListener('click', () => {
  // Check all checkboxes
  document.querySelectorAll('.legend-org-list input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = true;
  });

  // Show all markers
  allMarkers.forEach(marker => {
    marker.getElement().style.display = 'block';
  });
});


// Map load


map.on('load', () => {
  // =======================
  // Load Custom Icons if Any
  // =======================
  Object.values(iconMap).forEach(iconName => {
    map.loadImage(`icons/${iconName}.png`, (error, image) => {
      if (error) {
        console.warn(`Could not load icon "${iconName}":`, error);
      } else if (!map.hasImage(iconName)) {
        map.addImage(iconName, image);
      }
    });
  });

  // =======================
  // Fetch and Add Markers
  // =======================
  fetchData().then(records => {
    const data = records.map(r => ({
      id: r.id,
      ...r.fields
    }));
    createMarkers(data);
  });

  // =======================
  // Subway Lines Source + Layer
  // =======================
  map.addSource('subway-lines', {
    type: 'geojson',
    data: 'nyc-subway-routes.geojson'
  });

  map.addLayer({
    id: 'subway-lines-layer',
    type: 'line',
    source: 'subway-lines',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-width': 2,
      'line-color': [
        'match',
        ['get', 'rt_symbol'],
        '1', '#EE352E', '2', '#EE352E', '3', '#EE352E',
        '4', '#00933C', '5', '#00933C', '6', '#00933C',
        'A', '#2850AD', 'C', '#2850AD', 'E', '#2850AD',
        'B', '#FF6319', 'D', '#FF6319', 'F', '#FF6319', 'M', '#FF6319',
        'N', '#FCCC0A', 'Q', '#FCCC0A', 'R', '#FCCC0A', 'W', '#FCCC0A',
        'L', '#A7A9AC', 'G', '#6CBE45', 'J', '#996633', 'Z', '#996633',
        '7', '#B933AD',
        '#000000'
      ]
    }
  });

  // =======================
  // Subway Stops Source + Layers
  // =======================
  map.addSource('subway-stops', {
    type: 'geojson',
    data: 'nyc-subway-stops.geojson'
  });

  // Stop Circles
  map.addLayer({
    id: 'subway-stations-stops',
    type: 'circle',
    source: 'subway-stops',
    paint: {
      'circle-radius': 1,
      'circle-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#000000'
    }
  });

  // Station Labels (Initially Hidden)
  map.addLayer({
    id: 'subway-station-labels',
    type: 'symbol',
    source: 'subway-stops',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'visibility': 'none'
    },
    paint: {
      'text-color': '#000000',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  });
});

// =======================
// Zoom-based Label Visibility
// =======================
map.on('zoom', () => {
  const zoomLevel = map.getZoom();
  map.setLayoutProperty(
    'subway-station-labels',
    'visibility',
    zoomLevel >= 14 ? 'visible' : 'none'
  );

  // Show marker labels at same zoom level
  allMarkers.forEach(marker => {
    if (marker.labelElement) {
      marker.labelElement.style.display = zoomLevel >= 14 ? 'block' : 'none';
    }
  });
});



// UI toggle logic
map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

// Hide by default
document.getElementById('map-guide-overlay').style.display = 'none';

// When intro is closed, show the info box
document.getElementById('close-intro').addEventListener('click', () => {
  document.getElementById('intro-overlay').style.display = 'none';
  document.getElementById('map-guide-overlay').style.display = 'flex';
});


const intro = document.getElementById('intro-overlay');
intro.addEventListener('touchmove', (e) => {
  if (intro.scrollTop > 100) {
    intro.style.display = 'none';
  }
});



document.addEventListener('DOMContentLoaded', () => {
  const legendPanel = document.getElementById('legend-panel');
const legendToggle = document.getElementById('legend-toggle');

legendToggle.addEventListener('click', () => {
  legendPanel.classList.toggle('collapsed');
  legendToggle.textContent = legendPanel.classList.contains('collapsed') ? 'Show' : 'Hide';
});
})

document.addEventListener('DOMContentLoaded', () => {
  const mapGuideOverlay = document.getElementById('map-guide-overlay');
  const mapGuideClose = document.getElementById('map-guide-close');
  const infoButton = document.getElementById('info-button');

  // Open
  if (infoButton) {
    infoButton.addEventListener('click', () => {
      mapGuideOverlay.style.display = 'flex';
    });
  }

  // Close
  if (mapGuideClose) {
    mapGuideClose.addEventListener('click', () => {
      mapGuideOverlay.style.display = 'none';
    });
  }
});


const legendPanel = document.getElementById('legend-panel');
const legendHeader = legendPanel.querySelector('.legend-header');

legendHeader.addEventListener('click', () => {
  legendPanel.classList.toggle('expanded');
});

document.addEventListener('click', (e) => {
  const legendPanel = document.getElementById('legend-panel');
  if (legendPanel.classList.contains('expanded') && !legendPanel.contains(e.target)) {
    legendPanel.classList.remove('expanded');
  }
});