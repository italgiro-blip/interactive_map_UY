document.addEventListener('DOMContentLoaded', () => {
    // 1. Capas Base
    const baseLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    // Inicializar mapa centrado en Uruguay (Lat, Lon)
    const map = L.map('map', { 
        layers: [baseLayers.dark],
        zoomControl: true 
    }).setView([-32.8, -56.0], 7);

    let geojsonLayer, legend;
    let currentPalette = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']; // Blues por defecto
    let currentBreaks = [];

    const colorSchemes = {
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
        reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f']
    };

    // 2. Lógica de Colores y Rangos
    function getColor(d, breaks) {
        if (d === undefined || d === null) return '#333';
        return d <= breaks[1] ? currentPalette[0] :
               d <= breaks[2] ? currentPalette[1] :
               d <= breaks[3] ? currentPalette[2] :
               d <= breaks[4] ? currentPalette[3] :
                                currentPalette[4];
    }

    function computeBreaks(data, method) {
        const values = data.features
            .map(f => parseFloat(f.properties.Tasa_promedio) || 0)
            .sort((a, b) => a - b);
        
        if (values.length === 0) return [0, 1, 2, 3, 4, 5];

        const min = values[0];
        const max = values[values.length - 1];

        if (method === 'equal') {
            const step = (max - min) / 5;
            return [min, min + step, min + step * 2, min + step * 3, min + step * 4, max];
        } else {
            // Quintiles (por defecto)
            return [
                values[0],
                values[Math.floor(values.length * 0.2)],
                values[Math.floor(values.length * 0.4)],
                values[Math.floor(values.length * 0.6)],
                values[Math.floor(values.length * 0.8)],
                values[values.length - 1]
            ];
        }
    }

    // 3. Función de Carga
    const cargarMapa = () => {
        fetch('tasas_H_dep.geojson')
            .then(res => {
                if (!res.ok) throw new Error("No se encuentra el archivo .geojson");
                return res.json();
            })
            .then(data => {
                const method = document.getElementById('classificationSelect').value;
                currentBreaks = computeBreaks(data, method);

                if (geojsonLayer) map.removeLayer(geojsonLayer);

                const labelSelect = document.getElementById('labelSelect');
                labelSelect.innerHTML = '<option value="">Seleccione Departamento...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: (f) => ({
                        fillColor: getColor(f.properties.Tasa_promedio, currentBreaks),
                        weight: 1.5,
                        color: 'white',
                        fillOpacity: 0.8
                    }),
                    onEachFeature: (f, layer) => {
                        const nombre = f.properties.NOMBRE || "N/A";
                        const tasa = f.properties.Tasa_promedio || 0;

                        layer.on('click', () => {
                            seleccionarDepartamento(nombre, tasa, layer);
                        });

                        labelSelect.add(new Option(nombre, nombre));
                    }
                }).addTo(map);

                actualizarLeyenda();
                map.fitBounds(geojsonLayer.getBounds());
            })
            .catch(err => alert("Error al cargar: " + err.message));
    };

    // 4. Interacción UI
    function seleccionarDepartamento(nombre, tasa, layer) {
        document.getElementById('detailNome').innerHTML = `<b>Departamento:</b> ${nombre}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Tasa Promedio:</b> ${tasa}`;
        document.getElementById('labelSelect').value = nombre;

        geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
        
        layer.setStyle({
            color: '#ffff00',
            weight: 4,
            fillOpacity: 0.9
        });
        layer.bringToFront();
    }

    function actualizarLeyenda() {
        if (legend) map.removeControl(legend);
        legend = L.control({ position: 'bottomright' });

        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-container');
            div.style.background = 'rgba(0,0,0,0.8)';
            div.style.padding = '10px';
            div.style.color = 'white';
            div.style.borderRadius = '8px';

            let html = '<b>Tasa Promedio</b><br>';
            for (let i = 0; i < currentBreaks.length - 1; i++) {
                html += `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 18px; height: 18px; background:${currentPalette[i]}; border: 1px solid #fff"></div>
                        ${currentBreaks[i].toFixed(1)} - ${currentBreaks[i+1].toFixed(1)}
                    </div>`;
            }
            div.innerHTML = html;
            return div;
        };
        legend.addTo(map);
    }

    // 5. Eventos de los Controles
    document.getElementById('btnCargarGeoJSON').onclick = cargarMapa;

    document.getElementById('baseMapSelect').onchange = (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    };

    document.getElementById('paletteSelect').onchange = (e) => {
        currentPalette = colorSchemes[e.target.value];
        if (geojsonLayer) cargarMapa();
    };

    document.getElementById('classificationSelect').onchange = () => {
        if (geojsonLayer) cargarMapa();
    };

    document.getElementById('labelSelect').onchange = (e) => {
        const selected = e.target.value;
        geojsonLayer.eachLayer(layer => {
            if (layer.feature.properties.NOMBRE === selected) {
                seleccionarDepartamento(selected, layer.feature.properties.Tasa_promedio, layer);
                map.fitBounds(layer.getBounds());
            }
        });
    };
});
