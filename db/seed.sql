-- ============================================================
-- Seed: Daniel-Profil + Mahlzeiten-Templates
-- Ausführen NACH schema.sql und NACH erstem NextAuth-Login
-- ============================================================

-- Wird via Script aufgerufen: psql $DATABASE_URL -f db/seed.sql
-- Erwartet: USER_EMAIL als Umgebungsvariable oder manuelle Anpassung

-- ============================================================
-- Mahlzeiten-Templates (global, user_id = NULL)
-- Trainingstag-Beispiele aus Spezifikation (91 kg / 18,8% KFA / Cut)
-- ============================================================

INSERT INTO meal_templates
    (template_name, meal_slot, calories, protein_g, carbs_g, fat_g, ingredients, is_training_day_suitable, is_rest_day_suitable)
VALUES
-- TRAININGSTAG
(
    'Frühstück – Trainingstag',
    'breakfast',
    500, 45, 38, 18,
    '[
        {"name": "Griechischer Joghurt", "amount": 200, "unit": "g"},
        {"name": "Haferflocken", "amount": 60, "unit": "g"},
        {"name": "Beeren (gemischt)", "amount": 80, "unit": "g"},
        {"name": "Eier (hart gekocht)", "amount": 2, "unit": "Stück"}
    ]',
    TRUE, FALSE
),
(
    'Mittag – Trainingstag',
    'lunch',
    535, 45, 45, 18,
    '[
        {"name": "Hühnerbrust", "amount": 180, "unit": "g"},
        {"name": "Basmatireis (roh)", "amount": 80, "unit": "g"},
        {"name": "Gemüse (Brokkoli/Paprika)", "amount": 150, "unit": "g"},
        {"name": "Olivenöl", "amount": 10, "unit": "g"}
    ]',
    TRUE, FALSE
),
(
    'Pre-Workout (16:30) – kein Fett',
    'pre_workout',
    400, 35, 55, 4,
    '[
        {"name": "Magerquark", "amount": 200, "unit": "g"},
        {"name": "Banane (mittel)", "amount": 120, "unit": "g"},
        {"name": "Reiswaffeln", "amount": 40, "unit": "g"},
        {"name": "Whey Protein", "amount": 30, "unit": "g"}
    ]',
    TRUE, FALSE
),
(
    'Post-Workout / Dinner (20:30)',
    'dinner',
    640, 50, 75, 14,
    '[
        {"name": "Lachs", "amount": 200, "unit": "g"},
        {"name": "Kartoffeln (gekocht)", "amount": 300, "unit": "g"},
        {"name": "Brokkoli", "amount": 150, "unit": "g"},
        {"name": "Olivenöl", "amount": 8, "unit": "g"}
    ]',
    TRUE, FALSE
),
(
    'Pre-Sleep – Trainingstag',
    'pre_sleep',
    440, 35, 17, 18,
    '[
        {"name": "Hüttenkäse", "amount": 250, "unit": "g"},
        {"name": "Nüsse (Mandeln/Walnüsse)", "amount": 20, "unit": "g"},
        {"name": "Casein-Shake", "amount": 30, "unit": "g"}
    ]',
    TRUE, FALSE
),

-- RUHETAG
(
    'Frühstück – Ruhetag',
    'breakfast',
    480, 45, 25, 22,
    '[
        {"name": "Eier (Rührei)", "amount": 3, "unit": "Stück"},
        {"name": "Griechischer Joghurt", "amount": 150, "unit": "g"},
        {"name": "Haferflocken", "amount": 40, "unit": "g"},
        {"name": "Avocado", "amount": 50, "unit": "g"}
    ]',
    FALSE, TRUE
),
(
    'Mittag – Ruhetag',
    'lunch',
    490, 45, 30, 20,
    '[
        {"name": "Thunfisch (Dose, Wasser)", "amount": 160, "unit": "g"},
        {"name": "Vollkornbrot", "amount": 60, "unit": "g"},
        {"name": "Salatmix", "amount": 100, "unit": "g"},
        {"name": "Olivenöl", "amount": 12, "unit": "g"}
    ]',
    FALSE, TRUE
),
(
    'Snack 16:00 – Ruhetag',
    'pre_workout',
    380, 40, 25, 16,
    '[
        {"name": "Magerquark", "amount": 250, "unit": "g"},
        {"name": "Beeren", "amount": 80, "unit": "g"},
        {"name": "Nüsse", "amount": 15, "unit": "g"},
        {"name": "Whey Protein", "amount": 25, "unit": "g"}
    ]',
    FALSE, TRUE
),
(
    'Abendessen – Ruhetag',
    'dinner',
    520, 45, 38, 18,
    '[
        {"name": "Hähnchenbrust", "amount": 200, "unit": "g"},
        {"name": "Süßkartoffel", "amount": 150, "unit": "g"},
        {"name": "Spinat / Gemüse", "amount": 150, "unit": "g"},
        {"name": "Olivenöl", "amount": 10, "unit": "g"}
    ]',
    FALSE, TRUE
),
(
    'Pre-Sleep – Ruhetag',
    'pre_sleep',
    250, 35, 7, 9,
    '[
        {"name": "Hüttenkäse", "amount": 250, "unit": "g"},
        {"name": "Casein-Shake", "amount": 20, "unit": "g"}
    ]',
    FALSE, TRUE
);

-- ============================================================
-- Hinweis: user_profiles und user-spezifische Daten
-- werden via POST /api/setup nach dem ersten Login angelegt.
-- Seed-Script befüllt nur globale Referenzdaten.
-- ============================================================

INSERT INTO schema_migrations(version) VALUES ('002_seed_initial')
ON CONFLICT DO NOTHING;
