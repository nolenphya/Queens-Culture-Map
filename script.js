// ✅ Step 1: Initialize the Mapbox map
mapboxgl.accessToken = 'pk.eyJ1IjoiZmx1c2hpbmd0b3duaGFsbCIsImEiOiJjbWEzYmUzMWEwbnN3MmxwcjRyZG55ZmNxIn0.WRThoxFMtqTJQwV6Afv3ww';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/flushingtownhall/cma3bhpb4000l01qwf955dtqx',
  center: [-74.006, 40.7128],
  zoom: 10
});

// Add the geocoder (autocomplete search box) to the map
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

// Optionally, listen for the result event
geocoder.on('result', function(e) {
  console.log('Selected location:', e.result);
});

// ✅ Step 2: Fetch and parse CSV using Papa Parse (unchanged)
function fetchData() {
  const sheetURL = 'https://docs.google.com/spreadsheets/d/14m6_RP2yfUjLirv8HC5xav8sIMKFVuT4BHW-vRZqB-Q/export?format=csv';

  fetch(sheetURL)
    .then(response => response.text())
    .then(csvData => {
      Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          console.log("Parsed Data:", results.data);
          addMarkers(results.data);
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
        }
      });
    })
    .catch(error => console.error("Failed to fetch CSV:", error));
}


// Pick some predefined colors
function createColorIcon(color) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 24" fill="${color}">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z"/>
    </svg>
  `);
  return `data:image/svg+xml,${svg}`;
}



// ✅ Step 3: Add markers to the map

let allMarkers = []; // Declare this at the global level

function addMarkers(data) {
  allMarkers.forEach(marker => marker.remove());
  allMarkers = [];

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
        ${tags ? `<p><strong>Tags:</strong><br>${tags}</p>` : ""}
        ${website ? `<p><strong>Website:</strong><br><a href="${website}" target="_blank">${website}</a></p>` : ""}
        ${social ? `<p><strong>Social:</strong><br>${social}</p>` : ""}
      </div>
    `;

    tags.forEach(tag => {
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
  
    if (!tagGroups[tag]) tagGroups[tag] = [];
    tagGroups[tag].push(marker);
    allMarkers.push(marker);
  });
  });

  buildLegendByTag();
}

//buildLegendByTag();

document.getElementById('legend-toggle').addEventListener('click', () => {
  const legend = document.getElementById('legend');
  const btn = document.getElementById('legend-toggle');
  const isHidden = legend.classList.toggle('hidden');
  btn.textContent = isHidden ? 'Show Legend' : 'Hide Legend';
});


// Add Legend

function buildLegendByTag() {
  const legendContainer = document.getElementById('legend');
  legendContainer.innerHTML = '';

  const selectedTags = new Set();

  Object.keys(tagGroups).forEach(tag => {
    const color = getColorForTag(tag);

    const item = document.createElement('label');
    item.className = 'legend-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.marginBottom = '6px';
    item.style.gap = '8px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.tag = tag;
    checkbox.checked = true;
    selectedTags.add(tag);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedTags.add(tag);
      } else {
        selectedTags.delete(tag);
      }
      filterMarkersByTags(selectedTags);
    });

    const swatch = document.createElement('span');
    swatch.style.backgroundColor = color;
    swatch.style.width = '16px';
    swatch.style.height = '16px';
    swatch.style.borderRadius = '50%';

    const label = document.createElement('span');
    label.textContent = tag;

    item.appendChild(checkbox);
    item.appendChild(swatch);
    item.appendChild(label);

    legendContainer.appendChild(item);
  });

  // Initial filter run
  filterMarkersByTags(selectedTags);
}

function filterMarkersByTags(selectedTags) {
  allMarkers.forEach(marker => {
    const venueTags = (marker.rowData.Tags || "")
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const allSelected = [...selectedTags].map(tag => tag.toLowerCase());

    const matchesAll = allSelected.every(tag => venueTags.includes(tag));

    marker.getElement().style.display = matchesAll ? 'block' : 'none';
  });
}



// ✅ Step 4: Start fetching data
map.on('load', fetchData);
