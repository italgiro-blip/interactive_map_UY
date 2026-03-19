document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN DEL MAPA ---
    const map = L.map('map', { 
        zoomSnap: 0.5, 
        attributionControl: false 
    }).setView([-32.8, -56.0], 7);
    
    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };
    baseLayers.dark.addTo(map);

    let geojsonLayer = null;
    let datosOriginales = null;
    let breaks = [];

    // --- 2. FUNCIONES DE APOYO ---
    function getValor(props) {
        // Busca cualquier propiedad que suene a tasa o valor numérico
        return parseFloat(props.Tasa_promedio || props.tasa_promedio || props.Tasa || props.value || props.valor || 0);
    }

    function calcularBreaks(valores, metodo) {
        const v = valores.filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (v.length < 5) return [0, 5, 10, 15, 20];
        
        const min = v[0];
        const max = v[v.length - 1];

        switch(metodo) {
            case 'equal':
                const step = (max - min) / 5;
                return [min, min + step, min + step * 2, min + step * 3, min + step * 4];
            case 'jenks':
                // Jenks simplificado por detección de saltos bruscos
                const saltos = v.map((val, i) => ({ i, d: i > 0 ? val - v[i-1] : 0 })).sort((a, b) => b.d - a.d);
                const idxs = saltos.slice(0, 4).map(s => s.i).sort((a, b) => a - b);
                return [v[0], v[idxs[0]], v[idxs[1]], v[idxs[2]], v[idxs[3]]];
            default: // Quintiles
                const n = v.length - 1;
                return [v[0], v[Math.floor(n * 0.2)], v[Math.floor(n * 0.4)], v[Math.floor(n * 0.6)], v[Math.floor(n * 0.8)]];
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
        for (let i = 4; i >= 0; i--) {
            if (val >= breaks[i]) return p[i];
        }
        return p[0];
    }

    // --- 3. ACTUALIZACIÓN DE UI ---
    function actualizarLeyenda(palette) {
        const old = document.querySelector('.legend-horizontal');
        if (old) old.remove();
        
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let html = '<div class="legend-container">';
            breaks.forEach((v, i) => {
                const c = getColor(v, palette);
                const label = breaks[i+1] ? `${v.toFixed(1)} - ${breaks[i+1].toFixed(1)}` : `${v.toFixed(1)}+`;
                html += `<div class="legend-item" id="leg-${i}">
                            <div class="legend-color" style="background:${c}"></div>
                            <div class="legend-text">${label}</div>
                         </div>`;
            });
            div.innerHTML = html + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    function renderizarMapa() {
        if (!datosOriginales) return;
        
        const palette = document.getElementById('paletteSelect').value;
        const metodo = document.getElementById('classificationSelect').value;
        const valores = datosOriginales.features.map(f => getValor(f.properties));
        
        breaks = calcularBreaks(valores, metodo);

        if (geojsonLayer) map.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJSON(datosOriginales, {
            style: (f) => ({
                fillColor: getColor(getValor(f.properties), palette),
                weight: 1.2, color: 'white', fillOpacity: 0.75
            }),
            onEachFeature: (f, layer) => {
                const nombre = f.properties.NOMBRE || f.properties.nombre || "Sin Nombre";
                const valor = getValor(f.properties);

                layer.bindTooltip(`<b>${nombre}</b><br>Tasa: ${valor.toFixed(2)}`, { 
                    sticky: true, 
                    className: 'custom-tooltip' 
                });

                layer.on({
                    click: (e) => {
                        const card = document.getElementById('infoCard');
                        card.style.display = 'block';
                        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${nombre}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${valor.toFixed(2)}`;
                        
                        document.getElementById('labelSelect').value = nombre;

                        // Resaltar leyenda
                        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
                        for (let i = 4; i >= 0; i--) {
                            if (valor >= breaks[i]) {
                                document.getElementById(`leg-${i}`)?.classList.add('active-legend');
                                break;
                            }
                        }
                        map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
                    },
                    mouseover: (e) => { 
                        e.target.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.9 }); 
                    },
                    mouseout: (e) => { 
                        geojsonLayer.resetStyle(e.target); 
                    }
                });
            }
        }).addTo(map);
        
        actualizarLeyenda(palette);
    }

    // --- 4. LISTENERS DE EVENTOS ---
    document.getElementById('btnCargarGeoJSON').addEventListener('click', async () => {
        try {
            const res = await fetch('tasas_H_dep.geojson');
            if (!res.ok) throw new Error("No se pudo leer 'tasas_H_dep.geojson'. Verifica que el archivo exista y estés usando un servidor local.");
            
            datosOriginales = await res.json();
            
            const sel = document.getElementById('labelSelect');
            sel.innerHTML = '<option value="">Seleccione Unidad...</option>';
            
            const nombres = datosOriginales.features
                .map(f => f.properties.NOMBRE || f.properties.nombre)
                .filter(n => n)
                .sort();

            nombres.forEach(n => {
                const o = document.createElement('option');
                o.value = n; o.innerText = n; sel.appendChild(o);
            });

            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) {
            alert("Error: " + err.message);
        }
    });

    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });

    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
    
    document.getElementById('labelSelect').addEventListener('change', (e) => {
        const buscado = e.target.value;
        if (!buscado) return;
        geojsonLayer.eachLayer(l => {
            const n = l.feature.properties.NOMBRE || l.feature.properties.nombre;
            if (n === buscado) l.fire('click');
        });
    });
});
