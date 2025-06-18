// Mapbox Setup
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
  center: [-73.94, 40.73], // Queens
  zoom: 11
});

// Airtable Setup
const AIRTABLE_API_KEY = 'patboskAQTJUi9FlQ.1c30c3c632cd4d7bd03cf949e50edd922425aba8dcbf0c8a6002e98db67c74a3';
const BASE_ID = 'apph04Z2gcYOSx8Qm';
const TABLE_NAME = 'tblr4J8Yw9bgmN26V';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

// Globals
let allMarkers = [];
const colorMap = {};
const colorPalette = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8',
  '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff'
];

// Color assignment
function getColorFor(tag) {
  if (!colorMap[tag]) {
    const index = Object.keys(colorMap).length % colorPalette.length;
    colorMap[tag] = colorPalette[index];
  }
  return colorMap[tag];
}

// SVG pin
function createColoredMarkerSVG(color) {
  return encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="0 0 24 24" fill="${color}">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/>
    </svg>
  `);
}

// Fetch and enrich data
async function fetchData() {
  const res = await fetch(`${AIRTABLE_URL}?view=Grid%20view`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
  });

  const json = await res.json();
  const rawRecords = json.records.map(rec => ({ id: rec.id, ...rec.fields }));

  const enrichedRecords = await Promise.all(
    rawRecords.map(async (record) => {
      const hasLatLng = parseFloat(record.Latitude) && parseFloat(record.Longitude);
      return hasLatLng ? record : await geocodeAndSaveMissingCoords(record);
    })
  );

  createMarkers(enrichedRecords.filter(Boolean));
}

// Geocode missing coordinates
async function geocodeAndSaveMissingCoords(record) {
  if (!record.Address) return null;

  const query = encodeURIComponent(record.Address);
  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxgl.accessToken}`;

  try {
    const res = await fetch(geocodeUrl);
    const json = await res.json();

    if (!json.features.length) return null;

    const [lng, lat] = json.features[0].center;

    // Save back to Airtable
    await fetch(`${AIRTABLE_URL}/${record.id}`, {
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

    record.Latitude = lat;
    record.Longitude = lng;
    return record;
  } catch (error) {
    console.error('Geocoding failed for:', record.Address, error);
    return null;
  }
}

// Create markers
function createMarkers(data) {
  allMarkers.forEach(m => m.remove());
  allMarkers = [];

  const tagGroups = {};

  data.forEach(row => {
    const lat = parseFloat(row.Latitude);
    const lng = parseFloat(row.Longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const tags = (row.Tags || "").split(',').map(t => t.trim()).filter(Boolean);
    const primaryTag = tags[0] || 'Uncategorized';
    const color = getColorFor(primaryTag);

    const el = document.createElement('div');
    el.style.backgroundImage = `url('data:image/svg+xml,${createColoredMarkerSVG(color)}')`;
    el.style.width = '30px';
    el.style.height = '40px';
    el.style.backgroundSize = 'contain';

const imageUrl = Array.isArray(row.Image) && row.Image.length > 0 ? row.Image[0].url : '';

const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
  <div style="max-width: 250px;">
    ${imageUrl ? `<img src="${imageUrl}" alt="${row["Org Name"] || "Image"}" style="width: 100%; height: auto; margin-bottom: 10px;">` : ''}
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

    marker.rowData = row;
    allMarkers.push(marker);

    tags.forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(marker);
    });
  });

  buildLegend(tagGroups);
}

// Build filter legend
function buildLegend(tagGroups) {
  const container = document.getElementById('legend-content');
  container.innerHTML = '';

  Object.entries(tagGroups).forEach(([tag, markers]) => {
    const color = getColorFor(tag);

    const section = document.createElement('div');
    section.className = 'legend-category';

    const header = document.createElement('h4');
    header.innerHTML = `${tag} <span>▾</span>`;
    let collapsed = false;

    const list = document.createElement('ul');
    list.className = 'legend-org-list';

    markers.forEach(marker => {
      const li = document.createElement('li');

      const dot = document.createElement('span');
      dot.className = 'legend-color-dot';
      dot.style.backgroundColor = color;

      const label = document.createElement('span');
      label.textContent = marker.rowData["Org Name"] || "Unnamed";

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;

      checkbox.addEventListener('change', () => {
        marker.getElement().style.display = checkbox.checked ? 'block' : 'none';
      });

      li.appendChild(checkbox);
      li.appendChild(dot);
      li.appendChild(label);
      list.appendChild(li);
    });

    header.addEventListener('click', () => {
      collapsed = !collapsed;
      list.style.display = collapsed ? 'none' : 'block';
      header.querySelector('span').textContent = collapsed ? '▸' : '▾';
    });

    section.appendChild(header);
    section.appendChild(list);
    container.appendChild(section);
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    document.querySelectorAll('#legend-content input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      cb.dispatchEvent(new Event('change'));
    });
  });
}

document.getElementById('search-input').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (!query) return;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.flyTo({ center: [lng, lat], zoom: 14 });
      } else {
        alert('Address not found.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      alert('There was a problem searching. Try again.');
    }
  }
});


// Load map with data
map.on('load', () => {
  // Your existing fetchData call
  fetchData();
});

document.getElementById('close-welcome').addEventListener('click', () => {
  document.getElementById('welcome-overlay').style.display = 'none';
});
