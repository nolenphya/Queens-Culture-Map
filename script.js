// ✅ Mapbox Initialization
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
  center: [-74.006, 40.7128],
  zoom: 10
});

// ✅ Geocoder (search box)
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

// ✅ Airtable config
const AIRTABLE_API_KEY = 'patVU2XRVZ6uiJvA8.5076600888577f61b245c3510979a1383c551c656673b03f012b0391bfdc7fdc';
const BASE_ID = 'apppBx0a9hj0Z1ciw';
const TABLE_NAME = 'tblgqyoE5TZUzQDKw';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?view=Grid%20view`;

// ✅ Data structures
let allMarkers = [];
let orgMarkers = {};
let uniqueTags = new Set();

// ✅ Fetch data from Airtable
async function fetchAirtableData() {
  try {
    const response = await fetch(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`
      }
    });

    if (!response.ok) throw new Error('Airtable fetch failed');

    const airtableData = await response.json();
    const records = airtableData.records.map(record => record.fields);

    addMarkers(records);
  } catch (error) {
    console.error('Error fetching Airtable data:', error);
  }
}

// ✅ Add Markers to Map
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
          [lng, lat] = coords;
        } else {
          console.warn('No lat/lng or failed geocode for:', row);
          continue;
        }
      } else {
        console.warn('No lat/lng or address for:', row);
        continue;
      }
    }

    const org = row["Org Name"] || "Unnamed";
    const tags = Array.isArray(row.Tags)
      ? row.Tags
      : (typeof row.Tags === 'string' ? row.Tags.split(',').map(t => t.trim()) : []);
    tags.forEach(tag => uniqueTags.add(tag));

    // Handle Airtable attachment field
    let imageUrl = '';
    if (Array.isArray(row["Image"]) && row["Image"].length > 0) {
      imageUrl = row["Image"][0].url;
    } else if (typeof row["Image"] === 'string') {
      imageUrl = row["Image"];
    }

    const popupHTML = `
      <div style="max-width: 300px;">
        <h3>${org}</h3>
        ${row["Address"] ? `<p><strong>Address:</strong><br>${row["Address"]}</p>` : ""}
        ${row["Email"] ? `<p><strong>Email:</strong><br><a href="mailto:${row["Email"]}">${row["Email"]}</a></p>` : ""}
        ${row["Phone"] ? `<p><strong>Phone:</strong><br>${row["Phone"]}</p>` : ""}
        ${tags.length ? `<p><strong>Tags:</strong><br>${tags.join(', ')}</p>` : ""}
        ${row["Website"] ? `<p><strong>Website:</strong><br><a href="${row["Website"]}" target="_blank">${row["Website"]}</a></p>` : ""}
        ${row["Social"] ? `<p><strong>Social:</strong><br>${row["Social"]}</p>` : ""}
        ${imageUrl ? `<img src="${imageUrl}" style="width:100%; margin-top:10px; border-radius:6px;" />` : ""}
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

// ✅ Geocode missing lat/lng
async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address);
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxgl.accessToken}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.features && data.features.length > 0) {
    return data.features[0].center;
  }
  return null;
}

// ✅ Legend By Organization
function buildLegendByOrg() {
  const container = document.getElementById('legend');
  container.innerHTML = '';

  Object.keys(orgMarkers).forEach(org => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '4px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.org = org;

    checkbox.addEventListener('change', () => {
      const show = checkbox.checked;
      orgMarkers[org].forEach(marker => {
        marker.getElement().style.display = show ? 'block' : 'none';
      });
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${org}`));
    container.appendChild(label);
  });
}

// ✅ Dropdown Filter by Tag
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
      let tags = marker.rowData.Tags || [];

      if (typeof tags === 'string') {
        tags = tags.split(',').map(t => t.trim().toLowerCase());
      } else if (Array.isArray(tags)) {
        tags = tags.map(t => t.toLowerCase());
      }

      const visible = !selected || tags.includes(selected);
      marker.getElement().style.display = visible ? 'block' : 'none';
    });
  });
}

// ✅ Toggle legend visibility
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('legend-toggle');
  const legendContent = document.getElementById('legend');

  if (toggleButton && legendContent) {
    toggleButton.addEventListener('click', () => {
      const hidden = legendContent.hidden;
      legendContent.hidden = !hidden;
      toggleButton.textContent = hidden ? 'Hide Legend' : 'Show Legend';
    });
  }
});

// ✅ Load when map is ready
map.on('load', fetchAirtableData);
