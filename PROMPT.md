# Original-Prompt – Garmin Training Dashboard

> Vollständiger Spezifikations-Prompt vom Projektstart.
> Dient als Referenz für Architekturentscheidungen, Trainingswissenschaft und Feature-Logik.

---

Du bist ab sofort mein persönlicher Elite-Trainer, Sportwissenschaftler und erfahrener Full-Stack-Entwickler. Wir bauen ein intelligentes, readiness-gesteuertes Trainings- und Ernährungs-Dashboard auf Basis meiner Garmin-Daten. Wir bauen in Phasen: erst ein robustes MVP, dann die intelligenten Erweiterungen. Qualität und Zuverlässigkeit vor Feature-Fülle. Stelle mir am Ende nur die wirklich offenen Fragen, dann beginne mit Phase 1.

═══════════════════════════════════
TEIL 1 – ARCHITEKTUR
═══════════════════════════════════
- Frontend: Next.js 14 (App Router), Dark Mode, Chart.js
- Backend: Next.js API Routes + PostgreSQL (Railway)
- Auth: NextAuth.js – 2 Profile (Daniel + Frau), geteilte Ansicht
- Garmin-Anbindung: Python-Microservice mit Library "garminconnect" (cyberjunky, 131+ Endpunkte)
- AUTH-ROBUSTHEIT: OAuth-Tokens über "garth" cachen statt wiederholtem Passwort-Login. Tokens verschlüsselt speichern. Retry mit Exponential Backoff. Bei Sync-Fehler: Status im Dashboard sichtbar machen, nicht still scheitern.
- Hosting: Railway (bestehender Account), 2 Services: web + sync-worker
- KEINE Push-Benachrichtigungen (bewusst weggelassen)

═══════════════════════════════════
TEIL 2 – TÄGLICHER SYNC (vollständig)
═══════════════════════════════════
Railway-Cron-Worker, 1× täglich um 09:00 deutscher Zeit.
ZEITZONE: Railway-Cron läuft in UTC. 09:00 MEZ = 07:00 UTC (Sommer/CEST) bzw. 08:00 UTC (Winter/CET). DST-sicher implementieren (TZ-Library oder interne Prüfung) und die Wahl dokumentieren.
Manueller Sync: Button im Dashboard + Endpoint POST /api/sync/trigger.

Der Sync-Worker ruft ALLE relevanten Garmin-Endpunkte ab und speichert Rohdaten in PostgreSQL. Nicht sofort angezeigte Daten werden trotzdem gespeichert – kein Datenverlust.

TÄGLICH ABRUFEN (Kernmetriken):
- get_training_readiness() → Readiness-Score + Faktoren
- get_morning_training_readiness() → Morgen-spezifischer Score
- get_training_status() → Trainingsstatus (Peaking, Productive, Maintaining etc.)
- get_hrv_data() → HRV mit persönlicher Baseline + 5-Nächte-Verlauf
- get_sleep_data() → Schlafphasen (Tief/REM/Leicht/Wach), Score, Dauer
- get_body_battery() → Body-Battery-Kurve über den gesamten Tag
- get_user_summary() → Schritte, Kalorien, Distanz, aktive Minuten
- get_heart_rates() → HF-Tagesverlauf
- get_resting_heart_rate() → Ruhepuls
- get_all_day_stress() → Stress-Kurve
- get_steps_data() → Schritte mit Stunden-Auflösung
- get_max_metrics() → VO2max + Fitness-Alter
- get_intensity_minutes_data() → Intensitätsminuten
- get_respiration_data() → Atemfrequenz
- get_spo2_data() → Blutsauerstoff
- get_body_composition() → Gewicht + KFA aus Garmin (Backup zur manuellen Tageseingabe)
- get_daily_weigh_ins() → Waageneinträge
- get_hydration_data() → Hydration
- get_nutrition_daily_food_log() → Garmin-Ernährungslog (falls genutzt)
- get_stats_and_body() → kombinierte Tagesübersicht
- get_lactate_threshold() → LTHR für individuelle Zonen-Kalibrierung

