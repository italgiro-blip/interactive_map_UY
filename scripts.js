document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración de Mapas Base (Tiles)
    const baseLayers = {
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'),
        streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
    };

    // Inicializar mapa centrado en Uruguay
    const map = L.map('map', { 
        layers: [baseLayers.dark] 
    }).setView([-32.8, -56.0], 7);
    
    // Referencias a elementos del DOM (HTML)
    const labelSelect = document.getElementById('labelSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');
    const baseMapSelect = document.getElementById('baseMapSelect');
    
    let geojsonLayer, legend;
    let currentBreaks = [];

    // 2. Paletas de Colores
    const colorSchemes = {
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
        reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f']
    };

    let currentPalette = colorSchemes.blues;

    // 3. Lógica de Clasificación de Datos (Quintiles e Intervalos)
    function computeBreaks(data, method) {
        const values = data.features
            .map(f => parseFloat(f.properties.Tasa_promedio) || 0)
            .sort((a, b) => a - b);
        
        if (values.length === 0) return [0, 0, 0, 0, 0, 0];
        const n = 5; // Número de clases fijo para las paletas de 5 colores

        if (method === 'equal') {
            const min = values[0];
            const max = values[values.length - 1];
            const step = (max - min) / n;
            return Array.from({ length: n + 1 }, (_, i) => min + i * step);
        }
        
        // Por defecto: Quintiles (divide la muestra en 5 partes iguales)
        return [
            values[0],
            values[Math.floor(values.length * 0.2)],
            values[Math.floor(values.length * 0.4)],
            values[Math.floor(values.length * 0.6)],
            values[Math.floor(values.length * 0.8)],
            values[values.length - 1]
        ];
    }

    function getColor(v, breaks) {
        for (let i = 0; i < breaks.length - 1; i++) {
            if (v >= breaks[i] && v <= breaks[i+1]) return currentPalette[i];
        }
        return currentPalette[currentPalette.length - 1];
    }

    // 4. Función Principal de Carga
    const cargarGeoJSON = () => {
        // El archivo debe estar en la misma carpeta en GitHub
        fetch('tasas_H_dep.geojson')
            .then(res => {
                if (!res.ok) throw new Error("Archivo GeoJSON no encontrado");
                return res.json();
            })
            .then(data => {
                // Calcular rangos según el método seleccionado
                currentBreaks = computeBreaks(data, classificationSelect.value);
                
                // Limpiar capa anterior si existe
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                
                // Limpiar el selector de departamentos
                labelSelect.innerHTML = '<option value="">Seleccione Departamento...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: (f) => ({
                        fillColor: getColor(parseFloat(f.properties.Tasa_promedio) || 0, currentBreaks),
                        weight: 1.5,
                        color: 'white',
                        fillOpacity: 0.8
                    }),
                    onEachFeature: (f, layer) => {
                        const nombre = f.properties.NOMBRE || "Sin nombre";
                        const tasa = f.properties.Tasa_promedio || 0;
                        
                        // Evento al hacer clic en un departamento
                        layer.on('click', () => seleccionarDepto(nombre, tasa, layer));
                        
                        // Llenar el dropdown
                        labelSelect.add(new Option(nombre, nombre));
                    }
                }).addTo(map);

                addLegend();
                map.fitBounds(geojsonLayer.getBounds());
            })
            .catch(err => {
                console.error(err);
                alert("Error al cargar el GeoJSON. Revisa la consola (F12).");
            });
    };

    // 5. Interacción y UI
    function seleccionarDepto(nombre, tasa, layer) {
        // Actualizar panel de detalles
        document.getElementById('detailNome').innerHTML = `<b>Departamento:</b> ${nombre}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Tasa Promedio:</b> ${tasa}`;
        
        // Sincronizar el select
        labelSelect.value = nombre;

        // Resetear estilos y resaltar el seleccionado
        geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
        layer.setStyle({ 
            color: '#ffff00', 
            weight: 4, 
            fillOpacity: 0.9 
        });
        
        layer.bringToFront();
        
        // Tooltip dinámico
        layer.bindTooltip(`<b>${nombre}</b><br>Tasa: ${tasa}`, {
            direction: 'top',
            sticky: true
        }).openTooltip();
    }

    function addLegend() {
        if (legend) map.removeControl(legend);
        
        legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-container');
            let html = '<strong>Tasa Promedio</strong><br>';
            
            for (let i = 0; i < currentBreaks.length - 1; i++) {
                html += `
                    <div class="legend-item" style="display: flex; align-items: center; margin-bottom: 4px;">
                        <div class="legend-color" style="background:${currentPalette[i]}; width: 18px; height: 18px; margin-right: 8px; border: 1px solid #fff;"></div>
                        <span>${currentBreaks[i].toFixed(1)} - ${currentBreaks[i+1].toFixed(1)}</span>
                    </div>`;
            }
            div.innerHTML = html;
            return div;
        };
        legend.addTo(map);
    }

    // 6. Listeners de Controles
    document.getElementById('btnCargarGeoJSON').onclick = cargarGeoJSON;

    baseMapSelect.onchange = (e) => {
        Object.values(baseLayers).forEach(l => map.removeLayer(l));
        baseLayers[e.target.value].addTo(map);
    };

    paletteSelect.onchange = (e) => {
        currentPalette = colorSchemes[e.target.value];
        if (geojsonLayer) cargarGeoJSON(); // Recargar para aplicar colores
    };

    classificationSelect.onchange = () => {
        if (geojsonLayer) cargarGeoJSON(); // Recargar para aplicar cálculos
    };

    labelSelect.onchange = (e) => {
        geojsonLayer.eachLayer(layer => {
            if (layer.feature.properties.NOMBRE === e.target.value) {
                seleccionarDepto(
                    layer.feature.properties.NOMBRE, 
                    layer.feature.properties.Tasa_promedio, 
                    layer
                );
