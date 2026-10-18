# encoding: utf-8
#
# Erzeugt data/ev-models.json aus den OpenEV-Rohdaten und den eigenen Einträgen.
#
#   ruby scripts/build-data.rb            # nur zusammenführen
#   ruby scripts/build-data.rb --update   # vorher neueste OpenEV-Version laden
#
# Ausgabe-Zeile: [Marke, Modell, Jahr, Akku netto kWh, WLTP-Reichweite km, WLTP-Verbrauch kWh/100 km]

require "csv"
require "json"
require "net/http"
require "uri"
require "time"

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

ROOT = File.expand_path("..", __dir__)
OPENEV_FILE = File.join(ROOT, "data/quellen/openev.json")
OWN_FILE = File.join(ROOT, "data/quellen/eigene.csv")
OUT_FILE = File.join(ROOT, "data/ev-models.json")
OPENEV_REPO = "open-ev-data/open-ev-data-dataset"

# Plausibilitätsgrenzen für reine Elektroautos
MIN_BATTERY_KWH = 15
CONSUMPTION_RANGE = (9..30)

def fetch(url, limit = 5)
  raise "Zu viele Weiterleitungen" if limit.zero?
  res = Net::HTTP.get_response(URI(url))
  case res
  when Net::HTTPRedirection then fetch(res["location"], limit - 1)
  when Net::HTTPSuccess then res.body
  else raise "#{url}: HTTP #{res.code}"
  end
end

def update_openev
  release = JSON.parse(fetch("https://api.github.com/repos/#{OPENEV_REPO}/releases/latest"))
  tag = release["tag_name"]
  asset = release["assets"].find { |a| a["name"] == "open-ev-data-#{tag}.json" }
  raise "Keine JSON-Datei in Release #{tag} gefunden" unless asset
  body = fetch(asset["browser_download_url"])
  JSON.parse(body.dup.force_encoding(Encoding::UTF_8)) # erst prüfen, dann die alte Datei ersetzen
  File.binwrite(OPENEV_FILE, body)
  puts "OpenEV #{tag} geladen."
end

def consumption(battery, range)
  (battery / range * 100).round(1)
end

def plausible?(battery, cons)
  battery >= MIN_BATTERY_KWH && CONSUMPTION_RANGE.cover?(cons)
end

def key(make, model, year)
  [make.downcase, model.downcase, year.to_i]
end

# --- OpenEV-Daten -----------------------------------------------------------

def openev_rows(src)
  src["vehicles"].map do |x|
    next unless (x["markets"] || []).include?("DE")

    battery = x.dig("battery", "pack_capacity_kwh_net").to_f
    wltp = (x.dig("range", "rated") || []).find { |r| r["cycle"] == "wltp" }
    next unless wltp && wltp["range_km"].to_f > 0

    range = wltp["range_km"].to_f
    cons = consumption(battery, range)
    next unless plausible?(battery, cons)

    model = x["model"]["name"].strip
    extras = [x.dig("variant", "name"), x.dig("trim", "name")].compact.map(&:strip)
    extras = extras.reject { |e| e.empty? || e.casecmp("base").zero? || model.downcase.include?(e.downcase) }
    extras = extras.uniq(&:downcase)
    extras = extras.reject { |e| extras.any? { |o| o != e && o.downcase.include?(e.downcase) } }
    label = ([model] + extras).join(" ")
    next if label =~ /phev|hybrid/i

    [x["make"]["name"].strip, label, x["year"], battery.round(1), range.round, cons]
  end.compact.uniq
end

# --- Eigene Einträge --------------------------------------------------------

def number(value)
  return nil if value.nil? || value.strip.empty?
  Float(value.strip.tr(",", "."))
end

ACTIONS = %w[neu korrektur entfernen].freeze

def apply_own(rows, warnings)
  index = rows.each_with_index.to_h { |r, i| [key(r[0], r[1], r[2]), i] }
  stats = Hash.new(0)

  CSV.foreach(OWN_FILE, headers: true, col_sep: ";", encoding: "bom|utf-8").with_index(2) do |row, line|
    action = row["aktion"].to_s.strip.downcase
    make, model, year = row["marke"].to_s.strip, row["modell"].to_s.strip, row["jahr"].to_i
    where = "eigene.csv Zeile #{line} (#{make} #{model} #{year})"
    next if action.empty? || action.start_with?("#")

    unless ACTIONS.include?(action)
      warnings << "#{where}: unbekannte aktion „#{action}“ (#{ACTIONS.join(', ')}) – übersprungen"
      next
    end
    if make.empty? || model.empty? || year.zero?
      warnings << "#{where}: marke, modell und jahr sind Pflicht – übersprungen"
      next
    end
    if row["quelle"].to_s.strip.empty? && action != "entfernen"
      warnings << "#{where}: keine Quelle angegeben"
    end

    battery = number(row["akku_netto_kwh"])
    range = number(row["wltp_reichweite_km"])
    cons = number(row["wltp_verbrauch_kwh_100km"])
    k = key(make, model, year)
    i = index[k]

    if action == "entfernen"
      unless i
        warnings << "#{where}: kein passender Eintrag zum Entfernen gefunden"
        next
      end
      rows[i] = nil
      index.delete(k)
      stats[action] += 1
      next
    end

    if action == "neu"
      if i
        warnings << "#{where}: Modell existiert bereits – als korrektur eintragen; übersprungen"
        next
      end
      unless battery && range
        warnings << "#{where}: akku_netto_kwh und wltp_reichweite_km sind Pflicht – übersprungen"
        next
      end
      candidate = [make, model, year, nil, nil, nil]
    else
      unless i
        warnings << "#{where}: kein passender Eintrag zum Korrigieren gefunden"
        next
      end
      candidate = rows[i].dup
    end

    candidate[3] = battery.round(1) if battery
    candidate[4] = range.round if range
    candidate[5] = cons || consumption(candidate[3], candidate[4])

    unless plausible?(candidate[3], candidate[5])
      warnings << "#{where}: Werte unplausibel (#{candidate[3]} kWh, #{candidate[5]} kWh/100 km) – übersprungen"
      next
    end

    if i
      rows[i] = candidate
    else
      rows << candidate
      index[k] = rows.size - 1
    end
    stats[action] += 1
  end

  [rows.compact, stats]
end

# --- Ablauf -----------------------------------------------------------------

update_openev if ARGV.include?("--update")

src = JSON.parse(File.read(OPENEV_FILE))
rows = openev_rows(src)
openev_count = rows.size
warnings = []
rows, stats = apply_own(rows, warnings)
rows.sort_by! { |r| [r[0].downcase, r[1].downcase, -r[2]] }

out = {
  source: "OpenEV Data (https://github.com/#{OPENEV_REPO}) + eigene Einträge",
  updated: src["generated_at"].to_s[0, 10],
  built_at: Time.now.utc.iso8601,
  own_entries: stats["neu"],
  license: "CDLA-Permissive-2.0",
  fields: %w[make model year battery_net_kwh wltp_range_km wltp_consumption_kwh_100km],
  data: rows,
}
File.write(OUT_FILE, JSON.generate(out))

puts "OpenEV: #{openev_count} Modelle (Stand #{out[:updated]})"
puts "Eigene: #{stats['neu']} neu, #{stats['korrektur']} korrigiert, #{stats['entfernen']} entfernt"
puts "Gesamt: #{rows.size} Modelle -> #{OUT_FILE.sub(ROOT + '/', '')}"
unless warnings.empty?
  puts "\nHinweise:"
  warnings.each { |w| puts "  - #{w}" }
end