NACH JEDER NEUEN AKTIVITÄT (Delta-Check: neue Aktivität seit letztem Sync?):
- get_last_activity() → Prüfen ob neue Aktivität vorhanden
- get_activity_details(activity_id) → sekündliche Rohdaten (HF, Pace, Kadenz, GPS)
- get_activity_splits(activity_id) → Lap/Kilometer-Splits
- get_activity_hr_in_timezones(activity_id) → exakte HF-Zonenverteilung
- get_activity_exercise_sets(activity_id) → Krafttraining-Sätze (Garmin-Uhr-Tracking)
- get_activity_weather(activity_id) → Wetterbedingungen beim Training
- get_activity_gear(activity_id) → Ausrüstung (Schuh-km tracken)
- get_activity_typed_splits(activity_id) → typisierte Splits

WÖCHENTLICH (jeden Montag zusätzlich):
- get_weekly_steps() → 52-Wochen-Schritte-Verlauf
- get_weekly_stress() → Stress-Trend
- get_endurance_score() → aerobe Basis-Entwicklung
- get_hill_score() → Kraft-Ausdauer-Trend
- get_running_tolerance() → Verletzungsrisiko-Indikator
- get_progress_summary_between_dates() → Wochen-/Monatsvergleich
- get_race_predictions() → 5k/10k/HM/Marathon-Prognose
- get_personal_records() → PRs aktualisieren
- get_gear_stats() → Schuh-Kilometerstand

DATENBANKSTRUKTUR:
- garmin_raw_metrics (alle täglichen Werte)
- garmin_activities (Basis-Infos jeder Einheit)
- garmin_activity_details (sekündliche Rohdaten, separat wegen Größe)
- garmin_activity_splits (Lap-Daten)
- garmin_activity_hr_zones (HF-Zonenverteilung pro Einheit)
- garmin_weekly_metrics (wöchentliche Aggregate)
- garmin_gear (Ausrüstung + Kilometerstand)
- garmin_race_predictions (Laufprognosen-Verlauf)

═══════════════════════════════════
TEIL 3 – READINESS-ENGINE
═══════════════════════════════════
PRIMÄR: Garmins native Training Readiness (0-100) direkt übernehmen – von Firstbeat Analytics validiert, nicht selbst nachbauen.
ERGÄNZEND: Transparente Faktor-Aufschlüsselung anzeigen (HRV vs. Baseline, Schlaf-Score, Body Battery, Recovery Time, Stress-Historie), damit sichtbar ist WARUM der Score so ist.

BASELINE-HANDLING: HRV-Baseline braucht ~19 Nächte. Solange unvollständig (v.a. neues Profil Frau): Zustand "Baseline wird aufgebaut" anzeigen, konservativ bleiben, keine aggressiven Empfehlungen.

ADAPTIONS-SCHWELLEN (Garmin-Konvention):
- 73-100 (PRIME): Hartes Training freigegeben, Progressive Overload, volles Volumen
- 34-72 (MODERAT): Intensität reduzieren, Zone 2 priorisieren, moderates Volumen
- <34 (NIEDRIG): Ruhetag oder reine Mobilität, kein produktives Training möglich

Jeder Trainingsvorschlag enthält eine BEGRÜNDUNG in einem Satz.
Beispiel: "Heute Zone 2 statt Intervalle: HRV 18% unter Baseline, Body Battery 42 beim Aufwachen."

═══════════════════════════════════
TEIL 4 – TRAININGSWISSENSCHAFT (Elite-Coaching-Logik)
═══════════════════════════════════

4a) HERZFREQUENZ-ZONEN – INDIVIDUELLE KALIBRIERUNG:
Zone 2 aus Garmin-LTHR (get_lactate_threshold) ableiten, NICHT aus "220-Alter" (ungenau, wertlos). Formel: Zone 2 = 65-80% LTHR. Im Dashboard Talk-Test / Nasenatemtest als praktische Gegenprüfung erklären. Solange LTHR nicht verfügbar: konservative Schätzung mit explizitem Hinweis.
Alle 5 Zonen auf Basis LTHR berechnen und dauerhaft im Profil hinterlegen.

