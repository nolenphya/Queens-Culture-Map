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
const BASE_ID = 'apppBx0a9hj0Z1ciw';
const TABLE_NAME = 'tblgqyoE5TZUzQDKw';
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
  // ✅ Add filterByFormula to fetch only Approved = true
  const res = await fetch(`${AIRTABLE_URL}?view=Grid%20view&filterByFormula=Approved`, {
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
  label.style.cursor = 'pointer';
  label.style.textDecoration = 'underline';

  label.addEventListener('click', () => {
    // Fly to marker
    map.flyTo({
      center: marker.getLngLat(),
      zoom: 15,
      essential: true
    });
    marker.togglePopup();

    // Highlight this li, remove highlight from others
    document.querySelectorAll('.legend-org-list li').forEach(item => {
      item.classList.remove('highlight');
    });
    li.classList.add('highlight');
    setTimeout(() => li.classList.remove('highlight'), 2000);

  });

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
  // ✅ 1) Load your approved Airtable points
  fetchData();

  // ✅ 2) Add NYC Subway Lines
  map.addSource('subway-lines', {
    type: 'geojson',
    data: 'nyc-subway-routes.geojson'
  });

  map.addLayer({
    id: 'subway-lines-layer',
    type: 'line',
    source: 'subway-lines',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-width': 2,
      'line-color': [
        'match',
        ['get', 'rt_symbol'],
        '1', '#EE352E', // red
        '2', '#EE352E',
        '3', '#EE352E',
        '4', '#00933C', // green
        '5', '#00933C',
        '6', '#00933C',
        'A', '#2850AD', // blue
        'C', '#2850AD',
        'E', '#2850AD',
        'B', '#FF6319', // orange
        'D', '#FF6319',
        'F', '#FF6319',
        'M', '#FF6319',
        'N', '#FCCC0A', // yellow
        'Q', '#FCCC0A',
        'R', '#FCCC0A',
        'W', '#FCCC0A',
        'L', '#A7A9AC', // grey
        'G', '#6CBE45', // light green
        'J', '#996633', // brown
        'Z', '#996633',
        '7', '#B933AD', // purple
        '#000000' // default black
      ]
    }
  });

  // ✅ 3) Add NYC Subway Stations (optional)

  map.addLayer({
    id: 'subway-stations-layer',
    type: 'circle',
    source: 'subway-stations',
    paint: {
      'circle-radius': 1,
      'circle-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#000000'
    }
  });
});


document.getElementById('close-welcome').addEventListener('click', () => {
  document.getElementById('welcome-overlay').style.display = 'none';
});
