    // Obtener datos de OpenWeather
    async function getAirQualityAndWeather() {
    const lat = 8.312;
    const lon = -73.626;
    const apiKey = "0fceb022e90eecf2c580132f9ccd74ce";

    const airQualityUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
    const hourlyAirQualityUrl = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        const [airQualityResponse, weatherResponse, hourlyAirQualityResponse] = await Promise.all([
        fetch(airQualityUrl),
        fetch(weatherUrl),
        fetch(hourlyAirQualityUrl)
        ]);

        if (!airQualityResponse.ok || !weatherResponse.ok || !hourlyAirQualityResponse.ok) {
        throw new Error("Error al obtener los datos");
        }

        const airQualityData = await airQualityResponse.json();
        const weatherData = await weatherResponse.json();
        const hourlyAirQualityData = await hourlyAirQualityResponse.json();

        const pm25 = airQualityData.list[0].components.pm2_5;
        const pm10 = airQualityData.list[0].components.pm10;
        const temperature = weatherData.main.temp;
        const aqi = airQualityData.list[0].main.aqi;

        // Función para traducir AQI
        function getAQIMessage(aqi) {
        if (aqi >= 151) return { msg: "Muy mala", cls: "bg-red-200" };
        if (aqi >= 101) return { msg: "No saludable para grupos sensibles", cls: "bg-yellow-200" };
        if (aqi >= 51) return { msg: "Moderada", cls: "bg-orange-200" };
        return { msg: "Buena", cls: "bg-green-200" };
        }

        const { msg, cls } = getAQIMessage(aqi);

        document.getElementById("pm25").innerText = `${pm25.toFixed(2)} µg/m³`;
        document.getElementById("pm10").innerText = `${pm10.toFixed(2)} µg/m³`;
        document.getElementById("temperature").innerText = `${temperature.toFixed(1)} °C`;
        document.getElementById("qualityMessage").innerText = `Calidad del aire: ${msg}`;
        document.getElementById("airQuality").className = `rounded p-2 ${cls}`;

        // Heatmap
        const hourlyTableBody = document.getElementById("heatmapTable").getElementsByTagName("tbody")[0];
        hourlyTableBody.innerHTML = "";

        function getColor(value) {
        if (value <= 25) return "bg-green-200";
        if (value <= 50) return "bg-yellow-200";
        if (value <= 100) return "bg-orange-300";
        if (value <= 150) return "bg-red-300";
        return "bg-red-500";
        }

        const currentHour = new Date().getHours();
        const intervals = [];
        for (let i = currentHour; i < 24; i += 2) {
        intervals.push(i);
        }

        const filteredData = hourlyAirQualityData.list.filter((data) => {
        const hour = new Date(data.dt * 1000).getHours();
        return intervals.includes(hour);
        });

        const uniqueData = [];
        filteredData.forEach((data) => {
        const hour = new Date(data.dt * 1000).getHours();
        if (!uniqueData.some((d) => new Date(d.dt * 1000).getHours() === hour)) {
            uniqueData.push(data);
        }
        });

        uniqueData.forEach((data) => {
        const hour = new Date(data.dt * 1000).getHours();
        const { pm2_5, pm10, o3, no2 } = data.components;

        const row = hourlyTableBody.insertRow();
        row.insertCell(0).innerText = `${hour}:00`;
        row.insertCell(1).innerText = pm2_5.toFixed(2);
        row.insertCell(2).innerText = pm10.toFixed(2);
        row.insertCell(3).innerText = o3.toFixed(2);
        row.insertCell(4).innerText = no2.toFixed(2);

        row.cells[1].classList.add(getColor(pm2_5));
        row.cells[2].classList.add(getColor(pm10));
        row.cells[3].classList.add(getColor(o3));
        row.cells[4].classList.add(getColor(no2));
        });

    } catch (error) {
        console.error("Error al obtener los datos:", error);

        document.getElementById("pm25").innerText = "Error al obtener datos";
        document.getElementById("pm10").innerText = "Error al obtener datos";
        document.getElementById("temperature").innerText = "Error";
        document.getElementById("qualityMessage").innerText = "Error en AQI";
        document.getElementById("heatmapTable").innerHTML = "<tr><td colspan='5'>Error al obtener datos horarios.</td></tr>";
    }
    }

    window.onload = getAirQualityAndWeather;