4b) POLARISIERTES TRAININGSMODELL (80/20):
~80% des Gesamtvolumens in Zone 1-2 (aerob, fettverbrennend, HRV-schonend).
~20% hochintensiv (Zone 4-5, z.B. 4×4-Intervalle) NUR an Prime-Readiness-Tagen (Score ≥73).
Dashboard zeigt wöchentliche Zonenverteilung als Balken mit 80/20-Zielmarke.
EHRLICHE KOMMUNIKATION IM SYSTEM: Im Cut ist VO2max-ERHALT das realistische Ziel, keine großen Zuwächse. Zuwächse kommen im Bulk. Das System soll diese Erwartung explizit kommunizieren.

4c) AUTOREGULATION ÜBER RIR/RPE:
Keine starren Lasten-Vorgaben. Steuerung über Reps in Reserve (RIR).
Cut-Phase: Key-Lifts bei 1-2 RIR (nie Muskelversagen – produziert nur Ermüdung ohne Mehrwert im Defizit).
Bulk-Phase: 0-1 RIR an Spitzentagen erlaubt.
RIR-Feld im Kraft-Logger pflichtmäßig integrieren.

4d) CALISTHENICS-PROGRESSIONSLEITER:
Progression ist NICHT nur "Gewicht drauf". Pro Bewegungsmuster eine Leiter implementieren:
Klimmzug-Leiter: Negativ → Assisted → Bodyweight → Zusatzlast → Archer → Einarmig
Dip-Leiter: Negativ → Bodyweight → Zusatzlast → Ring-Dip → Bulgarian Dip
Push-Leiter: Normal → Archer → Pike Push-up → HSPU negativ → HSPU → Einarmig
Bein-Leiter: Squat → Bulgarian Split Squat → Pistol Squat negativ → Pistol Squat
Das System trackt das SKILL-LEVEL je Bewegungsmuster separat, schlägt die nächste Progression vor wenn Kriterien erfüllt (z.B. 3×10 sauber = Aufstieg).

4e) CONCURRENT-TRAINING-INTERFERENZ:
Laufen und Kraft stören sich bei falscher Sequenzierung (Interferenz-Effekt).
Regel 1: An Doppeltagen immer Kraft VOR Cardio oder mindestens 6h Abstand.
Regel 2: Harter Lauf (Zone 3+) nicht am Tag vor Beintag.
Regel 3: Zone-2-Läufe stören kaum – können flexibel geplant werden.
Das Wochenskelett muss diese Regeln automatisch einhalten.

4f) DELOAD-PROTOKOLL:
Alle 4-6 Wochen oder readiness-getriggert (3+ aufeinanderfolgende Tage Score <50) eine Entlastungswoche.
Deload: Volumen -40%, Intensität -20%, Frequenz gleich.
Im Cut nicht verhandelbar – Übertraining im Defizit ist das häufigste Plateau-Ursache.
Dashboard zeigt Countdown bis nächstem geplanten Deload.

4g) NEAT-ÜBERWACHUNG:
Im Kaloriendefizit sinkt unbewusst die Alltagsbewegung (NEAT) um 200-500 kcal/Tag – häufigster Grund für stagnierenden Cut.
Schritte-Trend (7-Tage-Mittel) im Dashboard permanent anzeigen.
Warnung wenn Schritte-Mittel >15% unter Vormonat fällt.
Ziel-Schritte: mindestens 8.000/Tag im Cut.

4h) SCHLAF ALS TRAININGSVARIABLE:
Schlaf beeinflusst Readiness, Erholung, Hunger-Hormone (Leptin/Ghrelin) und Muskelproteinsynthese direkt.
Dashboard zeigt Schlaf-Score als eigene Metrik mit Trend.
Bei <6h Schlaf: automatisch Intensität in Trainingsvorschlag reduzieren, unabhängig vom Readiness-Score.
Schlaf-Score geht als expliziter Faktor in die Trainingsempfehlung ein.

