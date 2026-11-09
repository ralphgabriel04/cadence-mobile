/**
 * How safe a new password looks, shown while the user types (stories 2.1 and 2.3).
 *
 * Informative only: the one hard rule stays the 8-character minimum checked by
 * the form and by Supabase. Pure function, no dependency (a full estimator such
 * as zxcvbn weighs about 800 kB, too much for this hint).
 *
 * Level 0 = too short, 1 = weak, 2 = fair, 3 = strong, 4 = very strong.
 * A password built on a very common word or pattern is capped at "weak",
 * whatever its length.
 */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export type PasswordStrength = {
  level: StrengthLevel;
  label: string;
  /** One short, concrete way to do better; null when nothing is left to suggest. */
  hint: string | null;
};

export const MIN_PASSWORD_LENGTH = 8;

const LABELS: Record<StrengthLevel, string> = {
  0: "Trop court",
  1: "Faible",
  2: "Moyen",
  3: "Fort",
  4: "Très fort",
};

function labelOf(level: StrengthLevel): string {
  switch (level) {
    case 0:
      return LABELS[0];
    case 1:
      return LABELS[1];
    case 2:
      return LABELS[2];
    case 3:
      return LABELS[3];
    default:
      return LABELS[4];
  }
}

// Words and keyboard runs that guessing lists try first (lower case, accents removed).
const COMMON = [
  "password",
  "motdepasse",
  "passe",
  "cadence",
  "azerty",
  "qwerty",
  "123456",
  "abcdef",
  "soleil",
  "bonjour",
  "iloveyou",
  "admin",
  "welcome",
  "football",
  "hockey",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** True for "aaaaaaaa", "abababab", "12121212" and similar repeats. */
function isRepeat(s: string): boolean {
  return /^(.{1,3})\1+$/.test(s);
}

/** True when every character follows the previous one (abcdefgh, 98765432). */
function isSequence(s: string): boolean {
  if (s.length < 4) return false;
  const step = s.charCodeAt(1) - s.charCodeAt(0);
  if (Math.abs(step) !== 1) return false;
  for (let i = 2; i < s.length; i++) {
    if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== step) return false;
  }
  return true;
}

function classes(pw: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
}

export function passwordStrength(password: string): PasswordStrength {
  const pw = password ?? "";
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return {
      level: 0,
      label: LABELS[0],
      hint: `Au moins ${MIN_PASSWORD_LENGTH} caractères`,
    };
  }

  const plain = normalize(pw);
  if (COMMON.some((w) => plain.includes(w)) || isRepeat(plain) || isSequence(plain)) {
    return {
      level: 1,
      label: LABELS[1],
      hint: "Évite les mots et les suites trop connus",
    };
  }

  const kinds = classes(pw);
  let score = 1;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (kinds >= 3) score++;
  if (kinds === 4) score++;
  const level = Math.min(score, 4) as StrengthLevel;

  let hint: string | null = null;
  if (level < 4) {
    if (pw.length < 12) hint = "Allonge-le à 12 caractères ou plus";
    else if (kinds < 3) hint = "Mélange majuscules, chiffres et symboles";
    else hint = "Ajoute un symbole ou quelques caractères";
  }
  return { level, label: labelOf(level), hint };
}
