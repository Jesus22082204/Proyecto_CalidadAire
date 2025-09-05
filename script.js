// ================================
// CONFIGURACIÓN
// ================================
const lat = 8.312;
const lon = -73.626;
//4.60971 -74.08175
const apiKey = "0fceb022e90eecf2c580132f9ccd74ce";

// Endpoints OpenWeather
const urls = {
    airQuality: `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`,
    weather: `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`,
    forecast: `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`
};

// Histórico (últimos 5 días)
const now = Math.floor(Date.now() / 1000);
const fiveDaysAgo = now - 5 * 24 * 60 * 60;
urls.history = `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${lat}&lon=${lon}&start=${fiveDaysAgo}&end=${now}&appid=${apiKey}`;


// ================================
// FUNCIONES AUXILIARES
// ================================

// Traducción AQI
function getAQIMessage(aqi) {
    if (aqi >= 151) return { msg: "Muy mala", cls: "bg-red-200" };
    if (aqi >= 101) return { msg: "No saludable para grupos sensibles", cls: "bg-yellow-200" };
    if (aqi >= 51) return { msg: "Moderada", cls: "bg-orange-200" };
    return { msg: "Buena", cls: "bg-green-200" };
}

// Color para heatmap
function getColor(value) {
    if (value <= 25) return "bg-green-200";
    if (value <= 50) return "bg-yellow-200";
    if (value <= 100) return "bg-orange-300";
    if (value <= 150) return "bg-red-300";
    return "bg-red-500";
}