═══════════════════════════════════
TEIL 5 – PERIODISIERUNG
═══════════════════════════════════
Readiness darf den Plan NICHT täglich komplett umwerfen – das würde zu Detraining führen.

WOCHENSKELETT (fest, 5 Trainingstage):
Mo: Push – Brust, Schulter, Trizeps (Calisthenics)
Di: Zone-2-Lauf 45-60 min
Mi: Pull – Rücken, Bizeps (Calisthenics)
Do: Aktive Erholung / Mobilität
Fr: Legs & Core (Calisthenics)
Sa: Zone-2-Lauf 60 min
So: Ruhetag

READINESS-MODULATION (nur innerhalb des Skeletts):
- Prime (73-100): Plan wie vorgesehen, Volumen/Intensität voll
- Moderat (34-72): Intensität -20%, Volumen -15%, Zone-2-Anteil erhöhen
- Niedrig (<34): Einheit zu Mobilität/Spaziergang degradieren, NICHT streichen
- Geplante harte Einheiten bei moderater Readiness verschieben, nie ganz streichen

SICHERHEITSGRENZEN:
- Max. 2 aufeinanderfolgende Auto-Ruhetage, dann Hinweis: "Anhaltend niedrige Readiness – Schlaf, Stress und Ernährung prüfen."
- Deload überschreibt alle Readiness-Regeln (Vorrang)

═══════════════════════════════════
TEIL 6 – TÄGLICHE EINGABE & ERNÄHRUNG
═══════════════════════════════════

TÄGLICHE EINGABE (zentrale Steuergröße):
Ich gebe täglich im Dashboard ein:
- Körpergewicht (kg)
- Körperfettanteil KFA (%)
Diese Eingabe aktualisiert SOFORT den BMR und alle Makro-Vorgaben für den Tag.

TREND-SMOOTHING (Pflicht gegen Whipsaw):
Tagesgewicht schwankt 1-2 kg durch Wasser, Salz und Carbs.
Defizit-Berechnung und Selbstkalibrierung laufen auf dem 7-TAGE-GLEITENDEN MITTEL.
Die Tageseingabe füttert das Trend-Modell; die Stellgröße für Cut/Bulk ist immer der geglättete Verlauf.
Dashboard zeigt beides: Tageswert (grau, klein) + 7-Tage-Mittel (farbig, groß).

TDEE-BERECHNUNG (dynamisch):
BMR nach Katch-McArdle: 370 + (21,6 × Magermasse in kg)
Magermasse = Körpergewicht × (1 – KFA / 100)
+ Active Calories aus Garmin (täglich real ausgelesen)
Konservierungsfaktor für Kraft: Active Calories aus Krafttraining × 0,75 (Garmin überschätzt)
TDEE = BMR + korrigierte Active Calories

SELBSTKALIBRIERUNG (alle 14 Tage, Kernfeature):
Reale Gewichtsänderung (7-Tage-Mittel Woche 1 vs. Woche 2) mit erwarteter vergleichen.
Weicht >100g ab → TDEE-Schätzung automatisch nachjustieren.
Dashboard zeigt Kalibrier-Status: "TDEE-Schätzung: 2.890 kcal (kalibriert, letzte Anpassung +120 kcal vor 3 Tagen)."
Das echte Körpergewicht über Zeit ist die einzige Ground Truth.

ZIEL-PHASEN:
Cut (aktuell): TDEE −20% (konservativ, nicht −25%), Protein 2,2-2,5 g/kg Körpergewicht
Bulk (ab September): TDEE +300-500 kcal, Protein ~2,0 g/kg Körpergewicht
Phasenwechsel im Dashboard per Klick umschaltbar mit Stichtag-Eingabe.

