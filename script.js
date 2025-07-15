// Mapbox Setup
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
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

// Color assignment (used for legend dots)
function getColorFor(tag) {
  if (!colorMap[tag]) {
    const index = Object.keys(colorMap).length % colorPalette.length;
    colorMap[tag] = colorPalette[index];
  }
  return colorMap[tag];
}

// Fetch and enrich data
async function fetchData() {
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
    console.error('Geocoding failed for:', record.Address, error);
    return null;
  }
}

// Create markers with icons
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
    const iconKey = iconMap[primaryTag] || 'default';

    const el = document.createElement('div');
    el.style.backgroundImage = `url(icons/${iconKey}.png)`;
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';

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

      // 1. Track categories
const groupedOptions = {}; // tag => [<option>, <option>, ...]

data.forEach((row, index) => {
  const tags = (row.Tags || "").split(',').map(t => t.trim()).filter(Boolean);
  const primaryTag = tags[0] || 'Uncategorized';

  const option = document.createElement('option');
  option.value = index;
  option.textContent = row["Org Name"] || "Unnamed";

  if (!groupedOptions[primaryTag]) groupedOptions[primaryTag] = [];
  groupedOptions[primaryTag].push(option);
});

const select = document.getElementById('org-directory');
select.innerHTML = '<option value="">Select an organization...</option>';

Object.entries(groupedOptions)
  .sort(([a], [b]) => a.localeCompare(b)) // sort groups alphabetically
  .forEach(([tag, options]) => {
    const group = document.createElement('optgroup');
    group.label = tag;

    options.sort((a, b) => a.textContent.localeCompare(b.textContent)); // sort names
    options.forEach(opt => group.appendChild(opt));

    select.appendChild(group);
  });


    });
  });

  document.getElementById('org-directory').addEventListener('change', function (e) {
  const index = parseInt(e.target.value);
  if (isNaN(index)) return;

  const marker = allMarkers[index];
  map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
  marker.togglePopup();
});


  
  buildLegend(tagGroups);

}


// Build legend
function buildLegend(tagGroups) {
  const container = document.getElementById('legend-content');
  container.innerHTML = '';

  Object.entries(tagGroups).forEach(([tag, markers]) => {
    const iconKey = iconMap[tag] || 'default'; // ✅ define iconKey here

    const section = document.createElement('div');
    section.className = 'legend-category';

    const header = document.createElement('h4');
    header.innerHTML = `<span class="arrow">▾</span> ${tag}`;
    section.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'legend-org-list';

    markers.forEach(marker => {
      const li = document.createElement('li');

      // ✅ Now iconKey is defined correctly
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

    section.appendChild(list);
    container.appendChild(section);
  });
}


// Legend panel toggle
const legendToggle = document.getElementById('legend-toggle');
const legendArrow = document.getElementById('legend-arrow');
const legendContent = document.getElementById('legend-content');

let legendCollapsed = false;

legendToggle.addEventListener('click', () => {
  legendCollapsed = !legendCollapsed;
  legendContent.style.display = legendCollapsed ? 'none' : 'block';
  legendArrow.textContent = legendCollapsed ? '▸' : '▾';
});

// Search bar
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

// Map load logic
map.on('load', () => {
  Object.values(iconMap).forEach(iconName => {
    map.loadImage(`icons/${iconName}.png`, (error, image) => {
      if (error) {
        console.warn(`Could not load icon "${iconName}":`, error);
      } else if (!map.hasImage(iconName)) {
        map.addImage(iconName, image);
      }
    });
  });

  fetchData();

  $(document).ready(() => {
  $('#org-directory').select2({
    placeholder: "Search organizations...",
    allowClear: true
  });
});


  // Subway lines
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

// Controls & overlay logic
map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

document.getElementById('close-intro').addEventListener('click', () => {
  document.getElementById('intro-overlay').style.display = 'none';
});

const intro = document.getElementById('intro-overlay');
intro.addEventListener('touchmove', (e) => {
  if (intro.scrollTop > 100) {
    intro.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('legend-toggle');
  const wrapper = document.getElementById('legend-wrapper');

  toggleBtn.addEventListener('click', () => {
    wrapper.classList.toggle('collapsed');
    toggleBtn.textContent = wrapper.classList.contains('collapsed') ? '▲' : '▼';
  });
});

document.getElementById('org-directory').addEventListener('change', function (e) {
  const index = parseInt(e.target.value);
  if (isNaN(index)) return;

  const marker = allMarkers[index];
  map.flyTo({ center: marker.getLngLat(), zoom: 15, essential: true });
  marker.togglePopup();
});

