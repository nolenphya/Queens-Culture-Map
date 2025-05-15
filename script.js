

// ✅ Mapbox Initialization
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
  center: [-74.006, 40.7128],
  zoom: 10
});

// ✅ Geocoder (Search box on map)
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl,
  placeholder: 'Search for an address',
  marker: { color: 'red' },
  proximity: { longitude: -74.006, latitude: 40.7128 },
  countries: 'us',
  limit: 5
});
map.addControl(geocoder);

// ✅ Data structures
let allMarkers = [];
let orgMarkers = {};
let uniqueTags = new Set();

// ✅ Airtable config
const AIRTABLE_API_KEY = 'patqKWGk60o2xQOhu.1dcd58a48040947ce3815a169a8bf856385f1d1df2c78924baf37b228a6a3591';
const BASE_ID = 'appQQN2nFdbttM2uY';
const TABLE_NAME = 'tblgqyoE5TZUzQDKw';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?view=Grid%20view`;

// ✅ Fetch from Airtable
async function fetchAirtableData() {
  try {
    const response = await fetch(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`
      }
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const data = await response.json();
    const records = data.records.map(record => ({
      id: record.id,
      ...record.fields
    }));
    addMarkers(records);
  } catch (err) {
    console.error('Error fetching Airtable data:', err);
  }
}

// ✅ Add markers to the map
async function addMarkers(data) {
  allMarkers.forEach(m => m.remove());
  allMarkers = [];
  orgMarkers = {};
  uniqueTags.clear();

  for (const row of data) {
    let lat = parseFloat(row.Latitude);
    let lng = parseFloat(row.Longitude);

    if (isNaN(lat) || isNaN(lng)) {
      if (row.Address) {
        const result = await geocodeAddress(row.Address);
        if (result) {
          lng = result[0];
          lat = result[1];
        } else {
          console.warn(`❌ Could not geocode: ${row.Address}`);
          continue;
        }
      } else {
        console.warn(`⚠️ Skipping record — no lat/lng or address:`, row["Org Name"] || 'Unnamed');
        continue;
      }
    }

    const org = row["Org Name"] || "Unnamed";
    const tags = (row["Tags"] || "").split(',').map(t => t.trim()).filter(Boolean);
    tags.forEach(tag => uniqueTags.add(tag));

    const popupHTML = `
      <div style="max-width: 300px;">
        <h3>${org}</h3>
        ${row["Address"] ? `<p><strong>Address:</strong><br>${row["Address"]}</p>` : ""}
        ${row["Email"] ? `<p><strong>Email:</strong><br><a href="mailto:${row["Email"]}">${row["Email"]}</a></p>` : ""}
        ${row["Phone"] ? `<p><strong>Phone:</strong><br>${row["Phone"]}</p>` : ""}
        ${tags.length ? `<p><strong>Tags:</strong><br>${tags.join(', ')}</p>` : ""}
        ${row["Website"] ? `<p><strong>Website:</strong><br><a href="${row["Website"]}" target="_blank">${row["Website"]}</a></p>` : ""}
        ${row["Social"] ? `<p><strong>Social:</strong><br>${row["Social"]}</p>` : ""}
        ${row["Image"] ? `<img src="${row["Image"]}" style="width:100%; margin-top:10px; border-radius:6px;" />` : ""}
      </div>
    `;

    const marker = new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
      .addTo(map);

    marker.rowData = row;
    allMarkers.push(marker);

    if (!orgMarkers[org]) orgMarkers[org] = [];
    orgMarkers[org].push(marker);
  }

  buildLegendByOrg();
  buildTagDropdown();
}

// ✅ Geocode address using Mapbox
async function geocodeAddress(address) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.features[0]?.center || null;
  } catch (err) {
    console.error('Geocode error:', err);
    return null;
  }
}

// ✅ Build legend
function buildLegendByOrg() {
  const legend = document.getElementById('legend');
  legend.innerHTML = '';

  Object.keys(orgMarkers).forEach(org => {
    const label = document.createElement('label');
    label.style.display = 'block';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    checkbox.addEventListener('change', () => {
      const visible = checkbox.checked;
      orgMarkers[org].forEach(marker => {
        marker.getElement().style.display = visible ? 'block' : 'none';
      });
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${org}`));
    legend.appendChild(label);
  });
}

// ✅ Tag filter
function buildTagDropdown() {
  const dropdown = document.getElementById('tag-filter');
  dropdown.innerHTML = `<option value="">-- All Tags --</option>`;

  Array.from(uniqueTags).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener('change', () => {
    const selected = dropdown.value.toLowerCase();
    allMarkers.forEach(marker => {
      const tags = (marker.rowData.Tags || "").toLowerCase();
      marker.getElement().style.display = !selected || tags.includes(selected) ? 'block' : 'none';
    });
  });
}

// ✅ Legend toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('legend-toggle');
  const legendWrapper = document.getElementById('legend-wrapper');

  toggleButton.addEventListener('click', () => {
    const isHidden = legendWrapper.classList.toggle('collapsed');
    toggleButton.textContent = isHidden ? 'Show Legend' : 'Hide Legend';
  });
});

// ✅ Load everything
map.on('load', fetchAirtableData);
