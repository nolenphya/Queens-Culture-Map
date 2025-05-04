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

// ✅ Data Structures
let allMarkers = [];
let orgMarkers = {};
let uniqueTags = new Set();

// ✅ Fetch CSV from Google Sheets
function fetchData() {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/14m6_RP2yfUjLirv8HC5xav8sIMKFVuT4BHW-vRZqB-Q/export?format=csv';

  fetch(sheetURL)
    .then(response => response.text())
    .then(csvData => {
      Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        complete: results => {
          addMarkers(results.data);
        },
        error: err => console.error("CSV Parse Error:", err)
      });
    })
    .catch(err => console.error("Fetch Error:", err));
}

// ✅ Add Markers to Map
function addMarkers(data) {
  // Clear previous markers
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];
  orgMarkers = {};
  uniqueTags.clear();

  data.forEach(row => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) return;

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
  });

  buildLegendByOrg();
  buildTagDropdown();
}

// ✅ Legend By Organization Name
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

// ✅ Dropdown Menu for Tag Filtering
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
    const selectedTag = dropdown.value.toLowerCase();
    allMarkers.forEach(marker => {
      const tags = (marker.rowData.Tags || "").toLowerCase();
      const visible = !selectedTag || tags.includes(selectedTag);
      marker.getElement().style.display = visible ? 'block' : 'none';
    });
  });
}

// ✅ Legend Toggle Button Handler
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('legend-toggle');
  const legend = document.getElementById('legend');

  if (toggleButton && legend) {
    toggleButton.addEventListener('click', () => {
      const isCollapsed = legend.classList.toggle('collapsed');
      toggleButton.textContent = isCollapsed ? 'Show Legend' : 'Hide Legend';
    });
  } else {
    console.warn('Legend toggle elements not found in DOM.');
  }
});


// ✅ Start once map loads
map.on('load', fetchData);
