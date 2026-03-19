document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURACIÓN INICIAL DEL MAPA
    const map = L.map('map', { 
        zoomSnap: 0.5, 
        attributionControl: false 
    }).setView([-32.8, -56.0], 7);
    
    // Capas base: Definición clara para intercambio
    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };
    baseLayers.dark.addTo(map);

    let geojsonLayer = null;
    let datosOriginales = null; 
    let breaks = []; 

    // Extraer valor numérico de las propiedades
    function getValor(props) {
        const v = props.Tasa_promedio || props.tasa_promedio || props.Tasa || props.value || 0;
        return parseFloat(v);
    }

    // 2. LÓGICA ESTADÍSTICA (NUEVOS MÉTODOS)
    function calcularBreaks(valores, metodo) {
        const v = valores.filter(n => !isNaN(n)).sort((a, b) => a - b);
        if (v.length < 5) return [0, 5, 10, 15, 20];
        
        const min = v[0], max = v[v.length - 1];

        switch(metodo) {
            case 'equal':
                const step = (max - min) / 5;
                return [min, min + step, min + step * 2, min + step * 3, min + step * 4];
            case 'quartile':
                return [v[0], v[Math.floor(v.length * 0.25)], v[Math.floor(v.length * 0.5)], v[Math.floor(v.length * 0.75)], v[Math.floor(v.length * 0.95)]];
            case 'jenks':
                // Jenks simplificado por desviaciones
                const saltos = v.map((val, i) => ({ i, d: i > 0 ? val - v[i-1] : 0 })).sort((a, b) => b.d - a.d);
                const idxs = saltos.slice(0, 4).map(s => s.i).sort((a, b) => a - b);
                return [v[0], v[idxs[0]], v[idxs[1]], v[idxs[2]], v[idxs[3]]];
            default: // Quintiles
                const n = v.length - 1;
                return [v[0], v[Math.floor(n * 0.2)], v[Math.floor(n * 0.4)], v[Math.floor(n * 0.6)], v[Math.floor(n * 0.8)]];
        }
    }

    // 3. PALETAS DE COLORES (CORREGIDAS)
    function getColor(val, palette) {
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

    // 4. LEYENDA DINÁMICA
    function actualizarLeyenda(palette) {
        const old = document.querySelector('.legend-horizontal');
        if (old) old.remove();
        
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let html = '<div class="legend-container">';
            breaks.forEach((v, i) => {
                const c = getColor(v + 0.00001, palette);
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

    // 5. RENDERIZACIÓN Y EVENTOS DE CAPA
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
                const nombre = f.properties.NOMBRE || f.properties.nombre || "S/N";
                const valor = getValor(f.properties);

                // Tooltip interactivo
                layer.bindTooltip(`<b>${nombre}</b><br>Tasa: ${valor.toFixed(2)}`, { sticky: true });

                layer.on({
                    click: (e) => {
                        // Actualizar panel lateral
                        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${nombre}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${valor.toFixed(2)}`;
                        
                        // Sincronizar SELECTOR (Dropdown)
                        const sel = document.getElementById('labelSelect');
                        sel.value = nombre; 

                        // Resaltar Rango en Leyenda
                        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
                        for (let i = 4; i >= 0; i--) { 
                            if (valor >= breaks[i]) { 
                                const item = document.getElementById(`leg-${i}`);
                                if(item) item.classList.add('active-legend'); 
                                break; 
                            } 
                        }
                        map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
                    },
                    mouseover: (e) => { e.target.setStyle({ weight: 3, color: '#666', fillOpacity: 0.9 }); },
                    mouseout: (e) => { geojsonLayer.resetStyle(e.target); }
                });
            }
        }).addTo(map);
        
        actualizarLeyenda(palette);
    }

    // 6. CARGA DE DATOS Y LISTENERS GLOBALES
    document.getElementById('btnCargarGeoJSON').addEventListener('click', async () => {
        try {
            const res = await fetch('tasas_H_dep.geojson');
            if (!res.ok) throw new Error("Archivo no encontrado");
            datosOriginales = await res.json();
            
            const sel = document.getElementById('labelSelect');
            sel.innerHTML = '<option value="">Seleccione Unidad...</option>';
            
            // Poblar dropdown con nombres ordenados
            const nombres = datosOriginales.features.map(f => f.properties.NOMBRE || f.properties.nombre).sort();
            nombres.forEach(n => {
                const o = document.createElement('option');
                o.value = n; o.innerText = n; sel.appendChild(o);
            });

            renderizarMapa();
            map.fitBounds(geojsonLayer.getBounds());
        } catch (err) { alert("Error: " + err.message); }
    });

    // Cambio de mapas base (CORREGIDO)
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    });

    // Listeners de controles
    document.getElementById('classificationSelect').addEventListener('change', renderizarMapa);
    document.getElementById('paletteSelect').addEventListener('change', renderizarMapa);
    
    // Listener del buscador/selector (Dropdown -> Mapa)
    document.getElementById('labelSelect').addEventListener('change', (e) => {
        const buscado = e.target.value;
        if (!buscado) return;
        geojsonLayer.eachLayer(l => {
            const n = l.feature.properties.NOMBRE || l.feature.properties.nombre;
            if (n === buscado) l.fire('click');
        });
    });
});
