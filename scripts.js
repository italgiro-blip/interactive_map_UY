document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración de Mapas Base
    const baseLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    const map = L.map('map', { zoomControl: false, layers: [baseLayers.dark] }).setView([-32.5228, -55.7658], 7);

    const labelSelect = document.getElementById('labelSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');
    const baseMapSelect = document.getElementById('baseMapSelect');
    
    let geojsonLayer, legend, currentBreaks = [];

    // 2. Definición de Paletas
    const colorSchemes = {
        reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        yellows: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'],
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']
    };

    let currentPalette = colorSchemes.blues;

    // 1. Modificamos el buscador de propiedades para que sea más flexible
const getProp = (props, keys) => {
    // Busca la primera coincidencia sin importar mayúsculas/minúsculas o espacios
    const found = Object.keys(props).find(k => 
        keys.includes(k.toLowerCase().trim())
    );
    return found ? props[found] : null;
};

    // --- CORRECCIÓN AQUÍ: Función computeBreaks cerrada correctamente ---
    function computeBreaks(data, method) {
        const vals = data.features
            .map(f => parseFloat(getProp(f.properties, ['tasa_promedio', 'tasa', 'valor', 'taxa'])) || 0)
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

    // --- CORRECCIÓN AQUÍ: Nueva función getColor ---
    function getColor(v, brk) {
        for (let i = 0; i < 5; i++) {
            if (v >= brk[i] && v <= brk[i + 1]) return currentPalette[i];
        }
        return currentPalette[4];
    }

    // Carga y Dibujo
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('tasas_H_dep.geojson')
            .then(res => res.json())
            .then(data => {
                currentBreaks = computeBreaks(data, classificationSelect.value);
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                labelSelect.innerHTML = '<option value="">Seleccione...</option>';

                // 2. En la carga del GeoJSON (dentro del fetch)
geojsonLayer = L.geoJSON(data, {
    style: (f) => {
        // Buscamos 'taxa'
        const valorTaxa = parseFloat(getProp(f.properties, ['taxa', 'tasa'])) || 0;
        return {
            fillColor: getColor(valorTaxa, currentBreaks),
            weight: 1.5, 
            color: 'white', 
            fillOpacity: 0.75
        };
    },
                   onEachFeature: (f, layer) => {
        // Buscamos 'nome' y 'taxa' explícitamente
        const nome = getProp(f.properties, ['nome', 'name']) || "Sin nombre";
        const taxa = getProp(f.properties, ['taxa', 'tasa']) || 0;
        
        layer.on('click', () => seleccionarFreguesia(nome, taxa, layer));
        
        // Llenar el selector
        labelSelect.add(new Option(nome, nome));
    }
}).addTo(map);
                addLegend();
                map.fitBounds(geojsonLayer.getBounds());
            });
    };

    function seleccionarFreguesia(nome, taxa, layer) {
        document.getElementById('detailNome').innerHTML = `<b>Nome:</b> ${nome}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Taxa:</b> ${taxa}%`;
        labelSelect.value = nome;

        geojsonLayer.eachLayer(l => {
            geojsonLayer.resetStyle(l);
            if (l.getTooltip()) l.unbindTooltip(); 
        });

        layer.setStyle({ color: '#ff8c1a', weight: 5, fillOpacity: 0.9 });
        layer.bindTooltip(`<b>${nome}</b><br>${taxa}%`, { direction: 'center', className: 'tooltip-selected' }).openTooltip();
        layer.bringToFront();
        map.fitBounds(layer.getBounds(), { padding: [40, 40] });

        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        document.querySelectorAll('.legend-item').forEach((item, index) => {
            if (taxa >= currentBreaks[index] && taxa <= currentBreaks[index + 1]) {
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
            if (getProp(layer.feature.properties, ['nome', 'name']) === e.target.value) {
                seleccionarFreguesia(e.target.value, getProp(layer.feature.properties, ['taxa', 'rate']) || 0, layer);
            }
        });
    };

    window.highlightRange = (min, max) => {
        if (!geojsonLayer) return;
        geojsonLayer.eachLayer(layer => {
            const val = parseFloat(getProp(layer.feature.properties, ['taxa', 'rate', 'tasa'])) || 0;
            layer.setStyle(val >= min && val <= max ? { fillOpacity: 1, weight: 3 } : { fillOpacity: 0.1, weight: 1 });
        });
    };
    window.resetHighlight = () => {
        if (geojsonLayer) geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
    };
});
