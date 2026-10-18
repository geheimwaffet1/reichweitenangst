// Karte mit Reichweitenkreisen um einen Startpunkt
(() => {
  if (!window.L) return;

  // Straßen sind im Schnitt etwa 25 % länger als die Luftlinie.
  const DETOUR_FACTOR = 1.25;
  const GERMANY_CENTER = [51.16, 10.45];

  const map = L.map("map", { scrollWheelZoom: false }).setView(GERMANY_CENTER, 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue("--accent").trim() || "#1f9d55";

  const oneWay = L.circle(GERMANY_CENTER, {
    radius: 0,
    color: accent,
    weight: 2,
    fillColor: accent,
    fillOpacity: 0.12,
  });
  const roundTrip = L.circle(GERMANY_CENTER, {
    radius: 0,
    color: accent,
    weight: 2,
    dashArray: "6 6",
    fillColor: accent,
    fillOpacity: 0.18,
  });
  const marker = L.marker(GERMANY_CENTER);

  let start = null;
  let range = Number(document.getElementById("range-km").textContent) || 0;

  const status = document.getElementById("map-status");
  const km = (value) => `${Math.round(value)} km`;

  function render(fit) {
    document.getElementById("map-oneway").textContent = km(range);
    document.getElementById("map-return").textContent = km(range / 2);
    if (!start) return;

    oneWay.setLatLng(start).setRadius((range / DETOUR_FACTOR) * 1000);
    roundTrip.setLatLng(start).setRadius((range / 2 / DETOUR_FACTOR) * 1000);
    marker.setLatLng(start);
    [oneWay, roundTrip, marker].forEach((layer) => layer.addTo(map));

    if (fit && range > 0) map.fitBounds(oneWay.getBounds(), { padding: [20, 20] });
  }

  function setStart(latlng, fit = true) {
    start = L.latLng(latlng);
    status.textContent = "";
    render(fit);
    document.dispatchEvent(new CustomEvent("startchange", { detail: { lat: start.lat, lng: start.lng } }));
  }

  map.on("click", (e) => setStart(e.latlng));

  document.getElementById("locate").addEventListener("click", () => {
    if (!navigator.geolocation) {
      status.textContent = "Standortbestimmung wird nicht unterstützt.";
      return;
    }
    status.textContent = "Standort wird ermittelt …";
    navigator.geolocation.getCurrentPosition(
      (pos) => setStart([pos.coords.latitude, pos.coords.longitude]),
      () => {
        status.textContent = "Standort nicht verfügbar – klicke stattdessen auf die Karte.";
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });

  document.addEventListener("rangechange", (e) => {
    range = e.detail.range;
    render(false);
  });

  render(false);
})();
