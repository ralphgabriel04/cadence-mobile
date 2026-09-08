# Prompt Claude Design — Maquettes Cadence (copier-coller tel quel)

---

Crée un artifact HTML pour chacun des 4 écrans ci-dessous. Chaque artifact est un fichier HTML autonome (CSS dans `<style>`, pas de JS, pas de dépendances sauf Google Fonts). Dark mode par défaut. Mobile-first : viewport 390px de large.

---

## CONTEXTE PROJET

**Cadence** est une app SaaS bilingue FR/EN de coaching de force/fitness pour le marché québécois francophone. Mobile-first (React Native). Co-fondateurs : Ralph (dev/product) + Alexandre (design/UX).

**Slogan** : "Entraîne ton rythme"

**Logo** : concept "The Resonance" — deux sets d'arcs concentriques qui s'intersectent, symbolisant la résonance coach-athlète. Pour ces maquettes, utilise un placeholder SVG simple : deux groupes de 3 arcs semi-circulaires qui se chevauchent, en couleur accent sur fond transparent.

**Principes UX non-négociables** :
1. Athlete-first toujours
2. 3 secondes max pour comprendre chaque écran
3. Mobile-first, conçue pour le pouce
4. Dark mode par défaut
5. Français québécois natif (pas une traduction)

**Références esthétiques** : Linear (précision typographique), Things 3 (minimalisme), Hevy (densité athlétique). Premium et minimaliste — PAS générique.

---

## DESIGN TOKENS (à respecter strictement)

### Couleurs — Thème "Signal" (dark, primary)

```css
:root {
  --bg: #0C0C0F;
  --surface: #16161C;
  --surface2: #1E1E28;
  --border: #2A2A36;
  --text: #EEEEF5;
  --text-sub: #9090A8;
  --text-muted: #50506A;
  --accent: oklch(0.62 0.22 22);       /* orange-coral chaud */
  --accent-dim: oklch(0.18 0.06 22);   /* fond accent subtil */
  --accent-text: #fff;
  --pill-bg: #252534;
  --pill-text: #BBBBCC;
  --btn-primary-bg: oklch(0.62 0.22 22);
  --btn-primary-text: #fff;
  --btn-secondary-bg: #252534;
  --btn-secondary-text: #BBBBCC;
  --input-bg: #1E1E28;
  --input-border: #2A2A36;
  --success: #34D399;
  --error: #EF4444;
  --warning: #F59E0B;
}
```

### Typographie

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

