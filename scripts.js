document.addEventListener('DOMContentLoaded', () => {
    // 1. MAPAS BASE
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

    // Función auxiliar para buscar nombres de campos (agregamos 'tasa_promedio' y 'nombre')
    const getProp = (p, keys) => {
        const found = Object.keys(p).find(k => keys.includes(k.toLowerCase()));
        return found ? p[found] : null;
    };

    // 2. LÓGICA ESTADÍSTICA
    function computeBreaks(data, method) {
        const vals = data.features
            .map(f => parseFloat(getProp(f.properties, ['tasa_promedio', 'taxa', 'rate', 'tasa', 'valor'])) || 0)
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

    function getColor(v, brk) {
        for (let i = 0; i < 5; i++) if (v >= brk[i] && v <= brk[i + 1]) return currentPalette[i];
        return currentPalette[4];
    }

    // 3. ACTUALIZACIÓN DEL MAPA (Aquí incluimos nombre y valor en etiqueta)
    function renderMap(data) {
        if (!data) return;
        currentBreaks = computeBreaks(data, document.getElementById('classificationSelect').value);
        if (geojsonLayer) map.removeLayer(geojsonLayer);
        
        geojsonLayer = L.geoJSON(data, {
            style: (f) => ({
                fillColor: getColor(parseFloat(getProp(f.properties, ['tasa_promedio', 'taxa', 'rate', 'tasa', 'valor'])) || 0, currentBreaks),
                weight: 1.5, color: 'white', fillOpacity: 0.8
            }),
            onEachFeature: (f, layer) => {
                // Seleccionamos los campos nombre y valor
                const n = getProp(f.properties, ['nombre', 'name', 'departamento']);
                const t = getProp(f.properties, ['tasa_promedio', 'taxa', 'rate', 'tasa', 'valor']) || 0;

                // AÑADIMOS LA ETIQUETA INTERACTIVA (Tooltip)
                layer.bindTooltip(`<strong>${n}</strong><br>Valor: ${t}`, {
                    sticky: true,
                    direction: 'top'
                });

                // LÓGICA DE CLIC (Detalle lateral)
                layer.on('click', () => {
                    document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${n}`;
                    document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${t}%`;
                    geojsonLayer.setStyle({ weight: 1.5, color: 'white' });
                    layer.setStyle({ weight: 4, color: '#FFD700' });
                    layer.bringToFront();
                });
            }
        }).addTo(map);
        updateLegend();
    }

    function updateLegend() {
        const container = document.querySelector('.legend-horizontal') || L.DomUtil.create('div', 'legend-horizontal');
        let html = '<div class="legend-container">';
        for (let i = 0; i < 5; i++) {
            html += `<div class="legend-item"><div class="legend-color" style="background:${currentPalette[i]}"></div><div class="legend-text">${currentBreaks[i].toFixed(1)}</div></div>`;
        }
        container.innerHTML = html + '</div>';
        if (!document.querySelector('.legend-horizontal')) {
            const lControl = L.control({ position: 'bottomright' });
            lControl.onAdd = () => container;
            lControl.addTo(map);
        }
    }

    // 4. EVENTOS
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('tasas_H_dep.geojson')
            .then(r => r.json())
            .then(data => {
                currentData = data;
                renderMap(data);
                map.fitBounds(geojsonLayer.getBounds(), { padding: [30, 30] });
                
                const select = document.getElementById('labelSelect');
                select.innerHTML = '<option value="">Seleccionar...</option>';
                data.features.forEach(f => {
                    const name = getProp(f.properties, ['nombre', 'name', 'departamento']);
                    if(name) select.add(new Option(name, name));
                });
            }).catch(e => alert("Error al cargar 'tasas_H_dep.geojson'."));
    };

    document.getElementById('classificationSelect').onchange = () => renderMap(currentData);
    document.getElementById('paletteSelect').onchange = (e) => { currentPalette = colorSchemes[e.target.value]; renderMap(currentData); };
    document.getElementById('baseMapSelect').onchange = (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    };
});
