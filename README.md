# Reichweitenangst

Statische Webseite mit Reichweitenrechner für Elektroautos und einer Karte, die die Reichweite vom Startpunkt aus zeigt.
Kein Build-Schritt nötig: Die Dateien lassen sich direkt über GitHub Pages oder jeden Webspace ausliefern.

## Aufbau

| Datei / Ordner | Inhalt |
|---|---|
| `index.html`, `style.css` | Seite und Gestaltung |
| `script.js` | Rechner, Fahrzeugauswahl, Temperatur von Open-Meteo |
| `map.js` | Karte mit Reichweitenkreisen (Leaflet + OpenStreetMap) |
| `impressum.html`, `datenschutz.html` | Rechtliche Seiten (Vorlagen, vor Veröffentlichung ausfüllen) |
| `data/` | Fahrzeugdaten, siehe [data/README.md](data/README.md) |
| `scripts/build-data.rb` | Erzeugt `data/ev-models.json` aus OpenEV Data und eigenen Einträgen |
| `vendor/leaflet/` | Leaflet 1.9.4, lokal eingebunden (BSD-2-Clause) |

## Lokal ansehen

Die Seite lädt Daten per `fetch`, braucht also einen lokalen Webserver, z. B.:

```bash
php -S localhost:8080
```

## Externe Dienste

- **OpenStreetMap** – Kartenbilder. Für Seiten mit viel Besuch einen eigenen Kachel-Anbieter verwenden.
- **Open-Meteo** – aktuelle Temperatur. Die kostenlose Schnittstelle ist nur für nicht-kommerzielle Nutzung gedacht.