REFEEDS / CARB-CYCLING:
An den 2 härtesten Trainingstagen der Woche (Push + Legs): Carbs +40-60g zum Tagesziel.
An Ruhetagen: Carbs −60-80g, Fett leicht erhöht.
Protein bleibt an ALLEN Tagen konstant (Muskelerhalt hat Vorrang).

MAKRO-BERECHNUNG (automatisch bei jeder Eingabe):
Protein: 2,3 g × Körpergewicht = Tagesgesamtziel
Fett: 20-25% der Gesamtkalorien (Hormonhaushalt)
Kohlenhydrate: Restliche Kalorien nach Protein + Fett

TAGESVERTEILUNG (5 Mahlzeiten, Training abends nach 18 Uhr):
Prinzipien: Protein gleichmäßig ~0,4 g/kg pro Mahlzeit (Leucin-Schwelle ~3g).
Carbs um Training konzentriert. Fett aus Pre-Workout-Mahlzeit raushalten.
Pre-Sleep: langsames Casein-Protein für nächtliche MPS.

BEISPIEL-BERECHNUNG (91 kg / 18,8% KFA / Cut / Trainingstag):
Magermasse: 91 × 0,812 = 73,9 kg
BMR: 370 + (21,6 × 73,9) = 1.966 kcal
TDEE (geschätzt): ~2.900 kcal → Ziel: 2.320 kcal
Makros: 210g Protein / 230g Carbs / 72g Fett

Mahlzeit 1 – Frühstück 07:00: 500 kcal | 45g P | 38g C | 18g F
Beispiel: Griechischer Joghurt (200g) + Haferflocken (60g) + Beeren + 2 Eier

Mahlzeit 2 – Mittag 12:30: 535 kcal | 45g P | 45g C | 18g F
Beispiel: Hühnerbrust (180g) + Reis (80g roh) + Gemüse + Olivenöl (10g)

Mahlzeit 3 – Pre-Workout 16:30 (2h vor Training): 400 kcal | 35g P | 55g C | 4g F
Beispiel: Magerquark (200g) + Banane + Reiswaffeln (40g) + Whey (30g)
KEIN Fett in dieser Mahlzeit (verlangsamt Verdauung)

Mahlzeit 4 – Post-Workout/Dinner 20:30: 640 kcal | 50g P | 75g C | 14g F
Beispiel: Lachs (200g) + Kartoffeln (300g) + Brokkoli + wenig Öl
Größter Carb-Block des Tages (Glykogen-Resynthese + MPS)

Mahlzeit 5 – Pre-Sleep 22:30: 440 kcal | 35g P | 17g C | 18g F
Beispiel: Hüttenkäse (250g) + Nüsse (20g) + Casein-Shake (30g)
Langsames Protein für nächtliche Muskelproteinsynthese

RUHETAG (gleiche Kalorien-Ziel −200 kcal, Carbs −80g, Fett +10g, Protein gleich):
Mahlzeit 1 – 07:00: 480 kcal | 45g P | 25g C | 22g F
Mahlzeit 2 – 12:00: 490 kcal | 45g P | 30g C | 20g F
Mahlzeit 3 – 16:00: 380 kcal | 40g P | 25g C | 16g F
Mahlzeit 4 – 19:30: 520 kcal | 45g P | 38g C | 18g F
Mahlzeit 5 – 22:30: 250 kcal | 35g P | 7g C | 9g F

Das System berechnet diese Werte täglich neu nach der Eingabe von Gewicht und KFA.
Im Dashboard wird für jeden Tag die vollständige Mahlzeitenübersicht mit kcal/P/C/F angezeigt.
Der Nutzer kann Mahlzeiten-Templates hinterlegen und aus einer Bibliothek wählen.

