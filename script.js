mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
  center: [-74.006, 40.7128],
  zoom: 10
});

const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  placeholder: 'Search for an address',
  marker: { color: 'red' },
  proximity: { longitude: -74.006, latitude: 40.7128 },
  countries: 'us',
  limit: 5
});
map.addControl(geocoder);

geocoder.on('result', e => {
  console.log('Selected location:', e.result);
});

// Marker and tag setup
const tagGroups = {};
const tagColors = {};
const allMarkers = [];
const colorPalette = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4'];

function getColorForTag(tag) {
  if (!tagColors[tag]) {
    const color = colorPalette[Object.keys(tagColors).length % colorPalette.length];
    tagColors[tag] = color;
  }
  return tagColors[tag];
}

function createColorIcon(color) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 24" fill="${color}">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z"/>
    </svg>
  `);
  return `data:image/svg+xml,${svg}`;
}


function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];

  // Reset tagGroups
  Object.assign(tagGroups, {});


  data.forEach(row => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Skipping row with bad coordinates:', row);
      return;
    }

    const org = row["Org Name"] || "Unnamed Organization";
    const address = row["Address"] || "No address provided";
    const email = row["Email"] || "";
    const phone = row["Phone"] || "";
    const tags = (row["Tags"] || "").split(',').map(t => t.trim()).filter(t => t);
    const website = row["Website"] || "";
    const social = row["Social"] || "";
    const image = row["Image"] || "";

    const popupHTML = `
      <div style="max-width: 300px;">
        ${image ? `<img src="${image}" style="width:100%; max-height:200px; object-fit:cover; border-radius:8px; margin-bottom:8px;" />` : ""}
        <h3>${org}</h3>
        <p><strong>Address:</strong><br>${address}</p>
        ${email ? `<p><strong>Email:</strong><br><a href="mailto:${email}">${email}</a></p>` : ""}
        ${phone ? `<p><strong>Phone:</strong><br>${phone}</p>` : ""}
        ${tags.length ? `<p><strong>Tags:</strong><br>${tags.join(', ')}</p>` : ""}
        ${website ? `<p><strong>Website:</strong><br><a href="${website}" target="_blank">${website}</a></p>` : ""}
        ${social ? `<p><strong>Social:</strong><br>${social}</p>` : ""}
      </div>
    `;

    // Use the first tag to determine marker color
    const primaryTag = tags[0] || "default";
    const color = getColorForTag(primaryTag);

    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.backgroundImage = `url(${createColorIcon(color)})`;
    el.style.width = '30px';
    el.style.height = '40px';
    el.style.backgroundSize = 'contain';

    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
      .addTo(map);

    marker.rowData = row;
    allMarkers.push(marker);

    // Assign this marker to all its tags
    tags.forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(marker);
    });
  });

  buildLegendByTag();
}

console.log("🟡 Starting to add markers...");
function fetchData() {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/14m6_RP2yfUjLirv8HC5xav8sIMKFVuT4BHW-vRZqB-Q/export?format=csv';
  fetch(sheetURL)
    .then(res => res.text())
    .then(csv => {
      Papa.parse(csv, {
        header: true,
        dynamicTyping: true,
        complete: results => addMarkers(results.data)
      });
    })
    .catch(err => console.error("Error loading CSV:", err));
}
console.log("🟢 Markers should be added now.");
function buildLegendByTag() {
  const legendContainer = document.getElementById('legend');
  legendContainer.innerHTML = '';
  const selectedTags = new Set();

  Object.keys(tagGroups).forEach(tag => {
    const color = getColorForTag(tag);
    const label = document.createElement('label');
    label.className = 'legend-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.tag = tag;
    selectedTags.add(tag);

    checkbox.addEventListener('change', () => {
      checkbox.checked ? selectedTags.add(tag) : selectedTags.delete(tag);
      filterMarkersByTags(selectedTags);
    });

    const swatch = document.createElement('span');
    swatch.style.backgroundColor = color;

    const text = document.createElement('span');
    text.textContent = tag;

    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(text);
    legendContainer.appendChild(label);
  });

  filterMarkersByTags(selectedTags);
}

function filterMarkersByTags(selectedTags) {
  allMarkers.forEach(marker => {
    const tags = (marker.rowData.Tags || "").split(",").map(t => t.trim().toLowerCase());
    const matches = [...selectedTags].every(tag => tags.includes(tag.toLowerCase()));
    marker.getElement().style.display = matches ? 'block' : 'none';
  });
}

document.getElementById('legend-toggle').addEventListener('click', () => {
  const wrapper = document.getElementById('legend-wrapper');
  const btn = document.getElementById('legend-toggle');
  const hidden = wrapper.classList.toggle('hidden');
  btn.textContent = hidden ? 'Show Legend' : 'Hide Legend';
});

map.on('load', fetchData);
