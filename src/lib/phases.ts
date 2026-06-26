/**
 * Phasen-Presets + wissenschaftlich fundierter Ratgeber.
 *
 * Zentrale Quelle für:
 *  - Kaloriendelta je Phase (für Macro-Engine in nutrition.ts)
 *  - Protein-/Fett-Floor zum Schutz von Muskulatur & Hormonen
 *  - Trainings-Empfehlung (Zone-2-only vs. VO2max/Sprints erlaubt)
 *  - Ratgeber-Texte (Hormone, Körperkomposition, Training, Warnungen)
 *
 * Belege (Kurzform, peer-reviewed):
 *  - Helms et al. 2014 (JISSN): Protein 2.3–3.1 g/kg Magermasse im Defizit schützt Muskulatur.
 *  - Trexler et al. 2014 (JISSN): metabolische Adaptation – Leptin/T3/Testosteron ↓ bei großem/langem Defizit.
 *  - Murphy & Koehler 2022: je aggressiver/länger das Defizit, desto höher der Magermasse-Verlust.
 *  - Mäestu et al. 2010: sehr niedriges KFA + großes Defizit senkt Testosteron deutlich.
 *  - Iraki et al. 2019 (Sports): Lean-Bulk +10–20 % über Erhalt minimiert Fettzuwachs.
 *  - Garthe et al. 2011: langsamer Aufbau (0.5 kg/Woche) = besseres Verhältnis Muskel:Fett.
 */

export type Phase = 'cut' | 'bulk' | 'maintenance' | 'baseline_building'

/** Trainings-Intensitätsfreigabe je Phase */
export type CardioGuidance = 'zone2_only' | 'polarized_reduced' | 'polarized' | 'vo2max_ok'

export interface PhasePreset {
  key: string
  phase: Phase
  label: string
  /** Kurzlabel für Buttons, z.B. "−1000 kcal · max 2 Wo" */
  short: string
  /** absolutes Kaloriendelta auf den TDEE (kcal/Tag) */
  deltaKcal: number
  /** empfohlene maximale Dauer am Stück (Wochen); null = unbegrenzt */
  maxWeeks: number | null
  /** Protein-Ziel in g pro kg Körpergewicht */
  proteinPerKg: number
  /** Mindest-Fett in g pro kg Körpergewicht (Hormon-Schutz) */
  minFatPerKg: number
  /** Lauf-/Cardio-Freigabe */
  cardio: CardioGuidance
  /** Akzentfarbe (Hex) für UI */
  color: string
  /** ~ erwartete Gewichtsänderung pro Woche, für Anzeige */
  expectedRate: string

  // Ratgeber-Blöcke
  hormone: string
  body: string
  training: string
  warning: string | null
}

const CARDIO_LABEL: Record<CardioGuidance, { label: string; detail: string; color: string }> = {
  zone2_only: {
    label: 'Nur Zone 2',
    detail: 'Ausschließlich lockeres Zone-2-Laufen. KEINE Sprints, kein HIIT, kein VO2max — Glykogen, ZNS und Hormonachse sind im Defizit überlastet, Verletzungs- & Übertrainingsrisiko steigt stark.',
    color: '#22c55e',
  },
  polarized_reduced: {
    label: 'Polarisiert (reduziert)',
    detail: '80 % Zone 2, max. 1× kurzes Intervall/Woche. Sprint-Volumen bewusst niedrig halten — im Defizit erholt sich das ZNS langsamer.',
    color: '#86efac',
  },
  polarized: {
    label: 'Polarisiert 80/20',
    detail: '80 % Zone 1–2, 20 % Zone 4–5. Zone 3 meiden. Volle Intensitätsverträglichkeit bei Erhalt.',
    color: '#3b82f6',
  },
  vo2max_ok: {
    label: 'VO2max & Sprints OK',
    detail: 'Im Kalorienüberschuss ist die Erholung gut: VO2max-Intervalle, Sprints und harte Schwellen-Einheiten sind freigegeben — ideal um die aerobe Decke anzuheben.',
    color: '#f97316',
  },
}

export function cardioInfo(g: CardioGuidance) {
  return CARDIO_LABEL[g]
}

