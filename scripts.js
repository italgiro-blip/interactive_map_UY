document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración de Mapas Base
    const baseLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    const map = L.map('map', { zoomControl: false, layers: [baseLayers.dark] }).setView([-33.3823, -56.5276], 14);

    const labelSelect = document.getElementById('labelSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');
    const baseMapSelect = document.getElementById('baseMapSelect');
    
    let geojsonLayer, legend, currentBreaks = [];

    // 2. Definición de Paletas por Intensidad
    const colorSchemes = {
        reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        yellows: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'],
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']
    };

    let currentPalette = colorSchemes.blues;

    const getProp = (props, keys) => {
        const found = Object.keys(props).find(k => keys.includes(k.toLowerCase()));
        return found ? props[found] : null;
    };

    // Lógica Estadística
  function computeBreaks(data, method) {
    const values = data.features
        .map(f => parseFloat(getProp(f.properties, ['Valor', 'rate'])) || 0)
        .sort((a, b) => a - b);
    
    const n = 5; // Siempre 5 para tus 5 colores

    if (method === 'quartiles') {
        // Divide los datos en 5 grupos con la misma cantidad de elementos (20% cada uno)
        return [
            values[0],
            values[Math.floor(values.length * 0.2)],
            values[Math.floor(values.length * 0.4)],
            values[Math.floor(values.length * 0.6)],
            values[Math.floor(values.length * 0.8)],
            values[values.length - 1]
        ];
    }
    
    if (method === 'equal') {
        // Divide el rango total (ej. 0 a 100) en 5 partes iguales (0, 20, 40...)
        const min = values[0], max = values[values.length - 1];
        const step = (max - min) / n;
        return Array.from({ length: n + 1 }, (_, i) => min + i * step);
    }

    if (method === 'jenks') {
        // Jenks real es complejo, pero este "Jenks simplificado" busca 
        // valores que representen mejor la distribución de los datos.
        const breaks = [values[0]];
        // Usamos una distribución logarítmica o de saltos para diferenciarlo de Quintiles
        for (let i = 1; i < n; i++) {
            // Buscamos un índice que no sea lineal
            let idx = Math.floor(Math.pow(i / n, 1.5) * values.length);
            breaks.push(values[Math.min(idx, values.length - 1)]);
        }
        breaks.push(values[values.length - 1]);
        // Limpiamos duplicados y ordenamos por si acaso
        return [...new Set(breaks)].sort((a, b) => a - b);
    }
}

    function getColor(v, breaks) {
        for (let i = 0; i < breaks.length - 1; i++) {
            if (v >= breaks[i] && v <= breaks[i+1]) return currentPalette[i];
        }
        return currentPalette[currentPalette.length - 1];
    }

    // Carga y Dibujo
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('maps.geojson')
            .then(res => res.json())
            .then(data => {
                currentBreaks = computeBreaks(data, classificationSelect.value);
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                labelSelect.innerHTML = '<option value="">Selecione...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: (f) => ({
                        fillColor: getColor(parseFloat(getProp(f.properties, ['Valor', 'rate'])) || 0, currentBreaks),
                        weight: 1.5, color: 'white', fillOpacity: 0.75
                    }),
                    onEachFeature: (f, layer) => {
                        const nome = getProp(f.properties, ['Unidad', 'name', 'Unidad']);
                        const taxa = getProp(f.properties, ['Valor', 'rate']) || 0;
                        layer.on('click', () => seleccionarFreguesia(Unidad, Valor, layer));
                        labelSelect.add(new Option(Unidad, Unidad));
                    }
                }).addTo(map);
                addLegend();
                map.fitBounds(geojsonLayer.getBounds());
            });
    };

    function seleccionarFreguesia(Unidad, Valor, layer) {
        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${Unidad}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${Valor}%`;
        labelSelect.value = Unidad;

        geojsonLayer.eachLayer(l => {
            geojsonLayer.resetStyle(l);
            l.unbindTooltip(); 
        });

        layer.setStyle({ color: '#2A3180', weight: 5, fillOpacity: 0.9 });
        layer.bindTooltip(`<b>${Unidad}</b><br>${Valor}%`, { direction: 'center', className: 'tooltip-selected' }).openTooltip();
        layer.bringToFront();
        map.fitBounds(layer.getBounds(), { padding: [40, 40] });

        // Sincronizar Leyenda
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        document.querySelectorAll('.legend-item').forEach((item, index) => {
            if (Valor >= currentBreaks[index] && Valor <= currentBreaks[index + 1]) {
                item.classList.add('active-legend');
            }
        });
    }

    function addLegend() {
        if (legend) map.removeControl(legend);
        legend = L.control({position: 'bottomright'});
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let html = '<div class="legend-container">';
            for (let i = 0; i < currentBreaks.length - 1; i++) {
                html += `
                    <div class="legend-item" onmouseover="highlightRange(${currentBreaks[i]}, ${currentBreaks[i+1]})" onmouseout="resetHighlight()">
                        <div class="legend-color" style="background:${currentPalette[i]}"></div>
                        <div class="legend-text">${currentBreaks[i].toFixed(1)}-${currentBreaks[i+1].toFixed(1)}%</div>
                    </div>`;
            }
            div.innerHTML = html + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    // Manejadores de Eventos UI
    baseMapSelect.onchange = (e) => {
        Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
        baseLayers[e.target.value].addTo(map);
    };

    paletteSelect.onchange = (e) => {
        currentPalette = colorSchemes[e.target.value];
        document.getElementById('btnCargarGeoJSON').click();
    };

    classificationSelect.onchange = () => document.getElementById('btnCargarGeoJSON').click();
    
    labelSelect.onchange = (e) => {
        geojsonLayer.eachLayer(layer => {
            if (getProp(layer.feature.properties, ['Unidad', 'name']) === e.target.value) {
                seleccionarFreguesia(e.target.value, getProp(layer.feature.properties, ['Valor', 'rate']) || 0, layer);
            }
        });
    };

    window.highlightRange = (min, max) => {
        geojsonLayer.eachLayer(layer => {
            const val = parseFloat(getProp(layer.feature.properties, ['Valor', 'rate'])) || 0;
            layer.setStyle(val >= min && val <= max ? { fillOpacity: 1, weight: 3 } : { fillOpacity: 0.1, weight: 1 });
        });
    };
    window.resetHighlight = () => geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));

});