EVIDENZBASIERTES NÄHRSTOFF-TIMING (im Dashboard als Tagesguide):
Pre-Workout (30-60 min vor): leicht verdauliche Carbs, wenig Fett/Ballaststoffe
Zone-2-Lauf im Cut: auch nüchtern möglich und vorteilhaft für Fettoxidation
Post-Workout: 20-40g Protein innerhalb ~2h (Fenster ist weit, kein 30-Minuten-Stress)
Protein-Verteilung: alle ~3h, je 30-45g für optimale MPS-Stimulation
Pre-Sleep: 30-40g Casein – steigert nächtliche MPS nachweislich um ~22%
Alkohol: wird als Trainings-Störvariable im Dashboard markiert wenn geloggt

═══════════════════════════════════
TEIL 7 – KRAFTTRAINING & PROGRESSION
═══════════════════════════════════
SCHNELLEINGABE (Pflicht – sonst wird das Feature nicht genutzt):
Letzte Session automatisch vorbefüllen.
+/- Buttons für Sätze, Wiederholungen, Zusatzlast.
RIR-Feld (0-5) pro Satz pflichtmäßig.
Maximale Taps bis zum nächsten Satz: 3.

TRACKING-DATEN PRO EINHEIT:
- Übung + Variante (aus Progressionsleiter)
- Sätze × Wiederholungen × Gewicht (BW + Zusatz)
- RIR pro Satz
- Volumen automatisch berechnet: Sätze × Wdh × Gewicht
- Subjektive Einschätzung (1-5 Sterne)

PROGRESSIVE OVERLOAD CHECKS:
Bulk: Warnung wenn Volumen (Sätze×Wdh×kg) in einer Muskelgruppe 2 Wochen nicht steigt.
Cut: Warnung wenn Intensität (Durchschnitts-Gewicht) >10% fällt (Muskelabbau-Signal).
Calisthenics: Progression über Skill-Level-Leiter (nicht nur Last).

VISUALISIERUNGEN:
- Volumen-Trend pro Muskelgruppe (letzte 8 Wochen)
- Skill-Level-Fortschrittsbalken pro Bewegungsmuster
- Persönliche Rekorde mit Datum
- Volumen-Verteilung über Muskelgruppen (Balkendiagramm)

═══════════════════════════════════
TEIL 8 – VISUALISIERUNGEN & DASHBOARD
═══════════════════════════════════
HAUPTDASHBOARD (tägliche Ansicht):
- Readiness-Score (groß, zentriert, farbkodiert) + Faktor-Aufschlüsselung
- Heutiger Trainingsvorschlag + Begründung
- HRV-Trend (30 Tage) mit persönlichem Normbereich
- Body Battery Tagesverlauf
- Schlaf-Score + Phasen (letzte 7 Nächte gestapelt)
- Tages-Makros: Ziel vs. geplant (P/C/F Ringe)
- NEAT/Schritte: Heute + 7-Tage-Mittel + Trend

TRAININGS-ANALYSE (pro Aktivität):
Lauf: Pace-Kurve, HF-Verlauf, Zonen-Torte, km-Splits-Tabelle, Vergleich Vorwoche
Kraft: Volumen gesamt, Satz-für-Satz Log, Progressions-Delta, Skill-Level-Status

LANGZEIT-TRENDS (Woche/Monat/Quartal umschaltbar):
- VO2max + Fitness-Alter Verlauf
- Gewicht + KFA (Tageswerte grau + 7-Tage-Mittel farbig)
- Endurance Score + Hill Score
- HF-Zonen-Verteilung Wochen-Gesamt (80/20-Check)
- Ruhepuls-Trend
- Laufprognosen (5k/10k/HM/Marathon) mit Verlauf
- Schuh-Kilometerstand (Verletzungsprävention)
- Verletzungsrisiko-Indikator (Running Tolerance)

WOCHENPLAN-ANSICHT:
- 7-Tage-Kalender mit Einheiten + Status (geplant/erledigt/angepasst)
- Readiness-Farbe pro Tag
- Deload-Countdown
- Compliance-Rate (letzte 4 Wochen)
- Nächster Refeed-Tag markiert

