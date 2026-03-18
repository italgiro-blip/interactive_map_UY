document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', { zoomSnap: 0.5, attributionControl: false }).setView([-32.8, -56.0], 7);

    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };
    baseLayers.dark.addTo(map);

    let geojsonLayer = null;
    let datosOriginales = null; 
    let breaks = []; // Se llenará con 5 valores

    // 1. CÁLCULO DE 5 DIVISIONES
    function calcularBreaks(valores, metodo) {
        const v = valores.map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (!v.length) return [0, 5, 10, 15, 20];
        
        const min = v[0];
        const max = v[v.length - 1];

        if (metodo === 'equal') {
            const step = (max - min) / 5; // 5 Divisiones
            return [min, min + step, min + step * 2, min + step * 3, min + step * 4];
        } else if (metodo === 'quartiles') {
            // Quintiles para 5 divisiones
            return [
                v[0],
                v[Math.floor(v.length * 0.2)],
                v[Math.floor(v.length * 0.4)],
                v[Math.floor(v.length * 0.6)],
                v[Math.floor(v.length * 0.8)]
            ];
        } else {
            // Natural Breaks (Aproximación para 5 rangos)
            return [min, max * 0.15, max * 0.35, max * 0.6, max * 0.8];
        }
    }

    function getColor(d, palette) {
        const val = parseFloat(d) || 0;
        const colors = {
            'blues':   ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
            'reds':    ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
            'greens':  ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
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

    // 2. RESALTAR RANGO EN LA LEYENDA
    function marcarRangoActivo(valor) {
        // Quitar clase activa de todos
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        
        // Encontrar a qué índice pertenece el valor
        let index = 0;
        if (valor >= breaks[4]) index = 4;
        else if (valor >= breaks[3]) index = 3;
        else if (valor >= breaks[2]) index = 2;
        else if (valor >= breaks[1]) index = 1;
        else index = 0;

        // Aplicar clase al elemento correspondiente
        const items = document.querySelectorAll('.legend-item');
        if (items[index]) items[index].classList.add('active-legend');
    }

    // 3. LEYENDA DINÁMICA
    function actualizarLeyenda(palette) {
        const ext = document.querySelector('.legend-horizontal');
        if (ext) ext.remove();
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let h = '<div class="legend-container">';
            breaks.forEach((v, i) => {
                const c = getColor(v + 0.001, palette);
                const txt = breaks[i+1] ? `${v.toFixed(0)}-${breaks[i+1].toFixed(0)}` : `${v.toFixed(0)}+`;
                h += `
                    <div class="legend-item" id="leg-item-${i}">
                        <div class="legend-color" style="background:${c}"></div>
                        <div class="legend-text">${txt}</div>
                    </div>`;
            });
            div.innerHTML = h + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    // 4. RENDERIZADO Y EVENTOS
    function renderizarMapa() {
        if (!datosOriginales) return;
        const palette = document.getElementById('paletteSelect').value;
        const metodo = document.getElementById('classificationSelect').value;
        const valores = datosOriginales.features.map(f => f.properties.Tasa_promedio);
        breaks = calcularBreaks(valores, metodo);

        if (geojsonLayer) map.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJSON(datosOriginales, {
            style: (f) => ({
                fillColor: getColor(f.properties.Tasa_promedio, palette),
                weight: 1.5, color: 'white', fillOpacity: 0.7
            }),
            onEachFeature: (f, layer) => {
                const { NOMBRE, Tasa_promedio } = f.properties;
                layer.bindTooltip(`<strong>${NOMBRE}</strong>`, { sticky: true, className: 'custom-tooltip' });

                layer.on({
                    click: (e) => {
                        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${NOMBRE}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${Tasa_promedio}`;
                        document.getElementById('labelSelect').value = NOMBRE;
                        map.fitBounds(e.target.getBounds(), { padding: [50, 50] });
                        
                        // INTERACTIVIDAD CON LA BARRA DE ESCALA
                        marcarRangoActivo(Tasa_promedio);
                    }
                });
            }
        }).addTo(map);
        actualizarLeyenda(palette);
    }

    async function cargarGeoJSON() {
        const btn = document.getElementById('btnCargarGeoJSON');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> CARGANDO...';
        try {
            const res = await fetch('tasas_H_dep.geojson');
            datosOriginales = await res.json();
            const sel = document.getElementById('labelSelect');
            sel.innerHTML = '<option value="">Seleccione Unidad...</option>';
            datosOriginales.features.map(f => f.properties.NOMBRE).sort().forEach(n => {
                const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
            });
            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) { alert("Error al cargar datos."); }
        finally { btn.disabled = false; btn.innerText = 'IMPORTAR DATASET'; }
    }

    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });
});
