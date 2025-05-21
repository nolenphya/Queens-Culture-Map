
// ✅ Mapbox Initialization
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
  center: [-73.94, 40.73], // Queens, NY
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

// ✅ Color Utilities
function getColorFor(key) {
  if (!colorMap[key]) {
    const idx = Object.keys(colorMap).length % colorPalette.length;
    colorMap[key] = colorPalette[idx];
  }
  return colorMap[key];
}

function createColoredMarkerSVG(color) {
  return encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="0 0 24 24" fill="${color}">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>
    </svg>
  `);
}

// ✅ Fetch and Process Airtable Data
async function fetchAirtableData() {
  try {
    const response = await fetch(`${AIRTABLE_URL}?view=Grid%20view`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const json = await response.json();
    const records = json.records.map(rec => ({ id: rec.id, ...rec.fields }));
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
    body: JSON.stringify({ fields: { Latitude: lat, Longitude: lng } })
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

    if (isNaN(lat) || isNaN(lng)) {
      if (row.Address) {
        const coords = await geocodeAddress(row.Address);
        if (coords) {
          lng = coords[0];
          lat = coords[1];
          await updateAirtableLatLng(row.id, lat, lng);
        } else {
          console.warn('Geocoding failed:', row.Address);
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
    markerEl.style.backgroundImage = `url('data:image/svg+xml,${createColoredMarkerSVG(tagColor)}')`;
    markerEl.style.width = '30px';
    markerEl.style.height = '40px';
    markerEl.style.backgroundSize = 'contain';

    const marker = new mapboxgl.Marker(markerEl)
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
      .addTo(map);

    marker.rowData = row;
    allMarkers.push(marker);

    tags.forEach(tag => {
      if (!orgMarkers[tag]) orgMarkers[tag] = [];
      orgMarkers[tag].push(marker);
    });
  }

  buildLegend();
}

// ✅ Build Collapsible Legend with Colored Pins
function buildLegend() {
  const container = document.getElementById('legend');
  container.innerHTML = '';

  Object.entries(orgMarkers).forEach(([tag, markers]) => {
    const color = getColorFor(tag);

    const section = document.createElement('div');
    section.style.marginBottom = '10px';

    // Header with colored pin
    const header = document.createElement('div');
    header.className = 'tag-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.cursor = 'pointer';

    const icon = document.createElement('img');
    icon.src = `data:image/svg+xml,${createColoredMarkerSVG(color)}`;
    icon.style.width = '18px';
    icon.style.marginRight = '6px';

    const label = document.createElement('span');
    label.textContent = tag;
    label.style.flexGrow = '1';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.style.marginLeft = '6px';

    // Toggle visibility
    checkbox.addEventListener('change', () => {
      const visible = checkbox.checked;
      markers.forEach(marker => {
        marker.getElement().style.display = visible ? 'block' : 'none';
      });
    });

    // Collapsible
    const list = document.createElement('ul');
    list.className = 'tag-org-list';
    list.style.marginLeft = '20px';
    markers.forEach(marker => {
      const org = marker.rowData["Org Name"] || "Unnamed";
      const li = document.createElement('li');
      li.textContent = org;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        map.flyTo({ center: marker.getLngLat(), zoom: 14 });
        marker.togglePopup();
      });
      list.appendChild(li);
    });

    let collapsed = false;
    header.addEventListener('click', () => {
      collapsed = !collapsed;
      list.style.display = collapsed ? 'none' : 'block';
    });

    header.appendChild(icon);
    header.appendChild(label);
    header.appendChild(checkbox);
    section.appendChild(header);
    section.appendChild(list);
    container.appendChild(section);
  });
}

// ✅ Legend Toggle Button
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('legend-toggle');
  const legendWrapper = document.getElementById('legend-wrapper');

  toggleButton.addEventListener('click', () => {
    legendWrapper.classList.toggle('collapsed');
    toggleButton.textContent = legendWrapper.classList.contains('collapsed') ? '❯' : '❮';
  });
});


// ✅ Load Map
map.on('load', fetchAirtableData);