body {
  font-family: 'DM Sans', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Échelle typo */
/* 22px/700 — page headers */
/* 18px/700 — card titles */
/* 15px/700 — button CTA */
/* 14px/600-700 — exercise names, labels */
/* 13px/500-600 — body text, secondary buttons */
/* 12px/600-700 — section headers */
/* 11px/700 uppercase letter-spacing:0.06em — petits labels */
/* 10px/700 — field labels, legend */
/* 9px/600 — metric labels */

/* Monospace pour les chiffres/données */
.mono { font-family: 'DM Mono', monospace; }

/* Letter spacing */
/* Headings: -0.02em à -0.03em (tight) */
/* Body: -0.01em (normal) */
/* Uppercase labels: 0.06em à 0.10em (loose) */
```

### Espacements

```
4px   — micro (entre petits items)
8px   — small gap
12px  — card internal padding, dividers
14px  — screen padding vertical
16px  — card padding standard
20px  — horizontal screen padding (margin: 0 20px)
28px  — large gap
32px  — bottom CTA spacing
```

### Border Radius

```
12px  — inputs, form fields
14px  — cards moyennes, badges
18px  — cards principales
40px  — boutons pill (full rounded)
50%   — éléments circulaires
```

### Composants clés

**Card standard** :
- Background: var(--surface)
- Border: 1px solid var(--border)
- Border-radius: 18px
- Padding: 14px 16px
- Stripe gauche : 4px de large, couleur accent, sur toute la hauteur (border-left: 4px solid var(--accent))

**Bouton primaire** :
- Background: var(--btn-primary-bg)
- Color: var(--btn-primary-text)
- Height: 50-56px
- Border-radius: 40px
- Font: 15px/700
- Width: 100%

**Bouton secondaire** :
- Background: var(--btn-secondary-bg)
- Color: var(--btn-secondary-text)
- Height: 44px
- Border-radius: 40px
- Font: 13px/600

**Input** :
- Background: var(--input-bg)
- Border: 1px solid var(--input-border)
- Border-radius: 12px
- Padding: 13px 14px
- Font: DM Sans 14px/500 (DM Mono pour les chiffres)
- Height: 46-50px
- Focus: border-color var(--accent)

**Pill/Badge** :
- Background: var(--pill-bg)
- Color: var(--pill-text)
- Border-radius: 14px
- Padding: 4px 10px
- Font: 11px/600

**Bottom Navigation** :
- Background: var(--surface)
- Border-top: 1px solid var(--border)
- Position: sticky bottom
- 4 items : icône (18px) + label
- Actif : couleur accent, weight 700
- Inactif : var(--text-muted), weight 500

**Section header (label uppercase)** :
- Font: 11px/700
- Color: var(--text-muted)
- Text-transform: uppercase
- Letter-spacing: 0.06em

---

## ÉCRAN 1 : Accueil athlète (`01-accueil.html`)

### Layout
- Status bar simulée en haut (heure, signal, batterie — en var(--text-muted))
- Header : "Bonjour, Félix" (22px/700), sous-titre "Lundi 6 mai" (13px/500, var(--text-sub))
- Séance du jour (card avec stripe accent à gauche) :
  - Label haut : "AUJOURD'HUI" (11px/700 uppercase, var(--text-muted))
  - Titre : "Force — Haut du corps" (18px/700)
  - Métadonnées en pills : "6 exercices" · "~55 min" · "Coach Alex"
  - Bouton primaire pleine largeur dans la card : "Commencer la séance" (avec flèche →)
- Section "Ta semaine" :
  - Compliance visuelle : 7 cercles (Lun-Dim), les jours complétés en accent plein, aujourd'hui avec border accent, futurs en var(--border)
  - Texte : "4/6 séances complétées" (13px/500, var(--text-sub))
  - Barre de progression linéaire en dessous (67% remplie en accent)
- Section "Dernière séance" (card) :
  - "Vendredi — Force — Bas du corps" (14px/600)
  - Stats en row : "8 exercices" · "52 min" · "2 PRs" (12px/500, var(--text-sub), les PRs en accent)
- Section "Prochains PRs potentiels" (card compacte) :
  - Liste de 2-3 items : "Squat — 5 kg de ton record" / "Développé couché — 2.5 kg"
  - Chaque item : icône flèche up + exercice + distance du PR (var(--text-sub))
- Bottom nav : Accueil (actif, accent) / Calendrier / Stats / Profil
- Padding horizontal : 20px partout

### Contenu réaliste
- Exercices : Squat, Soulevé de terre, Développé couché, Tirage barre, Rowing, Presse militaire
- Noms : Félix (athlète), Alex (coach)
- Pas d'emoji dans l'UI

---

## ÉCRAN 2 : Connexion (`02-connexion.html`)

### Layout
- Fond : var(--bg) plein écran
- Logo Cadence centré verticalement dans le tiers supérieur :
  - Placeholder SVG du logo "Resonance" (deux groupes d'arcs qui s'intersectent, en accent)
  - Wordmark "Cadence" en dessous (24px/700, var(--text), letter-spacing: -0.02em)
  - Slogan "Entraîne ton rythme" (13px/400 italic, var(--text-sub))
- Formulaire centré :
  - Input "Adresse courriel" (avec label flottant ou placeholder)
  - Input "Mot de passe" (type password, avec toggle visibilité œil)
  - Lien "Mot de passe oublié ?" aligné à droite (12px/500, var(--accent))
  - Bouton primaire : "Se connecter" (pleine largeur, 56px height)
- Séparateur : ligne avec "ou" au centre (var(--border), texte var(--text-muted))
- Bouton secondaire : "Continuer avec Apple" (icône Apple, style ghost)
- Bas de page : "Pas encore de compte ?" + "Créer un compte" en accent (13px/500)

### States visuels (CSS only)
- Focus sur input : border passe de var(--input-border) à var(--accent), transition 200ms
- Afficher aussi une version "état erreur" d'un input (border var(--error), message sous le champ en 12px var(--error))

---

## ÉCRAN 3 : Création de compte (`03-creation-compte.html`)

### Layout
- Header : flèche retour "←" + "Créer un compte" (18px/700)
- Section choix de rôle (deux cards côte à côte, même taille) :
  - Card "Je suis athlète" : icône haltère, titre, sous-texte "Suis tes entraînements et ta progression" (12px, var(--text-sub))
  - Card "Je suis coach" : icône clipboard/profil, titre, sous-texte "Crée des programmes pour tes athlètes"
  - Card sélectionnée : border accent + fond var(--accent-dim)
  - Card non sélectionnée : border var(--border) + fond var(--surface)
- Champs (affichés après sélection du rôle — montre-les tous pour la maquette) :
  - Row : Prénom + Nom (50/50)
  - Adresse courriel
  - Mot de passe (avec indicateur de force en dessous : barre 4 segments, couleur progressive rouge→jaune→vert)
  - Confirmer le mot de passe
- Checkbox : "J'accepte les [conditions d'utilisation] et la [politique de confidentialité]" (12px, liens en accent)
- Mention : "Vos données sont protégées au Québec (Loi 25)" (10px/500, var(--text-muted), avec icône cadenas)
- Bouton primaire : "Créer mon compte" (pleine largeur)
- Bas : "Déjà un compte ?" + "Se connecter" en accent

---

## ÉCRAN 4 : Stats athlète (`04-stats.html`)

### Layout
- Header : "Statistiques" (22px/700) + sélecteur de période en pills ("7 j" / "30 j" / "3 mois" / "1 an", avec 30j actif en accent)
- Row de 3 metric cards (mini, côte à côte) :
  - "Compliance" : "83 %" (26px/600 DM Mono, accent) + "cette semaine" (9px, var(--text-muted))
  - "Séances" : "14" + "ce mois" 
  - "PRs" : "5" + "ce mois" (en accent)
- Graphique principal — Volume hebdomadaire (8 semaines) :
  - Label section : "VOLUME HEBDOMADAIRE" (11px/700 uppercase)
  - Bar chart CSS : 8 barres verticales, hauteurs variées, couleur accent (opacity 0.8), barre courante plus brillante
  - Axe X : labels semaines "S14" à "S21" (9px DM Mono, var(--text-muted))
  - Axe Y implicite (pas de gridlines, juste les barres — minimaliste)
  - Tooltip simulé sur une barre : "S20 — 12 450 kg" (petit card flottante)
- Graphique secondaire — Progression exercices clés :
  - Label : "PROGRESSION — EXERCICES CLÉS" 
  - Line chart CSS simulé : 2-3 lignes (Squat, Développé couché, Soulevé de terre)
  - Légende en bas avec points colorés + nom exercice (accent pour squat, var(--text-sub) pour les autres — utilise opacity pour différencier)
  - Axe X : "Fév" "Mar" "Avr" "Mai" (9px DM Mono)
- Section "Derniers PRs" (liste) :
  - Label : "RECORDS PERSONNELS RÉCENTS"
  - 4-5 items : date (var(--text-muted)) + exercice (var(--text)) + poids (accent, DM Mono) + badge "PR" en pill accent-dim
  - Exemples : "2 mai — Squat — 145 kg", "28 avr — Développé couché — 102.5 kg", "25 avr — Soulevé de terre — 180 kg"
- Bottom nav : Accueil / Calendrier / Stats (actif) / Profil

### Données réalistes
- Volume : entre 8 000 et 14 000 kg par semaine
- PRs : poids crédibles pour un rameur universitaire masculin (Squat ~145kg, Bench ~102.5kg, Dead ~180kg)
- Compliance : 83% (5/6 séances)

---

## ANTI-PATTERNS À ÉVITER

- **Pas de gradients pastels** ni de dégradés multicolores
- **Pas de cards avec coins arrondis géants** (max 18px)
- **Pas de shadows exagérées** — en dark mode, ombres très subtiles ou absentes
- **Pas d'illustrations AI-style** (pas de blobs, pas de personnages abstraits)
- **Pas d'emoji** dans l'interface
- **Pas de gamification vide** (pas de streaks, confettis, badges creux)
- **Pas de lorem ipsum** — tout le texte est du vrai contenu en français québécois
- **Pas de "Bienvenue !"** avec point d'exclamation partout — ton sobre et pro
- **Typographie serrée** pour les headings (letter-spacing négatif), pas de text-transform sur les titres principaux

---

## INSTRUCTIONS TECHNIQUES

1. Chaque écran = 1 artifact HTML complet et autonome
2. CSS dans `<style>` — pas de fichier externe sauf Google Fonts via `@import`
3. Pas de JavaScript
4. Viewport : `<meta name="viewport" content="width=device-width, initial-scale=1">`
5. Container principal : `max-width: 390px; margin: 0 auto;` (centré sur desktop pour preview)
6. Background du `body` : var(--bg) qui déborde sur tout l'écran
7. Toutes les transitions : `transition: all 200ms ease`
8. Icônes : SVG inline simples (flèches, check, haltère, graphique, profil — 18px, stroke 1.5, stroke-linecap round)
9. Les inputs en focus doivent avoir un state visible (border accent)
10. Utilise `:checked` + CSS siblings pour simuler la sélection des cards rôle (écran 3) et des pills période (écran 4)
11. Accessibilité : labels `aria-label`, contrastes WCAG AA, `:focus-visible` outlines

---

Commence par l'écran 1 (Accueil). Génère un artifact HTML complet. Ensuite je te demanderai les suivants un par un.
