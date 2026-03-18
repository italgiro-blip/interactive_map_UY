document.addEventListener('DOMContentLoaded', () => {
    // 1. MAPA
    const map = L.map('map', { zoomSnap: 0.5, attributionControl: false }).setView([-32.8, -56.0], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    let geojsonLayer = null;
    let datosOriginales = null; 
    let breaks = []; 

    // 2. CÁLCULO DE 5 RANGOS
    function calcularBreaks(valores, metodo) {
        const v = valores.map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (v.length < 5) return [0, 5, 10, 15, 20];
        
        const min = v[0], max = v[v.length - 1];
        if (metodo === 'equal') {
            const step = (max - min) / 5;
            return [min, min + step, min + step * 2, min + step * 3, min + step * 4];
        } else {
            // Quintiles (20%, 40%, 60%, 80%)
            return [v[0], v[Math.floor(v.length*0.2)], v[Math.floor(v.length*0.4)], v[Math.floor(v.length*0.6)], v[Math.floor(v.length*0.8)]];
        }
    }

    function getColor(d, palette) {
        const val = parseFloat(d) || 0;
        const colors = {
            'blues': ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
            'reds':  ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
            'greens': ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c']
        };
        const p = colors[palette] || colors.blues;
        for (let i = 4; i >= 0; i--) { if (val >= breaks[i]) return p[i]; }
        return p[0];
    }

    // 3. INTERACTIVIDAD DE LEYENDA
    function marcarRangoActivo(valor) {
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        let idx = 0;
        for (let i = 4; i >= 0; i--) { if (valor >= breaks[i]) { idx = i; break; } }
        const items = document.querySelectorAll('.legend-item');
        if (items[idx]) items[idx].classList.add('active-legend');
    }

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
                h += `<div class="legend-item" id="leg-${i}"><div class="legend-color" style="background:${c}"></div><div class="legend-text">${txt}</div></div>`;
            });
            div.innerHTML = h + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    // 4. RENDERIZADO
    function renderizarMapa() {
        if (!datosOriginales) return;
        const palette = document.getElementById('paletteSelect').value;
        const metodo = document.getElementById('classificationSelect').value;
        const valores = datosOriginales.features.map(f => f.properties.Tasa_promedio);
        breaks = calcularBreaks(valores, metodo);

        if (geojsonLayer) map.removeLayer(geojsonLayer);
        geojsonLayer = L.geoJSON(datosOriginales, {
            style: (f) => ({ fillColor: getColor(f.properties.Tasa_promedio, palette), weight: 1.5, color: 'white', fillOpacity: 0.7 }),
            onEachFeature: (f, layer) => {
                layer.on('click', (e) => {
                    document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${f.properties.NOMBRE}`;
                    document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${f.properties.Tasa_promedio}`;
                    document.getElementById('labelSelect').value = f.properties.NOMBRE;
                    map.fitBounds(e.target.getBounds(), { padding: [50, 50] });
                    marcarRangoActivo(f.properties.Tasa_promedio);
                });
            }
        }).addTo(map);
        actualizarLeyenda(palette);
    }

    // 5. CARGA DE DATOS (IMPORTANTE)
    async function cargarGeoJSON() {
        const btn = document.getElementById('btnCargarGeoJSON');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> CARGANDO...';

        try {
            const res = await fetch('tasas_H_dep.geojson'); // ASEGÚRATE QUE EL NOMBRE SEA EXACTO
            if (!res.ok) throw new Error("No se encontró el archivo");
            datosOriginales = await res.json();

            const sel = document.getElementById('labelSelect');
            sel.innerHTML = '<option value="">Seleccione Unidad...</option>';
            datosOriginales.features.forEach(f => {
                const o = document.createElement('option');
                o.value = f.properties.NOMBRE; o.textContent = f.properties.NOMBRE;
                sel.appendChild(o);
            });

            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) {
            console.error(err);
            alert("ERROR: No se pudo cargar el archivo. ¿Estás usando Live Server?");
            btn.disabled = false; // Reactivar si falla
            btn.innerText = 'IMPORTAR DATASET';
        } finally {
            btn.disabled = false;
            btn.innerText = 'IMPORTAR DATASET';
        }
    }

    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
});
