
        // ✅ Mapbox Initialization
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [-73.94, 40.73], // Centered on Queens
  zoom: 11
});

// ✅ Airtable Setup
const AIRTABLE_API_KEY = 'patVU2XRVZ6uiJvA8.5076600888577f61b245c3510979a1383c551c656673b03f012b0391bfdc7fdc';
const BASE_ID = 'apppBx0a9hj0Z1ciw';
const TABLE_NAME = 'tblgqyoE5TZUzQDKw';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

// ✅ Global Variables
let allMarkers = [];
let orgMarkers = {};
let uniqueTags = new Set();
const colorMap = {};
const colorPalette = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000'
];

// ✅ Utility: Assign unique color to org or tag
function getColorFor(key) {
  if (!colorMap[key]) {
    const idx = Object.keys(colorMap).length % colorPalette.length;
    colorMap[key] = colorPalette[idx];
  }
  return colorMap[key];
}

// ✅ Utility: Create colored marker icon
function createColoredMarker(color) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 24" fill="${color}">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>
    </svg>
  `);
  return `data:image/svg+xml,${svg}`;
}

// ✅ Fetch and Process Airtable Data
async function fetchAirtableData() {
  try {
    const response = await fetch(`${AIRTABLE_URL}?view=Grid%20view`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`
      }
    });
    const json = await response.json();
    const records = json.records.map(rec => ({
      id: rec.id,
      ...rec.fields
    }));
    addMarkers(records);
  } catch (err) {
    console.error("Airtable Fetch Error:", err);
  }
}

// ✅ Geocode missing lat/lng via Mapbox
async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxgl.accessToken}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.features[0]?.center || null;
}

// ✅ Push new coordinates to Airtable
async function updateAirtableLatLng(recordId, lat, lng) {
  const url = `${AIRTABLE_URL}/${recordId}`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        Latitude: lat,
        Longitude: lng
      }
    })
  });
}

// ✅ Create and Add Markers
async function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];
  orgMarkers = {};
  uniqueTags.clear();

  for (const row of data) {
    let lat = parseFloat(row.Latitude);
    let lng = parseFloat(row.Longitude);

    // If lat/lng missing, try geocoding
    if (isNaN(lat) || isNaN(lng)) {
      if (row.Address) {
        const coords = await geocodeAddress(row.Address);
        if (coords) {
          lng = coords[0];
          lat = coords[1];
          await updateAirtableLatLng(row.id, lat, lng);
        } else {
          console.warn('Failed to geocode:', row.Address);
          continue;
        }
      } else {
        console.warn('No lat/lng or address:', row);
        continue;
      }
    }

    const org = row["Org Name"] || "Unnamed Org";
    const tags = (row["Tags"] || "").split(',').map(t => t.trim()).filter(Boolean);
    tags.forEach(tag => uniqueTags.add(tag));
    const tagColor = getColorFor(tags[0] || org);

    const popupHTML = `
      <div style="max-width: 300px;">
        <h3>${org}</h3>
        ${row.Image ? `<img src="${row.Image}" style="width:100%; margin-top:8px; border-radius:6px;" />` : ""}
        ${row.Address ? `<p><b>Address:</b><br>${row.Address}</p>` : ""}
        ${row.Email ? `<p><b>Email:</b><br><a href="mailto:${row.Email}">${row.Email}</a></p>` : ""}
        ${row.Phone ? `<p><b>Phone:</b><br>${row.Phone}</p>` : ""}
        ${tags.length ? `<p><b>Tags:</b> ${tags.join(', ')}</p>` : ""}
        ${row.Website ? `<p><b>Website:</b><br><a href="${row.Website}" target="_blank">${row.Website}</a></p>` : ""}
        ${row.Social ? `<p><b>Social:</b><br><a href="${row.Social}" target="_blank">${row.Social}</a></p>` : ""}
      </div>
    `;

    const markerEl = document.createElement('div');
    markerEl.style.backgroundImage = `url('${createColoredMarker(tagColor)}')`;
    markerEl.style.width = '30px';
    markerEl.style.height = '40px';
    markerEl.style.backgroundSize = 'contain';

    const marker = new mapboxgl.Marker(markerEl)
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
      .addTo(map);

    marker.rowData = row;
    allMarkers.push(marker);

    if (!orgMarkers[org]) orgMarkers[org] = [];
    orgMarkers[org].push(marker);
  }

  buildLegend();
  buildTagDropdown();
}

// ✅ Legend UI
function buildLegend() {
  const container = document.getElementById('legend');
  container.innerHTML = '';

  const tagMap = {}; // tag -> list of { org, marker }
  allMarkers.forEach(marker => {
    const org = marker.rowData["Org Name"] || "Unnamed Org";
    const tags = (marker.rowData["Tags"] || "").split(',').map(t => t.trim()).filter(Boolean);
    tags.forEach(tag => {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push({ org, marker });
    });
  });

  Object.entries(tagMap).forEach(([tag, entries]) => {
    const tagColor = getColorFor(tag);

    const tagSection = document.createElement('div');
    tagSection.style.marginBottom = '10px';

    // Tag-level checkbox
    const tagLabel = document.createElement('label');
    tagLabel.style.fontWeight = 'bold';
    tagLabel.style.display = 'flex';
    tagLabel.style.alignItems = 'center';

    const tagCheckbox = document.createElement('input');
    tagCheckbox.type = 'checkbox';
    tagCheckbox.checked = true;

    const swatch = document.createElement('span');
    swatch.style.backgroundColor = tagColor;
    swatch.style.width = '12px';
    swatch.style.height = '12px';
    swatch.style.borderRadius = '50%';
    swatch.style.margin = '0 6px';

    const tagName = document.createElement('span');
    tagName.textContent = tag;

    tagLabel.appendChild(tagCheckbox);
    tagLabel.appendChild(swatch);
    tagLabel.appendChild(tagName);
    tagSection.appendChild(tagLabel);

    // Org list under each tag
    const orgList = document.createElement('ul');
    orgList.style.margin = '6px 0 0 18px';
    orgList.style.padding = '0';

    entries.forEach(({ org, marker }) => {
      const orgItem = document.createElement('li');
      orgItem.textContent = org;
      orgItem.style.fontSize = '13px';
      orgItem.style.cursor = 'pointer';
      orgItem.addEventListener('click', () => {
        map.flyTo({ center: marker.getLngLat(), zoom: 14 });
        marker.togglePopup();
      });
      orgList.appendChild(orgItem);
    });

    // Tag checkbox toggles all markers in the tag group
    tagCheckbox.addEventListener('change', () => {
      const visible = tagCheckbox.checked;
      entries.forEach(({ marker }) => {
        marker.getElement().style.display = visible ? 'block' : 'none';
      });
    });

    tagSection.appendChild(orgList);
    container.appendChild(tagSection);
  });
}


// ✅ Legend Toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('legend-toggle');
  const legend = document.getElementById('legend-wrapper');
  if (toggle && legend) {
    toggle.addEventListener('click', () => {
      legend.classList.toggle('hidden');
      toggle.textContent = legend.classList.contains('hidden') ? 'Show Legend' : 'Hide Legend';
    });
  }
});

// ✅ Init
map.on('load', fetchAirtableData);
