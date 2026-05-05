document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURACIÓN DE MAPA Y CAPAS
    const baseLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    // Centrado en Uruguay por defecto, zoom 7
    const map = L.map('map', { zoomControl: false, layers: [baseLayers.dark] }).setView([-32.5228, -55.7658], 7);

    const labelSelect = document.getElementById('labelSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');
    const baseMapSelect = document.getElementById('baseMapSelect');
    
    let geojsonLayer, legendControl, currentBreaks = [];

    const colorSchemes = {
        reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        yellows: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'],
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']
    };

    let currentPalette = colorSchemes.blues;

    // 2. UTILIDADES
    const getProp = (props, keys) => {
        const found = Object.keys(props).find(k => keys.includes(k.toLowerCase().trim()));
        return found ? props[found] : null;
    };

    function computeBreaks(data, method) {
        const vals = data.features
            .map(f => parseFloat(getProp(f.properties, ['tasa_promedio', 'tasa', 'valor', 'taxa'])) || 0)
            .sort((a, b) => a - b);
        
        if (vals.length === 0) return [0, 0, 0, 0, 0, 0];
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
        for (let i = 0; i < 5; i++) {
            if (v >= brk[i] && v <= brk[i + 1]) return currentPalette[i];
        }
        return currentPalette[4];
    }

    // 3. RENDERIZADO Y LEYENDA
    function updateLegend() {
        if (legendControl) map.removeControl(legendControl);
        
        legendControl = L.control({ position: 'bottomright' });
        legendControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            div.style.background = "transparent";
            
            let html = `<div style="font-size: 12px; font-weight: bold; color: #fff; text-shadow: 1px 1px 3px #000; margin-bottom: 8px; text-align:center;">ESCALA DE VALORES</div>
                        <div style="display: flex; align-items: flex-end;">`;

            for (let i = 0; i < 5; i++) {
                const low = currentBreaks[i];
                const high = currentBreaks[i+1];
                html += `
                    <div class="legend-item" 
                         style="display: flex; flex-direction: column; align-items: center; width: 70px; position: relative;"
                         onmouseover="highlightRange(${low}, ${high})" 
                         onmouseout="resetHighlight()">
                        <div style="background:${currentPalette[i]}; width: 100%; height: 18px; border: 0.5px solid rgba(255,255,255,0.4);"></div>
                        <span style="font-size: 11px; font-weight: bold; color: #fff; text-shadow: 1px 1px 2px #000; margin-top: 4px;">
                            ${low.toFixed(1)}
                        </span>
                        ${i === 4 ? `<span style="font-size: 11px; font-weight: bold; color: #fff; text-shadow: 1px 1px 2px #000; position: absolute; right: 0; bottom: 0;">${high.toFixed(1)}</span>` : ''}
                    </div>`;
            }
            div.innerHTML = html + '</div>';
            return div;
        };
        legendControl.addTo(map);
    }

    // 4. CARGA DE DATOS
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('tasas_H_dep.geojson')
            .then(res => res.json())
            .then(data => {
                currentBreaks = computeBreaks(data, classificationSelect.value);
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                
                labelSelect.innerHTML = '<option value="">Seleccione...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: (f) => {
                        const val = parseFloat(getProp(f.properties, ['taxa', 'tasa', 'tasa_promedio', 'valor'])) || 0;
                        return {
                            fillColor: getColor(val, currentBreaks),
                            weight: 1.5, color: 'white', fillOpacity: 0.75
                        };
                    },
                    onEachFeature: (f, layer) => {
                        const nome = getProp(f.properties, ['nome', 'name', 'NOMBRE']) || "NOMBRE";
                        const taxa = parseFloat(getProp(f.properties, ['taxa', 'tasa', 'tasa_promedio', 'valor'])) || 0;
                        
                        layer.on('click', () => {
                            document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${nome}`;
                            document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${taxa}%`;
                            labelSelect.value = NOMBRE;
                            
                            geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
                            layer.setStyle({ color: '#ff8c1a', weight: 5, fillOpacity: 0.9 });
                            layer.bindTooltip(`<b>${nome}</b><br>${taxa}%`).openTooltip();
                        });
                        
                        labelSelect.add(new Option(nome, nome));
                    }
                }).addTo(map);

                updateLegend();
                map.fitBounds(geojsonLayer.getBounds(), { padding: [30, 30] });
            })
            .catch(err => console.error("Error al cargar GeoJSON:", err));
    };

    // 5. INTERACCIONES GLOBALES
    window.highlightRange = (min, max) => {
        if (!geojsonLayer) return;
        geojsonLayer.eachLayer(layer => {
            const val = parseFloat(getProp(layer.feature.properties, ['taxa', 'tasa', 'tasa_promedio', 'valor'])) || 0;
            const isMatch = val >= min && val <= max;
            layer.setStyle({ 
                fillOpacity: isMatch ? 1 : 0.1, 
                weight: isMatch ? 3 : 1 
            });
        });
    };

    window.resetHighlight = () => {
        if (geojsonLayer) geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
    };

    // 6. EVENTOS DE SELECTORES
    baseMapSelect.onchange = (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    };

    paletteSelect.onchange = (e) => {
        currentPalette = colorSchemes[e.target.value];
        document.getElementById('btnCargarGeoJSON').click();
    };

    classificationSelect.onchange = () => document.getElementById('btnCargarGeoJSON').click();

    labelSelect.onchange = (e) => {
        geojsonLayer.eachLayer(layer => {
            if (getProp(layer.feature.properties, ['nome', 'name', 'NOMBRE']) === e.target.value) {
                layer.fire('click');
                map.fitBounds(layer.getBounds(), { padding: [100, 100] });
            }
        });
    };
});
