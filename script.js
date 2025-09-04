// Función para obtener los datos de la calidad del aire, clima y heatmap horario
async function getAirQualityAndWeather() {
    const lat = 8.312;
    const lon = -73.626;
    const apiKey = '0fceb022e90eecf2c580132f9ccd74ce'; // Tu API Key

    const airQualityUrl = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const weatherUrl = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
    const hourlyAirQualityUrl = `http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        // Realizamos las solicitudes de forma paralela
        const [airQualityResponse, weatherResponse, hourlyAirQualityResponse] = await Promise.all([
            fetch(airQualityUrl),
            fetch(weatherUrl),
            fetch(hourlyAirQualityUrl)
        ]);

        // Comprobamos si la respuesta fue exitosa
        if (!airQualityResponse.ok || !weatherResponse.ok || !hourlyAirQualityResponse.ok) {
            throw new Error('Error al obtener los datos');
        }

        // Convertir las respuestas a formato JSON
        const airQualityData = await airQualityResponse.json();
        const weatherData = await weatherResponse.json();
        const hourlyAirQualityData = await hourlyAirQualityResponse.json();

        // Extraemos los datos que necesitamos de la calidad del aire y el clima
        const pm25 = airQualityData.list[0].components.pm2_5;
        const pm10 = airQualityData.list[0].components.pm10;
        const temperature = weatherData.main.temp;
        const aqi = airQualityData.list[0].main.aqi; // AQI (Índice de calidad del aire)

        // Determinar el mensaje y el color de fondo de la calidad del aire en función del AQI
        let qualityMessage = 'Calidad del aire buena';
        let qualityClass = 'bg-green-100'; // Estilo para buena calidad del aire

        // Alertas en función del AQI
        if (aqi >= 151) {
            qualityMessage = 'Calidad del aire: Muy mala';
            qualityClass = 'bg-red-100'; // Alerta de mala calidad del aire
        } else if (aqi >= 101) {
            qualityMessage = 'Calidad del aire: No saludable para grupos sensibles';
            qualityClass = 'bg-yellow-100'; // Alerta moderada
        } else if (aqi >= 51) {
            qualityMessage = 'Calidad del aire: Moderada';
            qualityClass = 'bg-orange-100'; // Alerta moderada
        }

        // Actualizar los elementos HTML con los datos obtenidos
        document.getElementById('pm25').innerText = `${pm25} µg/m³`;
        document.getElementById('pm10').innerText = `${pm10} µg/m³`;
        document.getElementById('temperature').innerText = `${temperature} °C`;

        // Actualizar el mensaje de la calidad del aire y el color de fondo
        document.getElementById('qualityMessage').innerText = qualityMessage;
        document.getElementById('airQuality').className = `rounded p-2 ${qualityClass}`;

        // Llenar la tabla del Heatmap horario con los datos por hora
        const hourlyTableBody = document.getElementById('heatmapTable').getElementsByTagName('tbody')[0];
        hourlyTableBody.innerHTML = ''; // Limpiar la tabla antes de llenarla

        // Función para determinar el color de fondo basado en la concentración
        function getColor(value) {
            if (value <= 25) return 'bg-green-200'; // Buena calidad del aire
            if (value <= 50) return 'bg-yellow-200'; // Moderada
            if (value <= 100) return 'bg-orange-300'; // No saludable para grupos sensibles
            if (value <= 150) return 'bg-red-300'; // No saludable
            return 'bg-red-500'; // Muy no saludable
        }

        // Obtener la hora actual
        const currentHour = new Date().getHours();

        // Generar los intervalos de 2 horas
        const intervals = [];
        for (let i = currentHour; i < 24; i += 2) {
            intervals.push(i);
        }

        // Solo tomar los datos de las horas que están dentro del intervalo generado
        const filteredData = hourlyAirQualityData.list.filter((data) => {
            const hour = new Date(data.dt * 1000).getHours();
            return intervals.includes(hour);
        });

        // Eliminar duplicados por hora
        const uniqueData = [];
        filteredData.forEach((data) => {
            const hour = new Date(data.dt * 1000).getHours();
            if (!uniqueData.some(d => new Date(d.dt * 1000).getHours() === hour)) {
                uniqueData.push(data);
            }
        });

        // Iterar sobre los datos filtrados y llenar la tabla con los datos de PM2.5, PM10, O₃ y NO₂
        uniqueData.forEach((data) => {
            const hour = new Date(data.dt * 1000).getHours(); // Obtener la hora en formato 24 horas
            const pm25Hourly = data.components.pm2_5;
            const pm10Hourly = data.components.pm10;
            const o3Hourly = data.components.o3;
            const no2Hourly = data.components.no2; // Obtenemos el valor de NO₂

            // Crear una nueva fila en la tabla
            const row = hourlyTableBody.insertRow();

            // Agregar los datos a la fila
            row.insertCell(0).innerText = `${hour}:00`; // Hora
            row.insertCell(1).innerText = pm25Hourly.toFixed(2); // PM2.5
            row.insertCell(2).innerText = pm10Hourly.toFixed(2); // PM10
            row.insertCell(3).innerText = o3Hourly.toFixed(2); // O₃
            row.insertCell(4).innerText = no2Hourly.toFixed(2); // NO₂

            // Agregar clases de color de acuerdo a la concentración de los contaminantes
            row.cells[1].classList.add(getColor(pm25Hourly)); // Colorear PM2.5
            row.cells[2].classList.add(getColor(pm10Hourly)); // Colorear PM10
            row.cells[3].classList.add(getColor(o3Hourly)); // Colorear O₃
            row.cells[4].classList.add(getColor(no2Hourly)); // Colorear NO₂
        });

    } catch (error) {
        console.error('Error al obtener los datos:', error);

        // Mostrar mensaje de error en la UI
        document.getElementById('pm25').innerText = 'Error al obtener datos';
        document.getElementById('pm10').innerText = 'Error al obtener datos';
        document.getElementById('temperature').innerText = 'Error al obtener datos';
        document.getElementById('qualityMessage').innerText = 'Error al obtener calidad del aire';
        document.getElementById('heatmapTable').innerHTML = '<tr><td colspan="5">Error al obtener datos horarios de calidad del aire.</td></tr>';
    }
}

// Llamar a la función cuando la página se haya cargado
window.onload = getAirQualityAndWeather;