export const PHASE_PRESETS: PhasePreset[] = [
  {
    key: 'cut_aggressive',
    phase: 'cut',
    label: 'Aggressiver Cut',
    short: '−1000 kcal · max 2 Wo',
    deltaKcal: -1000,
    maxWeeks: 2,
    proteinPerKg: 2.6,
    minFatPerKg: 0.8,
    cardio: 'zone2_only',
    color: '#ef4444',
    expectedRate: '≈ −1.0 kg/Woche',
    hormone:
      'Großes Defizit senkt schnell Leptin, Schilddrüsenhormon (T3) und Testosteron, während Cortisol steigt. Das bremst Stoffwechsel & Erholung und erhöht den Muskelabbau-Druck. Nur als kurzes Werkzeug einsetzen.',
    body:
      'Schnellster Fettverlust (~1 kg/Woche), aber höchstes Risiko für Magermasse-Verlust und Heißhunger. Protein zwingend hoch (2.6 g/kg), um die Muskulatur zu schützen.',
    training:
      'Laufen nur in Zone 2 — keine Sprints/HIIT/VO2max. Krafttraining: Volumen (Sätze) reduzieren, aber die Last/Intensität halten — das ist der stärkste Muskel-Erhalt-Reiz im Defizit.',
    warning:
      'Maximal 2 Wochen am Stück. Danach mindestens 1 Woche Erhalt (Diätpause/Refeed), bevor erneut aggressiv. Nicht für Einsteiger oder bei < 12 % KFA.',
  },
  {
    key: 'cut_moderate',
    phase: 'cut',
    label: 'Moderater Cut',
    short: '−500 kcal · Standard',
    deltaKcal: -500,
    maxWeeks: 12,
    proteinPerKg: 2.3,
    minFatPerKg: 0.8,
    cardio: 'polarized_reduced',
    color: '#f59e0b',
    expectedRate: '≈ −0.5 kg/Woche',
    hormone:
      'Moderates Defizit hält die Hormonachse weitgehend stabil. Leichte Adaptation (Leptin/NEAT ↓) über Wochen ist normal — mit Refeeds und Diätpausen gut abzufedern.',
    body:
      'Der „Sweet Spot“: ~0.5 kg/Woche Fettverlust bei sehr gutem Muskelerhalt. Für die meisten Diätphasen die richtige Wahl.',
    training:
      'Polarisiert mit reduziertem Intensitäts-Volumen: überwiegend Zone 2, max. ein kurzes Intervall pro Woche. Krafttraining im gewohnten Volumen, ggf. letzte Wochen leicht reduzieren.',
    warning:
      'Nach ~8–12 Wochen eine Erhaltungsphase einlegen, um metabolische Adaptation zurückzusetzen.',
  },
  {
    key: 'cut_lean',
    phase: 'cut',
    label: 'Lean / Mini-Cut',
    short: '−300 kcal · muskelschonend',
    deltaKcal: -300,
    maxWeeks: 16,
    proteinPerKg: 2.2,
    minFatPerKg: 0.9,
    cardio: 'polarized',
    color: '#84cc16',
    expectedRate: '≈ −0.25 kg/Woche',
    hormone:
      'Kleinstes Defizit — kaum hormonelle Adaptation. Testosteron, Schilddrüse und Schlaf bleiben stabil, Trainingsleistung hoch.',
    body:
      'Langsamer, sehr muskelschonender Fettabbau. Ideal nahe Wettkampfform, für Recompositioning oder wenn Leistung Priorität hat.',
    training:
      'Volle polarisierte Bandbreite (80/20) möglich — auch Intervalle. Krafttraining kann progressiv bleiben, Recomposition realistisch.',
    warning: null,
  },
  {
    key: 'maintenance',
    phase: 'maintenance',
    label: 'Erhalt',
    short: '±0 kcal · stabil',
    deltaKcal: 0,
    maxWeeks: null,
    proteinPerKg: 2.0,
    minFatPerKg: 0.9,
    cardio: 'polarized',
    color: '#64748b',
    expectedRate: 'Gewicht stabil',
    hormone:
      'Energiebalance ausgeglichen — Hormone, Leptin und Schilddrüse normalisieren sich. Beste Phase für Erholung der Stoffwechselrate nach einer Diät.',
    body:
      'Gewicht stabil. Diätpause zwischen Cut-Blöcken oder Brücke vor einem Aufbau. Recomposition für Einsteiger möglich.',
    training:
      'Volle Intensitätsverträglichkeit, polarisiert 80/20. Gute Phase für Leistungstests (FTP, VO2max, Maximalkraft).',
    warning: null,
  },
  {
    key: 'lean_bulk',
    phase: 'bulk',
    label: 'Lean Bulk',
    short: '+250 kcal · sauber',
    deltaKcal: 250,
    maxWeeks: null,
    proteinPerKg: 2.0,
    minFatPerKg: 1.0,
    cardio: 'vo2max_ok',
    color: '#3b82f6',
    expectedRate: '≈ +0.2 kg/Woche',
    hormone:
      'Leichter Überschuss: anaboles Milieu (Testosteron/IGF-1 unterstützt), gute Schlafqualität, Cortisol niedrig. Minimaler Fettzuwachs.',
    body:
      'Langsamer, sauberer Muskelaufbau mit minimalem Fettpolster (~0.2 kg/Woche). Bestes Muskel-zu-Fett-Verhältnis — empfohlener Standard-Aufbau.',
    training:
      'Volle Freigabe: VO2max-Intervalle und Sprints sind erlaubt und sinnvoll, da die Erholung im Überschuss gut ist. Krafttraining progressiv mit steigendem Volumen.',
    warning: 'Gewichtszunahme kontrollieren — > 0.3 kg/Woche bedeutet meist überflüssigen Fettaufbau.',
  },
  {
    key: 'bulk_moderate',
    phase: 'bulk',
    label: 'Moderater Bulk',
    short: '+500 kcal · Aufbau',
    deltaKcal: 500,
    maxWeeks: null,
    proteinPerKg: 1.9,
    minFatPerKg: 1.0,
    cardio: 'vo2max_ok',
    color: '#6366f1',
    expectedRate: '≈ +0.4 kg/Woche',
    hormone:
      'Deutlicher Überschuss: stark anaboles Milieu, aber ein Teil der Energie geht in Fettaufbau. Insulinsensitivität langfristig im Auge behalten.',
    body:
      'Schnellerer Aufbau (~0.4 kg/Woche) für Hardgainer oder klare Muskelaufbau-Blöcke — mit höherem Fettanteil als beim Lean Bulk.',
    training:
      'VO2max & Sprints voll freigegeben. Überschuss-Energie optimal für harte Intervalle und Volumen-Progression im Kraftraum nutzen.',
    warning: 'Nach 12–16 Wochen Aufbau einen Mini-Cut erwägen, um die Insulinsensitivität zu erhalten.',
  },
  {
    key: 'baseline_building',
    phase: 'baseline_building',
    label: 'Aerobe Basis',
    short: '±0 kcal · Zone-2-Fokus',
    deltaKcal: 0,
    maxWeeks: null,
    proteinPerKg: 1.8,
    minFatPerKg: 0.9,
    cardio: 'zone2_only',
    color: '#14b8a6',
    expectedRate: 'Gewicht stabil',
    hormone:
      'Ausgeglichene Energiebilanz bei niedriger Trainingsbelastung — schont die Hormonachse, ideal für Einsteiger oder Wiedereinstieg.',
    body:
      'Fokus auf Aufbau der aeroben Grundlage statt Gewichtsänderung. Empfohlen, bis die HRV-Baseline (~19 Nächte) steht.',
    training:
      'Zone-2-Schwerpunkt (Mo/Mi/Fr), Mobilität dazwischen. Noch keine harten Intervalle — erst Grundlage, dann Intensität.',
    warning: null,
  },
]

const PRESET_MAP = new Map(PHASE_PRESETS.map(p => [p.key, p]))

/** Default-Preset je Basis-Phase (für Migration alter Profile ohne preset). */
const DEFAULT_BY_PHASE: Record<Phase, string> = {
  cut: 'cut_moderate',
  bulk: 'lean_bulk',
  maintenance: 'maintenance',
  baseline_building: 'baseline_building',
}

/**
 * Liefert das Preset zu einem Key. Fällt auf das Default-Preset der Basis-Phase
 * zurück, falls der Key unbekannt ist oder null übergeben wurde.
 */
export function getPhasePreset(key: string | null | undefined, fallbackPhase: Phase = 'cut'): PhasePreset {
  if (key && PRESET_MAP.has(key)) return PRESET_MAP.get(key)!
  return PRESET_MAP.get(DEFAULT_BY_PHASE[fallbackPhase])!
}

export function presetsForPhase(phase: Phase): PhasePreset[] {
  return PHASE_PRESETS.filter(p => p.phase === phase)
}
