# Fahrzeugdaten

Die Webseite lädt nur `ev-models.json`. Diese Datei wird erzeugt, nicht von Hand bearbeitet.

```
quellen/openev.json   Rohdaten von OpenEV Data (wird per --update aktualisiert)
quellen/eigene.csv    eigene Ergänzungen, Korrekturen und Entfernungen
ev-models.json        Ergebnis, wird ausgeliefert
```

## Daten neu erzeugen

```bash
ruby scripts/build-data.rb            # nur zusammenführen
ruby scripts/build-data.rb --update   # vorher neueste OpenEV-Version laden
```

Das Skript zeigt am Ende Hinweise an, z. B. fehlende Quellen oder unplausible Werte.
Zeilen mit Fehlern werden übersprungen, der Rest wird trotzdem übernommen.

## eigene.csv bearbeiten

Trennzeichen ist das Semikolon, Dezimalzahlen dürfen mit Komma oder Punkt geschrieben werden.
Die Datei lässt sich in Excel oder Numbers öffnen (als CSV mit Semikolon, UTF-8 speichern).

| Spalte | Pflicht | Bedeutung |
|---|---|---|
| `aktion` | ja | `neu`, `korrektur` oder `entfernen` |
| `marke` | ja | wie auf der Webseite angezeigt, z. B. `Volkswagen` |
| `modell` | ja | wie auf der Webseite angezeigt, ohne Jahr, z. B. `ID.3 PRO S` |
| `jahr` | ja | Modelljahr |
| `akku_netto_kwh` | bei `neu` | nutzbare Akkukapazität |
| `wltp_reichweite_km` | bei `neu` | WLTP-Reichweite (kombiniert) |
| `wltp_verbrauch_kwh_100km` | nein | wird sonst aus Akku ÷ Reichweite berechnet |
| `quelle` | empfohlen | Link zum Herstellerdatenblatt o. Ä. |
| `abgerufen_am` | empfohlen | Datum, an dem die Quelle geprüft wurde |
| `notiz` | nein | freie Anmerkung |

- **neu**: fügt ein Modell hinzu, das in OpenEV fehlt.
- **korrektur**: überschreibt nur die ausgefüllten Werte eines vorhandenen Modells.
- **entfernen**: nimmt ein Modell aus der Liste.

Zeilen, deren `aktion` mit `#` beginnt, werden ignoriert.

Bitte keine Werte aus fremden Datenbanken (z. B. EV Database, ADAC) übernehmen,
sondern Herstellerangaben oder eigene Quellen verwenden.