// Estadísticas para boxplots
function calcularEstadisticas(valores) {
    if (!valores || valores.length === 0) return { mediana: "-", q1: "-", q3: "-", min: "-", max: "-" };

    const sorted = [...valores].sort((a, b) => a - b);
    const n = sorted.length;

    const percentile = (p) => {
        const index = (p / 100) * (n - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
    };

    return {
        mediana: percentile(50).toFixed(2),
        q1: percentile(25).toFixed(2),
        q3: percentile(75).toFixed(2),
        min: sorted[0].toFixed(2),
        max: sorted[n - 1].toFixed(2)
    };
}


// ================================
// PROCESAMIENTO PRINCIPAL
// ================================
async function getAirQualityAndWeather() {
    try {
        // Peticiones principales
        const [airQualityResponse, weatherResponse, forecastResponse] = await Promise.all([
            fetch(urls.airQuality),
            fetch(urls.weather),
            fetch(urls.forecast)
        ]);

        if (!airQualityResponse.ok || !weatherResponse.ok || !forecastResponse.ok) {
            throw new Error("Error al obtener los datos");
        }

        const airQualityData = await airQualityResponse.json();
        const weatherData = await weatherResponse.json();
        const forecastData = await forecastResponse.json();

        // Histórico opcional
        let historyData = { list: [] };
        try {
            const r = await fetch(urls.history);
            if (r.ok) historyData = await r.json();
        } catch (e) {
            console.warn("No se pudo obtener histórico:", e);
        }

        // ================================
        // Indicadores principales
        // ================================
        const pm25 = airQualityData.list[0].components.pm2_5;
        const pm10 = airQualityData.list[0].components.pm10;
        const temperature = weatherData.main.temp;
        const aqi = airQualityData.list[0].main.aqi;

        const { msg, cls } = getAQIMessage(aqi);

        document.getElementById("pm25").innerText = `${pm25.toFixed(2)} µg/m³`;
        document.getElementById("pm10").innerText = `${pm10.toFixed(2)} µg/m³`;
        document.getElementById("temperature").innerText = `${temperature.toFixed(1)} °C`;
        document.getElementById("qualityMessage").innerText = `Calidad del aire: ${msg}`;
        document.getElementById("airQuality").className = `rounded p-2 ${cls}`;


        // ================================
        // Heatmap horario (pronóstico)
        // ================================
        renderHeatmap(forecastData);


        // ================================
        // Resumen del pronóstico
        // ================================
        renderForecastSummary(forecastData);


        // ================================
        // Boxplots por mes
        // ================================
        generarBoxplots({ history: historyData, forecast: forecastData });


        // ================================
        // Anomalías (solo histórico)
        // ================================
        detectarAnomalias(historyData);

    } catch (error) {
        console.error("Error al obtener los datos:", error);

        document.getElementById("pm25").innerText = "Error al obtener datos";
        document.getElementById("pm10").innerText = "Error al obtener datos";
        document.getElementById("temperature").innerText = "Error";
        document.getElementById("qualityMessage").innerText = "Error en AQI";
        document.getElementById("heatmapTable").innerHTML =
            "<tr><td colspan='5'>Error al obtener datos horarios.</td></tr>";

        const tb = document.querySelector("#boxplotTable tbody");
        if (tb) tb.innerHTML = "<tr><td colspan='11'>No fue posible cargar los boxplots.</td></tr>";
    }
}


// ================================
// COMPONENTES VISUALES
// ================================
function renderHeatmap(forecastData) {
    const tbody = document.getElementById("heatmapTable").getElementsByTagName("tbody")[0];
    tbody.innerHTML = "";

    const now = new Date();
    const currentHour = now.getHours();

    // 6 intervalos cada 2 horas
    const intervals = [];
    for (let i = 0; i < 6; i++) {
        intervals.push((currentHour + i * 2) % 24);
    }

    // Filtrar datos de forecast
    const filteredData = (forecastData.list || []).filter((data) => {
        const fecha = new Date(data.dt * 1000);
        const hour = fecha.getHours();
        return intervals.includes(hour);
    });

    // Eliminar duplicados de horas
    const uniqueData = [];
    filteredData.forEach((data) => {
        const hour = new Date(data.dt * 1000).getHours();
        if (!uniqueData.some((d) => new Date(d.dt * 1000).getHours() === hour)) {
            uniqueData.push(data);
        }
    });

    // Insertar en tabla
    uniqueData.forEach((data) => {
        const fecha = new Date(data.dt * 1000);
        const { pm2_5, pm10, o3, no2 } = data.components;

        const row = tbody.insertRow();
        row.insertCell(0).innerText = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
        row.insertCell(1).innerText = pm2_5.toFixed(2);
        row.insertCell(2).innerText = pm10.toFixed(2);
        row.insertCell(3).innerText = o3.toFixed(2);
        row.insertCell(4).innerText = no2.toFixed(2);

        row.cells[1].classList.add(getColor(pm2_5));
        row.cells[2].classList.add(getColor(pm10));
        row.cells[3].classList.add(getColor(o3));
        row.cells[4].classList.add(getColor(no2));
    });

    if (uniqueData.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>No hay pronóstico disponible para hoy.</td></tr>";
    }
}


function renderForecastSummary(forecastData) {
    const forecastDiv = document.getElementById("forecastMessage");

    if (!forecastData.list || forecastData.list.length === 0) {
        forecastDiv.innerText = "No hay suficiente pronóstico disponible para generar un resumen.";
        return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const intervals = [];
    for (let i = 0; i < 6; i++) {
        intervals.push((currentHour + i * 2) % 24);
    }

    const data = forecastData.list.filter((d) =>
        intervals.includes(new Date(d.dt * 1000).getHours())
    );

    if (data.length === 0) {
        forecastDiv.innerText = "No hay suficiente pronóstico disponible para generar un resumen.";
        return;
    }

    let sumPm25 = 0, sumPm10 = 0, sumO3 = 0, sumNo2 = 0;
    data.forEach(d => {
        sumPm25 += d.components.pm2_5;
        sumPm10 += d.components.pm10;
        sumO3 += d.components.o3;
        sumNo2 += d.components.no2;
    });

    const avgPm25 = sumPm25 / data.length;
    const avgPm10 = sumPm10 / data.length;
    const avgO3 = sumO3 / data.length;
    const avgNo2 = sumNo2 / data.length;

    let mensaje = "✅ Buen día para actividades al aire libre.";
    let clases = "mt-3 text-sm font-bold text-green-700 bg-green-100 p-2 rounded";

    if (avgPm25 > 35 || avgPm10 > 50 || avgO3 > 100 || avgNo2 > 200) {
        mensaje = "⚠️ Precaución: se esperan niveles moderados de contaminación.";
        clases = "mt-3 text-sm font-bold text-yellow-700 bg-yellow-100 p-2 rounded";
    }
    if (avgPm25 > 55 || avgPm10 > 100 || avgO3 > 150 || avgNo2 > 300) {
        mensaje = "❌ Mala calidad del aire prevista. Mejor evitar actividades al aire libre.";
        clases = "mt-3 text-sm font-bold text-red-700 bg-red-100 p-2 rounded";
    }

    forecastDiv.innerText = mensaje;
    forecastDiv.className = clases;
}


function generarBoxplots(sources) {
    const combined = [
        ...(sources.history?.list || []),
        ...(sources.forecast?.list || [])
    ];

    const agrupado = new Map();

    combined.forEach((entry) => {
        const fecha = new Date(entry.dt * 1000);
        const mesIndex = fecha.getMonth();
        const mesNombre = fecha.toLocaleString("es-ES", { month: "long" });

        if (!agrupado.has(mesIndex)) {
            agrupado.set(mesIndex, { nombre: mesNombre, pm25: [], pm10: [] });
        }
        const bucket = agrupado.get(mesIndex);
        bucket.pm25.push(entry.components.pm2_5);
        bucket.pm10.push(entry.components.pm10);
    });

    const currentMonthIndex = new Date().getMonth();
    const tableBody = document.querySelector("#boxplotTable tbody");
    tableBody.innerHTML = "";

    const mesesConDatos = Array.from(agrupado.keys()).sort((a, b) => a - b);
    let mesesParaMostrar = mesesConDatos.filter((i) => i < currentMonthIndex);

    if (mesesParaMostrar.length === 0 && agrupado.has(currentMonthIndex)) {
        mesesParaMostrar = [currentMonthIndex];
        const info = document.createElement("tr");
        info.innerHTML = `<td colspan="11" class="text-left px-2 py-1 text-gray-500">
        No hay datos de meses anteriores disponibles. Se muestra el <b>mes actual</b>.
        </td>`;
        tableBody.appendChild(info);
    }

    if (mesesParaMostrar.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="11">Sin datos suficientes para calcular boxplots.</td></tr>`;
        return;
    }

    mesesParaMostrar.forEach((mesIndex) => {
        const mesData = agrupado.get(mesIndex);
        const statsPm25 = calcularEstadisticas(mesData.pm25);
        const statsPm10 = calcularEstadisticas(mesData.pm10);

        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${mesData.nombre.charAt(0).toUpperCase() + mesData.nombre.slice(1)}</td>
        <td>${statsPm25.mediana}</td>
        <td>${statsPm25.q1}</td>
        <td>${statsPm25.q3}</td>
        <td>${statsPm25.min}</td>
        <td>${statsPm25.max}</td>
        <td>${statsPm10.mediana}</td>
        <td>${statsPm10.q1}</td>
        <td>${statsPm10.q3}</td>
        <td>${statsPm10.min}</td>
        <td>${statsPm10.max}</td>
        `;
        tableBody.appendChild(row);
    });
}


function detectarAnomalias(historyData) {
    const ul = document.querySelector("#anomaliasList");
    ul.innerHTML = "";

    if (!historyData || !historyData.list || historyData.list.length === 0) {
        ul.innerHTML = "<li class='text-gray-500'>No hay datos históricos suficientes para detectar anomalías.</li>";
        return;
    }

    const now = Date.now();
    const eventos = [];

    historyData.list.forEach((entry, i) => {
        const fecha = new Date(entry.dt * 1000);
        if (fecha.getTime() > now) return;

        const { pm2_5, pm10, o3, no2 } = entry.components;

        // Umbrales
        if (pm2_5 > 35) eventos.push({ fecha, desc: `Pico inusual de PM₂.₅ (${pm2_5.toFixed(1)} µg/m³)` });
        if (pm10 > 50) eventos.push({ fecha, desc: `Pico elevado de PM₁₀ (${pm10.toFixed(1)} µg/m³)` });
        if (o3 > 100) eventos.push({ fecha, desc: `Concentración alta de O₃ (${o3.toFixed(1)} µg/m³)` });
        if (no2 > 200) eventos.push({ fecha, desc: `Concentración elevada de NO₂ (${no2.toFixed(1)} µg/m³)` });

        // Saltos bruscos
        if (i > 0) {
            const prev = historyData.list[i - 1].components;
            if (Math.abs(pm2_5 - prev.pm2_5) > 20) eventos.push({ fecha, desc: `Salto brusco en PM₂.₅` });
            if (Math.abs(pm10 - prev.pm10) > 25) eventos.push({ fecha, desc: `Salto brusco en PM₁₀` });
            if (Math.abs(o3 - prev.o3) > 30) eventos.push({ fecha, desc: `Variación repentina en O₃` });
            if (Math.abs(no2 - prev.no2) > 40) eventos.push({ fecha, desc: `Variación repentina en NO₂` });
        }
    });

    if (eventos.length === 0) {
        ul.innerHTML = "<li class='text-gray-500'>No se detectaron anomalías recientes.</li>";
        return;
    }

    eventos.slice(-5).forEach(e => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${e.fecha.toLocaleString("es-ES")}</strong>: ${e.desc}`;
        ul.appendChild(li);
    });
}

///graficos
function renderTimeSeries(historyData) {
    if (!historyData.list || historyData.list.length === 0) return;

    const labels = historyData.list.map(d =>
        new Date(d.dt * 1000).toLocaleString("es-ES", { hour: "2-digit", day: "numeric", month: "short" })
    );

    const pm25 = historyData.list.map(d => d.components.pm2_5);
    const pm10 = historyData.list.map(d => d.components.pm10);
    const o3 = historyData.list.map(d => d.components.o3);
    const no2 = historyData.list.map(d => d.components.no2);

    new Chart(document.getElementById("timeSeriesChart"), {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "PM₂.₅", data: pm25, borderColor: "rgba(255, 99, 132, 1)", fill: false },
                { label: "PM₁₀", data: pm10, borderColor: "rgba(255, 159, 64, 1)", fill: false },
                { label: "O₃", data: o3, borderColor: "rgba(54, 162, 235, 1)", fill: false },
                { label: "NO₂", data: no2, borderColor: "rgba(75, 192, 192, 1)", fill: false }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } },
            scales: { x: { ticks: { maxRotation: 90, minRotation: 45 } } }
        }
    });
}



// ================================
// INICIO
// ================================
window.onload = getAirQualityAndWeather;
