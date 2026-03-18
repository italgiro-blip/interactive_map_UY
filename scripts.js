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
    let breaks = [0, 5, 10, 15, 20]; 

    // --- FUNCIÓN CLAVE: Extraer el valor numérico sin importar el nombre de la columna ---
    function getValor(props) {
        // Busca cualquier propiedad que contenga "Tasa" o usa la primera que sea numérica
        const valor = props.Tasa_promedio || props.tasa_promedio || props.Tasa || props.value || 0;
        return parseFloat(valor);
    }

    // 2. LÓGICA DE CLASIFICACIÓN (ESTADÍSTICOS)
    function calcularBreaks(valores, metodo) {
        const v = valores.map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (v.length < 5) return [0, 5, 10, 15, 20];
        
        const min = v[0], max = v[v.length - 1];

        if (metodo === 'equal') {
            const step = (max - min) / 5;
            return [min, min + step, min + step * 2, min + step * 3, min + step * 4];
        } else {
            // Quintiles Reales (Cálculo exacto para que los estadísticos funcionen)
            return [
                v[0],
                v[Math.floor(v.length * 0.2)],
                v[Math.floor(v.length * 0.4)],
                v[Math.floor(v.length * 0.6)],
                v[Math.floor(v.length * 0.8)]
            ];
        }
    }

    function getColor(d, palette) {
        const val = parseFloat(d);
        const colors = {
            'blues': ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
            'reds':  ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
            'greens': ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
            'purples': ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
            'yellows': ['#ffffd4', '#fed98e', '#fe9929', '#d95f02', '#993404']
        };
        const p = colors[palette] || colors.blues;
        
        if (val >= breaks[4]) return p[4];
        if (val >= breaks[3]) return p[3];
        if (val >= breaks[2]) return p[2];
        if (val >= breaks[1]) return p[1];
        return p[0];
    }

    // 3. ACTUALIZAR LEYENDA E INTERACTIVIDAD
    function actualizarLeyenda(palette) {
        const ext = document.querySelector('.legend-horizontal');
        if (ext) ext.remove();
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let h = '<div class="legend-container">';
            breaks.forEach((v, i) => {
                const c = getColor(v + 0.0001, palette);
                const txt = breaks[i+1] ? `${v.toFixed(1)}-${breaks[i+1].toFixed(1)}` : `${v.toFixed(1)}+`;
                h += `<div class="legend-item" id="leg-${i}"><div class="legend-color" style="background:${c}"></div><div class="legend-text">${txt}</div></div>`;
            });
            div.innerHTML = h + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    function marcarRangoActivo(valor) {
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        let idx = 0;
        const valNum = parseFloat(valor);
        for (let i = 4; i >= 0; i--) { if (valNum >= breaks[i]) { idx = i; break; } }
        const items = document.querySelectorAll('.legend-item');
        if (items[idx]) items[idx].classList.add('active-legend');
    }

    // 4. RENDERIZADO
    function renderizarMapa() {
        if (!datosOriginales) return;
        const palette = document.getElementById('paletteSelect').value;
        const metodo = document.getElementById('classificationSelect').value;

        // Extraer valores para recalcular estadísticos
        const valores = datosOriginales.features.map(f => getValor(f.properties));
        breaks = calcularBreaks(valores, metodo);

        if (geojsonLayer) map.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJSON(datosOriginales, {
            style: (f) => {
                const val = getValor(f.properties);
                return { fillColor: getColor(val, palette), weight: 1.5, color: 'white', fillOpacity: 0.7 };
            },
            onEachFeature: (f, layer) => {
                const nombre = f.properties.NOMBRE || f.properties.nombre || "Sin nombre";
                const valor = getValor(f.properties);

                // ETIQUETA (TOOLTIP) - CORREGIDO PARA MOSTRAR VALOR
                layer.bindTooltip(`<b>${nombre}</b><br>Tasa: ${valor.toFixed(2)}`, { 
                    sticky: true, 
                    className: 'custom-tooltip' 
                });

                layer.on('click', (e) => {
                    document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${nombre}`;
                    document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${valor.toFixed(2)}`;
                    document.getElementById('labelSelect').value = nombre;
                    map.fitBounds(e.target.getBounds(), { padding: [50, 50] });
                    marcarRangoActivo(valor);
                });
            }
        }).addTo(map);
        actualizarLeyenda(palette);
    }

    // 5. CARGA Y LISTENERS
    async function cargarGeoJSON() {
        const btn = document.getElementById('btnCargarGeoJSON');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> CARGANDO...';

        try {
            const res = await fetch('tasas_H_dep.geojson');
            datosOriginales = await res.json();

            const sel = document.getElementById('labelSelect');
            sel.innerHTML = '<option value="">Seleccione Unidad...</option>';
            datosOriginales.features.forEach(f => {
                const n = f.properties.NOMBRE || f.properties.nombre;
                const o = document.createElement('option');
                o.value = n; o.textContent = n; sel.appendChild(o);
            });

            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) {
            alert("Error al cargar el archivo. Revisa que el nombre sea tasas_H_dep.geojson");
        } finally {
            btn.disabled = false;
            btn.innerText = 'IMPORTAR DATASET';
        }
    }

    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });
});