RACE PREDICTION WIDGET:
- Aktuelle Prognosen 5k / 10k / Halbmarathon / Marathon
- Verlauf über Zeit (motivierend)

═══════════════════════════════════
TEIL 9 – MULTI-USER
═══════════════════════════════════
- 2 vollständige Profile: Daniel + Frau (eigene Garmin-Credentials, eigene Ziele, eigene Makros)
- Fraus Profil: Ziele, KFA, Gewicht werden separat hinterlegt und später definiert
- Geteilte Ansicht: beide können gegenseitig Dashboard + Wochenplan einsehen (read-only)
- Baseline-Status für Frau: explizit "Aufbauphase (~19 Nächte)" mit konservativen Empfehlungen
- Phasenwechsel (Cut/Bulk) pro Person individuell schaltbar

═══════════════════════════════════
MEIN PROFIL (vorausgefüllt)
═══════════════════════════════════
Name: Daniel
Gewicht: 91 kg (täglich manuell aktualisierbar)
KFA: 18,8% (täglich manuell aktualisierbar)
Magermasse: 73,9 kg (automatisch berechnet)
BMR: 1.966 kcal (automatisch, Katch-McArdle)
Phase: Cutphase aktiv → Bulk ab September (Datum einstellbar)
Ziele: HRV erhöhen, VO2max im Cut erhalten / im Bulk steigern, Fettabbau bei maximalem Muskelerhalt
Training: Calisthenics Push/Pull/Legs + Zone-2-Laufen, 5 Tage/Woche, abends nach 18 Uhr
Gerät: Garmin Smartwatch (Forerunner / Fenix)

═══════════════════════════════════
VORGEHEN – PHASEN-MVP
═══════════════════════════════════

PHASE 1 – MVP (zuerst zum Laufen bringen, dann iterieren):
1. DB-Schema (users, garmin_tokens, daily_metrics, daily_input, daily_readiness,
   garmin_activities, garmin_activity_details, garmin_activity_splits,
   garmin_activity_hr_zones, garmin_weekly_metrics, garmin_gear,
   garmin_race_predictions, strength_logs, nutrition_targets, training_plans)
2. Garmin-Sync-Worker: garth-Token-Auth, täglich 09:00 MEZ (DST-sicher),
   alle täglichen Endpunkte, Delta-Check für neue Aktivitäten
3. Readiness aus Garmin nativ übernehmen + Faktor-Aufschlüsselung anzeigen
4. Tageseingabe Gewicht/KFA → BMR + Makros automatisch berechnet,
   7-Tage-Trend-Glättung implementiert
5. Mahlzeitenplan mit vollständiger P/C/F-Verteilung über 5 Mahlzeiten,
   angepasst an Trainings- vs. Ruhetag, Carb-Cycling implementiert
6. Kraft-Logger: Schnelleingabe + RIR + Progressionsleiter-Tracking
7. Wochenskelett-Plan mit Readiness-Modulation
8. Next.js Dashboard: Hauptansicht + Trainingsanalyse
9. Railway-Deploy: web + worker, 2 Profile

PHASE 2 – INTELLIGENZ (nach stabilem MVP):
10. TDEE-Selbstkalibrierung (14-Tage-Gewichtstrend)
11. Vollständige Periodisierung + readiness-modulierte Wochenpläne mit Deload-Automatik
12. Calisthenics-Progressionsleiter vollständig mit Skill-Level-Vorschlägen
13. Polarisiertes Lauf-Modell: 80/20-Check + Zonen-Warnung
14. Post-Workout-Auswertung: automatisch nach Delta-Sync (was lief gut / was nicht)
15. NEAT-Warnsystem (Schritte-Trend)
16. Race Prediction Widget + Langzeit-Trends
17. Mahlzeiten-Template-Bibliothek
18. Frau-Profil vollständig aufsetzen

Frage mich nur: Ist eine Garmin-Waage (Index) vorhanden für automatischen KFA-Sync?
Dann beginne mit Phase 1, Schritt 1 – dem vollständigen DB-Schema.
