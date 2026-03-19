document.addEventListener('DOMContentLoaded', () => {
    // 1. INICIALIZACIÓN DEL MAPA
    const map = L.map('map', { zoomSnap: 0.5, attributionControl: false }).setView([-32.8, -56.0], 7);
    
    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };
    baseLayers.dark.addTo(map);

    let geojsonLayer = null;
    let datosOriginales = null; 
    let breaks = []; // Se calculará dinámicamente

    // --- FUNCIÓN CLAVE: Extraer valor numérico ---
    function getValor(props) {
        const valor = props.Tasa_promedio || props.tasa_promedio || props.Tasa || props.value || 0;
        return parseFloat(valor);
    }

    // 2. LÓGICA DE CLASIFICACIÓN (ESTADÍSTICOS CORREGIDOS)
    function calcularBreaks(valores, metodo) {
        const v = valores.filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (v.length < 5) return [0, 5, 10, 15, 20];
        
        const min = v[0];
        const max = v[v.length - 1];

        if (metodo === 'equal') {
            const step = (max - min) / 5;
            return [min, min + step, min + step * 2, min + step * 3, min + step * 4];
        } else {
            // Quintiles (N-1 para evitar desbordamiento de índice)
            const n = v.length - 1;
            return [
                v[0],
                v[Math.floor(n * 0.2)],
                v[Math.floor(n * 0.4)],
                v[Math.floor(n * 0.6)],
                v[Math.floor(n * 0.8)]
            ];
        }
    }

    function getColor(val, palette) {
        const colors = {
            'blues': ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
            'reds':  ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
            'greens': ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
            'purples': ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
            'yellows': ['#ffffd4', '#fed98e', '#fe9929', '#d95f02', '#993404']
        };
        const p = colors[palette] || colors.blues;
        
        // Lógica de rangos (de mayor a menor para asignar el color correcto)
        if (val >= breaks[4]) return p[4];
        if (val >= breaks[3]) return p[3];
        if (val >= breaks[2]) return p[2];
        if (val >= breaks[1]) return p[1];
        return p[0];
    }

    // 3. ACTUALIZAR LEYENDA E INTERACTIVIDAD
    function actualizarLeyenda(palette) {
        const oldLegend = document.querySelector('.legend-horizontal');
        if (oldLegend) oldLegend.remove();

        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let h = '<div class="legend-container">';
            breaks.forEach((v, i) => {
                const c = getColor(v, palette);
                const proximo = breaks[i+1] ? breaks[i+1].toFixed(1) : '+';
                const txt = breaks[i+1] ? `${v.toFixed(1)} - ${proximo}` : `${v.toFixed(1)}+`;
                h += `<div class="legend-item" id="leg-${i}">
                        <div class="legend-color" style="background:${c}"></div>
                        <div class="legend-text">${txt}</div>
                      </div>`;
            });
            div.innerHTML = h + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    function marcarRangoActivo(valor) {
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        let idx = 0;
        for (let i = 4; i >= 0; i--) { 
            if (valor >= breaks[i]) { idx = i; break; } 
        }
        const activeItem = document.getElementById(`leg-${idx}`);
        if (activeItem) activeItem.classList.add('active-legend');
    }

    // 4. RENDERIZADO PRINCIPAL
    function renderizarMapa() {
        if (!datosOriginales) return;
        const palette = document.getElementById('paletteSelect').value;
        const metodo = document.getElementById('classificationSelect').value;

        // IMPORTANTE: Recalcular breaks ANTES de pintar
        const valores = datosOriginales.features.map(f => getValor(f.properties));
        breaks = calcularBreaks(valores, metodo);

        if (geojsonLayer) map.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJSON(datosOriginales, {
            style: (f) => {
                const val = getValor(f.properties);
                return { 
                    fillColor: getColor(val, palette), 
                    weight: 1.5, 
                    color: 'white', 
                    fillOpacity: 0.8 
                };
            },
            onEachFeature: (f, layer) => {
                const nombre = f.properties.NOMBRE || f.properties.nombre || "Sin nombre";
                const valor = getValor(f.properties);

                layer.bindTooltip(`<b>${nombre}</b><br>Tasa: ${valor.toFixed(2)}`, { sticky: true });

                layer.on({
                    mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({ weight: 3, color: '#ffff00', fillOpacity: 0.9 });
                    },
                    mouseout: (e) => {
                        geojsonLayer.resetStyle(e.target);
                    },
                    click: (e) => {
                        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${nombre}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${valor.toFixed(2)}`;
                        marcarRangoActivo(valor);
                        map.fitBounds(e.target.getBounds(), { padding: [20, 20] });
                    }
                });
            }
        }).addTo(map);

        actualizarLeyenda(palette);
    }

    // 5. CARGA Y EVENTOS
    async function cargarGeoJSON() {
        const btn = document.getElementById('btnCargarGeoJSON');
        btn.disabled = true;
        btn.innerHTML = 'CARGANDO...';

        try {
            const res = await fetch('tasas_H_dep.geojson');
            if (!res.ok) throw new Error("No se encontró el archivo");
            datosOriginales = await res.json();

            // Poblar el select de búsqueda
            const sel = document.getElementById('labelSelect');
            sel.innerHTML = '<option value="">Seleccione Unidad...</option>';
            
            // Ordenar nombres alfabéticamente
            const nombres = datosOriginales.features
                .map(f => f.properties.NOMBRE || f.properties.nombre)
                .sort();

            nombres.forEach(n => {
                const o = document.createElement('option');
                o.value = n; o.textContent = n; sel.appendChild(o);
            });

            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'IMPORTAR DATASET';
        }
    }

    // --- LISTENERS ---
    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
    
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });

    // CORRECCIÓN: Listener para el desplegable de nombres
    document.getElementById('labelSelect').addEventListener('change', (e) => {
        const seleccionado = e.target.value;
        if (!seleccionado || !geojsonLayer) return;

        geojsonLayer.eachLayer(layer => {
            const nombreCapa = layer.feature.properties.NOMBRE || layer.feature.properties.nombre;
            if (nombreCapa === seleccionado) {
                layer.fire('click'); // Esto dispara el zoom y los detalles automáticamente
            }
        });
    });
});
