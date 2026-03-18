document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', { zoomSnap: 0.5 }).setView([-32.8, -56.0], 7);

    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' }),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' })
    };
    baseLayers.dark.addTo(map);

    let geojsonLayer = null;
    let datosOriginales = null; 
    let breaks = [0, 5, 10, 15]; 

    // 1. CÁLCULO DE RANGOS ESTADÍSTICOS
    function calcularBreaks(valores, metodo) {
        if (!valores || valores.length === 0) return [0, 5, 10, 15];
        
        // Limpiar y ordenar valores numéricos
        const v = valores.map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
        const min = v[0];
        const max = v[v.length - 1];

        if (metodo === 'equal') {
            const step = (max - min) / 4;
            return [min, min + step, min + step * 2, min + step * 3];
        } else if (metodo === 'quartiles') {
            return [
                v[0],
                v[Math.floor(v.length * 0.25)],
                v[Math.floor(v.length * 0.5)],
                v[Math.floor(v.length * 0.75)]
            ];
        } else { 
            // Jenks Simplificado (Natural Breaks)
            return [min, max * 0.15, max * 0.40, max * 0.70];
        }
    }

    // 2. FUNCIÓN DE COLOR (Basada en la paleta y los breaks)
    function getColor(d, palette) {
        const value = parseFloat(d) || 0;
        const colors = {
            'blues':   ['#eff3ff', '#6baed6', '#3182bd', '#08519c'],
            'reds':    ['#fee5d9', '#fb6a4a', '#de2d26', '#a50f15'],
            'greens':  ['#edf8e9', '#74c476', '#31a354', '#006d2c'],
            'purples': ['#f2f0f7', '#9e9ac8', '#756bb1', '#54278f'],
            'yellows': ['#ffffd4', '#fed98e', '#fe9929', '#cc4c02']
        };
        const p = colors[palette] || colors.blues;
        
        // Lógica de asignación por rangos
        if (value >= breaks[3]) return p[3];
        if (value >= breaks[2]) return p[2];
        if (value >= breaks[1]) return p[1];
        return p[0];
    }

    // 3. ACTUALIZAR LEYENDA (Sincronizada con los colores del mapa)
    function actualizarLeyenda(palette) {
        const existente = document.querySelector('.legend-horizontal');
        if (existente) existente.remove();

        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let html = '<div class="legend-container">';
            
            breaks.forEach((val, i) => {
                // Usamos un valor representativo del rango para obtener el color exacto
                const color = getColor(val + 0.001, palette);
                const nextVal = breaks[i+1];
                const label = nextVal ? `${val.toFixed(1)} - ${nextVal.toFixed(1)}` : `${val.toFixed(1)}+`;
                
                html += `
                    <div class="legend-item">
                        <div class="legend-color" style="background:${color}"></div>
                        <div class="legend-text">${label}</div>
                    </div>`;
            });
            
            div.innerHTML = html + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    // 4. RENDERIZADO DE CAPAS
    function renderizarMapa() {
        if (!datosOriginales) return;

        const palette = document.getElementById('paletteSelect').value;
        const metodo = document.getElementById('classificationSelect').value;

        // Recalcular breaks
        const valores = datosOriginales.features.map(f => f.properties.Tasa_promedio);
        breaks = calcularBreaks(valores, metodo);

        if (geojsonLayer) map.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJSON(datosOriginales, {
            style: (f) => ({
                fillColor: getColor(f.properties.Tasa_promedio, palette),
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.8
            }),
            onEachFeature: (f, layer) => {
                const { NOMBRE, Tasa_promedio } = f.properties;
                layer.on({
                    mouseover: (e) => { e.target.setStyle({ weight: 3, fillOpacity: 0.9 }); },
                    mouseout: (e) => { geojsonLayer.resetStyle(e.target); },
                    click: (e) => {
                        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${NOMBRE}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${Tasa_promedio}`;
                        document.getElementById('labelSelect').value = NOMBRE;
                        map.fitBounds(e.target.getBounds(), { padding: [50, 50] });
                    }
                });
                layer.bindPopup(`<b>${NOMBRE}</b><br>Tasa: ${Tasa_promedio}`);
            }
        }).addTo(map);

        actualizarLeyenda(palette);
    }

    // 5. CARGA DE ARCHIVO
    async function cargarGeoJSON() {
        const btn = document.getElementById('btnCargarGeoJSON');
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> CARGANDO...';
            
            const response = await fetch('tasas_H_dep.geojson');
            datosOriginales = await response.json();

            // Rellenar selector de nombres
            const labelSelect = document.getElementById('labelSelect');
            labelSelect.innerHTML = '<option value="">Seleccione Unidad...</option>';
            datosOriginales.features
                .map(f => f.properties.NOMBRE)
                .sort()
                .forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n; opt.textContent = n;
                    labelSelect.appendChild(opt);
                });

            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) {
            console.error(err);
            alert("Error: No se pudo procesar el archivo. Revisa el formato GeoJSON.");
        } finally {
            btn.disabled = false;
            btn.innerText = 'IMPORTAR DATASET';
        }
    }

    // 6. EVENTOS (Vincular todo)
    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
    
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });

    document.getElementById('labelSelect').addEventListener('change', (e) => {
        const dep = e.target.value;
        if (!dep || !geojsonLayer) return;
        geojsonLayer.eachLayer((layer) => {
            if (layer.feature.properties.NOMBRE === dep) {
                map.fitBounds(layer.getBounds(), { padding: [100, 100] });
                layer.openPopup();
                document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${dep}`;
                document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${layer.feature.properties.Tasa_promedio}`;
            }
        });
    });
});
