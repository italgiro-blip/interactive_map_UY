document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración Inicial
    const map = L.map('map').setView([-32.8, -56.0], 7);

    // Diccionario de Mapas Base
    const baseLayers = {
        'dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' }),
        'streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }),
        'satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' })
    };

    baseLayers.dark.addTo(map); // Capa por defecto

    let geojsonLayer = null;

    // 2. Control de Mapas Base (Interactividad)
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
        baseLayers[e.target.value].addTo(map);
    });

    // 3. Colores Dinámicos (Preparado para las paletas del HTML)
    function getColor(d, palette = 'blues') {
        const colors = {
            'reds':    ['#fee5d9', '#fb6a4a', '#de2d26', '#a50f15'],
            'blues':   ['#eff3ff', '#6baed6', '#3182bd', '#08519c'],
            'greens':  ['#edf8e9', '#74c476', '#31a354', '#006d2c'],
            'purples': ['#f2f0f7', '#9e9ac8', '#756bb1', '#54278f'],
            'yellows': ['#ffffd4', '#fed98e', '#fe9929', '#cc4c02']
        };
        const p = colors[palette] || colors.blues;
        return d > 15 ? p[3] : d > 10 ? p[2] : d > 5 ? p[1] : p[0];
    }

    // 4. Carga de Datos y Llenado de Lista Lateral
    async function cargarGeoJSON() {
        try {
            const response = await fetch('tasas_H_dep.geojson');
            const data = await response.json();
            
            if (geojsonLayer) map.removeLayer(geojsonLayer);

            const selectedPalette = document.getElementById('paletteSelect').value;
            const labelSelect = document.getElementById('labelSelect');
            labelSelect.innerHTML = '<option value="">Seleccione Departamento</option>';

            geojsonLayer = L.geoJSON(data, {
                style: (f) => ({
                    fillColor: getColor(parseFloat(f.properties.Tasa_promedio), selectedPalette),
                    weight: 1, opacity: 1, color: 'white', fillOpacity: 0.7
                }),
                onEachFeature: (f, layer) => {
                    const { NOMBRE, Tasa_promedio } = f.properties;
                    
                    // Llenar el select lateral
                    const option = document.createElement('option');
                    option.value = NOMBRE;
                    option.textContent = NOMBRE;
                    labelSelect.appendChild(option);

                    layer.bindPopup(`<b>${NOMBRE}</b><br>Tasa: ${Tasa_promedio}`);
                    
                    layer.on('click', () => {
                        actualizarInfo(NOMBRE, Tasa_promedio);
                    });
                }
            }).addTo(map);

            map.fitBounds(geojsonLayer.getBounds());
        } catch (error) {
            console.error("Error:", error);
        }
    }

    function actualizarInfo(n, t) {
        document.getElementById('detailNome').innerHTML = `<b>Unidad:</b> ${n}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Valor:</b> ${t}`;
    }

    // Eventos de los botones y selects
    document.getElementById('btnCargarGeoJSON').addEventListener('click', cargarGeoJSON);
    
    // Cambiar color en tiempo real si ya hay datos
    document.getElementById('paletteSelect').addEventListener('change', () => {
        if (geojsonLayer) cargarGeoJSON(); 
    });
});
