const $ = (id) => document.getElementById(id);

const inputs = {
  battery: $("battery"),
  soc: $("soc"),
  consumption: $("consumption"),
  temp: $("temp"),
  profile: $("profile"),
  reserve: $("reserve"),
};

const fmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

// Mehrverbrauch durch Heizen bzw. Klimatisieren, bezogen auf ca. 20 °C.
// Die Fahrprofil-Faktoren im HTML beziehen sich auf den WLTP-Verbrauch.
function temperatureFactor(celsius) {
  if (celsius < 20) return 1 + (20 - celsius) * 0.012;
  if (celsius > 25) return 1 + (celsius - 25) * 0.008;
  return 1;
}

function update() {
  const battery = Number(inputs.battery.value);
  const soc = Number(inputs.soc.value);
  const consumption = Number(inputs.consumption.value);
  const temp = Number(inputs.temp.value);
  const profile = Number(inputs.profile.value);
  const reserve = inputs.reserve.checked ? 10 : 0;

  $("battery-out").textContent = `${fmt.format(battery)} kWh`;
  $("soc-out").textContent = `${soc} %`;
  $("consumption-out").textContent = `${fmt.format(consumption)} kWh/100 km`;
  $("temp-out").textContent = `${temp} °C`;

  const usableSoc = Math.max(0, soc - reserve);
  const energy = (battery * usableSoc) / 100;
  const realConsumption = consumption * profile * temperatureFactor(temp);
  const range = Math.round((energy / realConsumption) * 100);
  const fullRange = (battery / realConsumption) * 100;

  $("range-km").textContent = range;
  $("real-consumption").textContent = `${fmt.format(realConsumption)} kWh/100 km`;
  $("energy").textContent = `${fmt.format(energy)} kWh`;

  const fill = $("meter-fill");
  fill.style.width = `${Math.min(100, (range / fullRange) * 100)}%`;
  fill.classList.toggle("low", range < 50);

  let note;
  if (range === 0) note = "Zeit zum Laden – die Reserve ist erreicht.";
  else if (range < 50) note = "Knapp – plane den nächsten Ladestopp ein.";
  else if (range < 150) note = "Reicht locker für den Alltag.";
  else note = "Genug für eine längere Tour – entspannt losfahren.";
  $("result-note").textContent = note;

  document.dispatchEvent(new CustomEvent("rangechange", { detail: { range } }));
}

Object.values(inputs).forEach((el) => el.addEventListener("input", update));

// Fahrzeugauswahl aus OpenEV Data
const brandSelect = $("brand");
const modelSelect = $("model");
let vehicles = [];

function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

// Datensatz-Zeile: [Marke, Modell, Jahr, Akku netto kWh, WLTP-Reichweite km, WLTP-Verbrauch kWh/100 km]
function vehicleLabel([, model, year]) {
  return `${model} (${year})`;
}

function fillModels() {
  const brand = brandSelect.value;
  modelSelect.replaceChildren();
  modelSelect.disabled = !brand;
  if (!brand) {
    modelSelect.append(option("", "Erst Marke wählen"));
    return;
  }
  modelSelect.append(option("", "Modell wählen"));
  vehicles.forEach((v, i) => {
    if (v[0] === brand) modelSelect.append(option(i, vehicleLabel(v)));
  });
}

function applyModel() {
  const v = vehicles[modelSelect.value];
  if (!v) return;
  inputs.battery.value = v[3];
  inputs.consumption.value = v[5];
  update();
}

// Wer die Werte von Hand ändert, verlässt die Modellauswahl.
[inputs.battery, inputs.consumption].forEach((el) =>
  el.addEventListener("input", () => {
    modelSelect.value = "";
  })
);

brandSelect.addEventListener("change", fillModels);
modelSelect.addEventListener("change", applyModel);

fetch("data/ev-models.json")
  .then((res) => res.json())
  .then((json) => {
    vehicles = json.data;
    const brands = [...new Set(vehicles.map((v) => v[0]))];
    brands.forEach((b) => brandSelect.append(option(b, b)));
    const date = new Date(json.updated).toLocaleDateString("de-DE");
    const own = json.own_entries ? `, davon ${json.own_entries} eigene Einträge` : "";
    $("data-info").textContent = ` (${vehicles.length} Modelle, Stand ${date}${own})`;
  })
  .catch(() => {
    brandSelect.disabled = true;
    brandSelect.firstElementChild.textContent = "Modelldaten nicht verfügbar";
  });

// Aktuelle Außentemperatur von Open-Meteo, zuerst für die Mitte Deutschlands,
// später für den Startpunkt auf der Karte. Wer den Regler selbst bewegt, behält seinen Wert.
const GERMANY_CENTER = { lat: 51.16, lng: 10.45 };
const tempHint = $("temp-hint");
let tempTouched = false;
let tempRequest = 0;

inputs.temp.addEventListener("input", () => {
  tempTouched = true;
  tempHint.textContent = "";
});

async function loadTemperature({ lat, lng }, place) {
  if (tempTouched) return;
  const request = ++tempRequest;
  // Auf eine Nachkommastelle gerundet (ca. 10 km), genauer muss das Wetter nicht sein.
  const params = new URLSearchParams({
    latitude: lat.toFixed(1),
    longitude: lng.toFixed(1),
    current: "temperature_2m",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const json = await res.json();
    const temp = json.current?.temperature_2m;
    if (typeof temp !== "number" || tempTouched || request !== tempRequest) return;

    const min = Number(inputs.temp.min);
    const max = Number(inputs.temp.max);
    inputs.temp.value = Math.min(max, Math.max(min, Math.round(temp)));
    tempHint.textContent = `Aktuell ${place} (Wetterdaten: Open-Meteo)`;
    update();
  } catch {
    // Ohne Wetterdaten bleibt einfach der Standardwert stehen.
  }
}

document.addEventListener("startchange", (e) => loadTemperature(e.detail, "am Startpunkt"));
loadTemperature(GERMANY_CENTER, "in der Mitte Deutschlands");

$("year").textContent = new Date().getFullYear();
update();
