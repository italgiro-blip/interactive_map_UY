document.addEventListener('DOMContentLoaded', () => {
    // 1. MAPA Y CAPAS BASE
    const baseLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    const map = L.map('map', { zoomControl: false, layers: [baseLayers.dark] }).setView([-32.5228, -55.7658], 7);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    let geojsonLayer, currentData, currentBreaks = [];
    const colorSchemes = {
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
        reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c']
    };
    let currentPalette = colorSchemes.blues;

    const getProp = (p, keys) => {
        const found = Object.keys(p).find(k => keys.includes(k.toLowerCase()));
        return found ? p[found] : null;
    };

    // 2. LÓGICA ESTADÍSTICA
    function computeBreaks(data, method) {
        const vals = data.features
            .map(f => parseFloat(getProp(f.properties, ['tasa_promedio', 'tasa', 'valor'])) || 0)
            .sort((a, b) => a - b);
        const min = vals[0], max = vals[vals.length - 1];
        if (method === 'equal') {
            return Array.from({ length: 6 }, (_, i) => min + (i * (max - min) / 5));
        } else if (method === 'quartiles') {
            return [vals[0], vals[Math.floor(vals.length * 0.2)], vals[Math.floor(vals.length * 0.4)], vals[Math.floor(vals.length * 0.6)], vals[Math.floor(vals.length * 0.8)], vals[vals.length - 1]];
        } else {
            return [min, vals[Math.floor(vals.length * 0.1)], vals[Math.floor(vals.length * 0.3)], vals[Math.floor(vals.length * 0.6)], vals[Math.floor(vals.length * 0.85)], max];
        }
    }

    function getColorIndex(v, brk) {
        for (let i = 0; i < 5; i++) if (v >= brk[i] && v <= brk[i + 1]) return i;
        return 4;
    }

    // 3. RENDERIZADO E INTERACCIÓN CRUZADA
    function renderMap(data) {
        if (!data) return;
        currentBreaks = computeBreaks(data, document.getElementById('classificationSelect').value);
        if (geojsonLayer) map.removeLayer(geojsonLayer);
        
        geojsonLayer = L.geoJSON(data, {
            style: (f) => ({
                fillColor: colorSchemes[document.getElementById('paletteSelect').value][getColorIndex(parseFloat(getProp(f.properties, ['tasa_promedio', 'tasa', 'valor'])) || 0, currentBreaks)],
                weight: 1.2, color: 'white', fillOpacity: 0.8
            }),
            onEachFeature: (f, layer) => {
                const n = getProp(f.properties, ['nombre', 'name', 'departamento']);
                const t = parseFloat(getProp(f.properties, ['tasa_promedio', 'tasa', 'valor'])) || 0;
                
                layer.bindTooltip(`<b>${n}</b><br>Valor: ${t}`, { sticky: true });

                layer.on({
                    mouseover: (e) => {
                        const index = getColorIndex(t, currentBreaks);
                        resaltarBloqueLegenda(index);
                        layer.setStyle({ weight: 3, color: '#FFD700', fillOpacity: 1 });
                    },
                    mouseout: (e) => {
                        resetBloqueLegenda();
                        geojsonLayer.resetStyle(e.target);
                    },
                    click: () => {
                        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${n}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${t}%`;
                    }
                });
            }
        }).addTo(map);
        updateLegend();
    }

    // 4. LEYENDA (COLOR SCALE BAR)
    function updateLegend() {
        let container = document.querySelector('.legend-horizontal');
        
        if (!container) {
            container = L.DomUtil.create('div', 'legend-horizontal');
            const lControl = L.control({ position: 'bottomright' });
            lControl.onAdd = () => container;
            lControl.addTo(map);
        }

        let html = `<div>ESCALA DE VALORES</div>
                    <div class="legend-container">`;

        for (let i = 0; i < 5; i++) {
            const low = currentBreaks[i];
            const high = currentBreaks[i+1];
            const color = currentPalette[i];

            html += `
            <div class="legend-item" id="leg-block-${i}">
                <div class="legend-color" style="background:${color};"></div>
                <span class="legend-text">${low.toFixed(1)}</span>
                ${i === 4 ? `<span class="legend-text" style="position: absolute; right: -15px; bottom: 0;">${high.toFixed(1)}</span>` : ''}
            </div>`;
        }
        container.innerHTML = html + '</div>';
    }

    window.resaltarBloqueLegenda = (index) => {
        const block = document.getElementById(`leg-block-${index}`);
        if (block) {
            block.firstElementChild.style.borderColor = "#FFD700";
            block.firstElementChild.style.borderWidth = "2px";
            block.firstElementChild.style.zIndex = "10";
        }
    };

    window.resetBloqueLegenda = () => {
        for (let i = 0; i < 5; i++) {
            const block = document.getElementById(`leg-block-${i}`);
            if (block) {
                block.firstElementChild.style.borderColor = "rgba(255,255,255,0.4)";
                block.firstElementChild.style.borderWidth = "0.5px";
            }
        }
    };

    // 5. CARGA Y SELECTORES
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('tasas_H_dep.geojson').then(r => r.json()).then(data => {
            currentData = data;
            renderMap(data);
            map.fitBounds(geojsonLayer.getBounds(), { padding: [30, 30] });
            const select = document.getElementById('labelSelect');
            select.innerHTML = '<option value="">Seleccionar departamento...</option>';
            const nombres = data.features.map(f => getProp(f.properties, ['nombre', 'name', 'departamento'])).filter(n => n).sort();
            nombres.forEach(name => select.add(new Option(name, name)));
        });
    };

    document.getElementById('labelSelect').onchange = (e) => {
        const sel = e.target.value;
        if (!sel) return;
        geojsonLayer.eachLayer(layer => {
            if (getProp(layer.feature.properties, ['nombre', 'name', 'departamento']) === sel) {
                map.fitBounds(layer.getBounds(), { padding: [100, 100], maxZoom: 10 });
                const v = getProp(layer.feature.properties, ['tasa_promedio', 'tasa', 'valor']) || 0;
                document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${sel}`;
                document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${v}%`;
                layer.setStyle({ weight: 4, color: '#FFD700' });
                layer.openTooltip();
            }
        });
    };

    document.getElementById('classificationSelect').onchange = () => renderMap(currentData);
    document.getElementById('paletteSelect').onchange = (e) => { 
        currentPalette = colorSchemes[e.target.value]; 
        renderMap(currentData); 
    };
    document.getElementById('baseMapSelect').onchange = (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    };

    // --- 6. GEOLOCALIZACIÓN AVANZADA Y RUTA EN TIEMPO REAL ---
    const iconoAvanzado = L.divIcon({
        className: 'mi-ubicacion-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    // Arranca con opacidad 0 para evitar que aparezca un punto falso en el [0,0]
    let markerAvanzado = L.marker([0, 0], {
        icon: iconoAvanzado,
        opacity: 0, 
        zIndexOffset: 1000
    }).addTo(map);

    let historialLinea = [];
    let polyline = L.polyline([], { color: '#3b82f6', weight: 4, opacity: 0.7 }).addTo(map);
    let centradoGPSInicial = false;

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const newLatLng = [lat, lon];

                // Al recibir la señal real del GPS, hacemos visible el marcador
                if (markerAvanzado.options.opacity === 0) {
                    markerAvanzado.setOpacity(1);
                }

                markerAvanzado.setLatLng(newLatLng);

                historialLinea.push(newLatLng);
                polyline.setLatLngs(historialLinea);

                // Centrar automáticamente la primera vez que se obtenga ubicación válida
                if (!centradoGPSInicial) {
                    map.setView(newLatLng, 15);
                    centradoGPSInicial = true;
                }
            },
            (error) => {
                console.error("Error de GPS:", error.message);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
});
