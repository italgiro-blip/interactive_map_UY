document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURACIÓN DE MAPA Y CAPAS
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

    // 2. ESTADÍSTICA
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

    // 3. RENDERIZADO
    function renderMap(data) {
        if (!data) return;
        currentBreaks = computeBreaks(data, document.getElementById('classificationSelect').value);
        if (geojsonLayer) map.removeLayer(geojsonLayer);
        
        geojsonLayer = L.geoJSON(data, {
            style: (f) => ({
                fillColor: getColor(parseFloat(getProp(f.properties, ['tasa_promedio', 'tasa', 'valor'])) || 0, currentBreaks),
                weight: 1.5, color: 'white', fillOpacity: 0.8
            }),
            onEachFeature: (f, layer) => {
                const n = getProp(f.properties, ['nombre', 'name', 'departamento']);
                const t = getProp(f.properties, ['tasa_promedio', 'tasa', 'valor']) || 0;
                layer.bindTooltip(`<b>${n}</b><br>Tasa: ${t}`, { sticky: true });
                layer.on('click', () => {
                    document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${n}`;
                    document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${t}%`;
                    resaltarPoligono(layer);
                });
            }
        }).addTo(map);
        updateLegend();
    }

    function resaltarPoligono(layer) {
        geojsonLayer.setStyle({ weight: 1.5, color: 'white', fillOpacity: 0.8 });
        layer.setStyle({ weight: 4, color: '#FFD700', fillOpacity: 0.9 });
        layer.bringToFront();
    }

    // 4. LEYENDA INTERACTIVA (BAR SCALE)
    function updateLegend() {
        let container = document.querySelector('.legend-container-main');
        if (!container) {
            container = L.DomUtil.create('div', 'legend-container-main');
            const lControl = L.control({ position: 'bottomright' });
            lControl.onAdd = () => container;
            lControl.addTo(map);
        }

        // Estilo de la caja de la leyenda
        container.style.background = "rgba(255,255,255,0.9)";
        container.style.padding = "10px";
        container.style.borderRadius = "5px";
        container.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";

        let html = `<div style="font-family: Arial; font-size: 11px; font-weight: bold; margin-bottom: 8px; text-align: center; color: #333;">ESCALA DE VALORES</div>
                    <div style="display: flex; align-items: flex-start;">`;

        for (let i = 0; i < 5; i++) {
            const low = currentBreaks[i];
            const high = currentBreaks[i+1];
            const color = currentPalette[i];

            html += `
                <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;" 
                     onmouseover="filtrarMapa(${low}, ${high})" 
                     onmouseout="resetFiltrarMapa()">
                    <div style="background:${color}; width: 50px; height: 15px; border: 0.5px solid rgba(0,0,0,0.1);"></div>
                    <span style="font-size: 9px; margin-top: 4px; color: #444;">${low.toFixed(1)}</span>
                </div>`;
            
            // Si es el último, agregamos la etiqueta del valor máximo al final
            if (i === 4) {
                html += `<div style="display: flex; flex-direction: column; align-items: center; margin-left: -5px;">
                            <div style="width: 5px; height: 15px;"></div>
                            <span style="font-size: 9px; margin-top: 4px; color: #444;">${high.toFixed(1)}</span>
                         </div>`;
            }
        }
        container.innerHTML = html + '</div>';
    }

    // Funciones globales para que la leyenda hable con el mapa
    window.filtrarMapa = (min, max) => {
        geojsonLayer.eachLayer(layer => {
            const val = parseFloat(getProp(layer.feature.properties, ['tasa_promedio', 'tasa', 'valor'])) || 0;
            if (val >= min && val <= max) {
                layer.setStyle({ fillOpacity: 1, weight: 3, color: '#000' });
            } else {
                layer.setStyle({ fillOpacity: 0.05, weight: 0.5, color: '#ccc' });
            }
        });
    };

    window.resetFiltrarMapa = () => {
        geojsonLayer.setStyle({ weight: 1.5, color: 'white', fillOpacity: 0.8 });
    };

    // 5. EVENTOS RESTANTES
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('tasas_H_dep.geojson').then(r => r.json()).then(data => {
            currentData = data;
            renderMap(data);
            map.fitBounds(geojsonLayer.getBounds(), { padding: [30, 30] });
            const select = document.getElementById('labelSelect');
            select.innerHTML = '<option value="">Seleccionar departamento...</option>';
            data.features.forEach(f => {
                const name = getProp(f.properties, ['nombre', 'name', 'departamento']);
                if(name) select.add(new Option(name, name));
            });
        });
    };

    document.getElementById('labelSelect').onchange = (e) => {
        const sel = e.target.value;
        geojsonLayer.eachLayer(layer => {
            if (getProp(layer.feature.properties, ['nombre', 'name', 'departamento']) === sel) {
                map.fitBounds(layer.getBounds(), { padding: [100, 100], maxZoom: 10 });
                const v = getProp(layer.feature.properties, ['tasa_promedio', 'tasa', 'valor']) || 0;
                document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${sel}`;
                document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${v}%`;
                resaltarPoligono(layer);
                layer.openTooltip();
            }
        });
    };

    document.getElementById('classificationSelect').onchange = () => renderMap(currentData);
    document.getElementById('paletteSelect').onchange = (e) => { currentPalette = colorSchemes[e.target.value]; renderMap(currentData); };
    document.getElementById('baseMapSelect').onchange = (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    };
});
