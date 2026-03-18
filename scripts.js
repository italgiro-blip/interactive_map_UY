document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del Mapa
    const map = L.map('map', {
        zoomSnap: 0.5,
        wheelDebounceTime: 150
    }).setView([-32.8, -56.0], 7);

    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' }),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' })
    };
    baseLayers.dark.addTo(map);

    let geojsonLayer = null;

    // 2. Colores y Rangos (Configurados para tu leyenda CSS)
    const thresholds = [0, 5, 10, 15];
    function getColor(d, palette) {
        const colors = {
            'blues':  ['#eff3ff', '#6baed6', '#3182bd', '#08519c'],
            'reds':   ['#fee5d9', '#fb6a4a', '#de2d26', '#a50f15'],
            'greens': ['#edf8e9', '#74c476', '#31a354', '#006d2c']
        };
        const p = colors[palette] || colors.blues;
        return d > 15 ? p[3] : d > 10 ? p[2] : d > 5 ? p[1] : p[0];
    }

    // 3. Crear Leyenda Dinámica (Usa tus clases CSS)
    function crearLeyenda(palette) {
        // Eliminar leyenda anterior si existe
        const oldLegend = document.querySelector('.legend-horizontal');
        if (oldLegend) oldLegend.remove();

        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let html = '<div class="legend-container">';
            
            thresholds.forEach((t, i) => {
                const color = getColor(t + 1, palette);
                const nextT = thresholds[i+1] ? `-${thresholds[i+1]}` : '+';
                html += `
                    <div class="legend-item" onclick="filtrarMapa(${t})">
                        <div class="legend-color" style="background:${color}"></div>
                        <div class="legend-text">${t}${nextT}</div>
                    </div>`;
            });
            
            html += '</div>';
            div.innerHTML = html;
            return div;
        };
        legend.addTo(map);
    }

    // 4. Función de Carga Principal
    async function cargarGeoJSON() {
        try {
            const response = await fetch('tasas_H_dep.geojson');
            const data = await response.json();
            const palette = document.getElementById('paletteSelect').value;

            if (geojsonLayer) map.removeLayer(geojsonLayer);

            geojsonLayer = L.geoJSON(data, {
                style: (f) => ({
                    fillColor: getColor(parseFloat(f.properties.Tasa_promedio), palette),
                    weight: 1.5, color: 'white', fillOpacity: 0.8
                }),
                onEachFeature: (f, layer) => {
                    layer.on({
                        mouseover: (e) => { e.target.setStyle({ fillOpacity: 1, weight: 3 }); },
                        mouseout: (e) => { geojsonLayer.resetStyle(e.target); },
                        click: (e) => {
                            const p = f.properties;
                            document.getElementById('detailNome').innerHTML = `<b>Depto:</b> ${p.NOMBRE}`;
                            document.getElementById('detailTaxa').innerHTML = `<b>Tasa:</b> ${p.Tasa_promedio}`;
                            map.fitBounds(e.target.getBounds());
                        }
                    });
                }
            }).addTo(map);

            crearLeyenda(palette);
            map.fitBounds(geojsonLayer.getBounds());

        } catch (err) {
            console.error("Error cargando datos:", err);
        }
    }

    // 5. Listeners de Interactividad
    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });

    document.getElementById('paletteSelect').addEventListener('change', () => {
        if (geojsonLayer) cargarGeoJSON();
    });
});
