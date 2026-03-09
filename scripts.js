document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización ultra-básica
    const map = L.map('map').setView([-32.8, -56.0], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB'
    }).addTo(map);

    let geojsonLayer = null;

    // 2. Función de color simple (evita que el mapa se bloquee)
    function getColor(d) {
        return d > 15 ? '#a50f15' :
               d > 10 ? '#de2d26' :
               d > 5  ? '#fb6a4a' :
                        '#fee5d9';
    }

    // 3. Función Principal de Carga
    async function cargarGeoJSON() {
        console.log("Iniciando carga...");
        try {
            const response = await fetch('tasas_H_dep.geojson');
            if (!response.ok) throw new Error("No se encontró el archivo .geojson");
            
            const data = await response.json();
            console.log("Datos cargados correctamente");

            if (geojsonLayer) {
                map.removeLayer(geojsonLayer);
            }

            geojsonLayer = L.geoJSON(data, {
                style: function(feature) {
                    // Acceso directo a tus columnas: NOMBRE y Tasa_promedio
                    const valor = parseFloat(feature.properties.Tasa_promedio) || 0;
                    return {
                        fillColor: getColor(valor),
                        weight: 1,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: function(feature, layer) {
                    const nombre = feature.properties.NOMBRE || "Desconocido";
                    const tasa = feature.properties.Tasa_promedio || 0;

                    layer.bindPopup(`<b>${nombre}</b><br>Tasa: ${tasa}`);

                    layer.on('click', function() {
                        document.getElementById('detailNome').innerHTML = `<b>Depto:</b> ${nombre}`;
                        document.getElementById('detailTaxa').innerHTML = `<b>Tasa:</b> ${tasa}`;
                    });
                }
            }).addTo(map);

            // Ajustar vista automáticamente a los datos
            map.fitBounds(geojsonLayer.getBounds());

        } catch (error) {
            console.error("Error crítico:", error);
            alert("Error al cargar el mapa: " + error.message);
        }
    }

    // 4. Vincular el botón (Asegúrate que el ID sea exacto en el HTML)
    const btn = document.getElementById('btnCargarGeoJSON');
    if (btn) {
        btn.addEventListener('click', cargarGeoJSON);
    } else {
        console.error("¡ERROR! No existe un botón con id='btnCargarGeoJSON' en tu HTML");
    }
});
