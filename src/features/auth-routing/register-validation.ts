export const MIN_PASSWORD_LENGTH = 8;

export type RegisterFields = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type RegisterErrors = Partial<Record<keyof RegisterFields, string>>;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * One message per field, written to say what to fix. Only length is enforced on
 * the password (story 2.1, default answer: 8 characters).
 */
export function validateRegister(fields: RegisterFields): RegisterErrors {
  const errors: RegisterErrors = {};
  if (!fields.firstName.trim()) errors.firstName = "Écris ton prénom";
  if (!fields.lastName.trim()) errors.lastName = "Écris ton nom";

  const email = fields.email.trim();
  if (!email) errors.email = "Écris ton courriel";
  else if (!isValidEmail(email)) {
    errors.email = "Ce courriel est incomplet. Écris-le sous la forme nom@exemple.com";
  }

  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`;
  }

  if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Les mots de passe ne correspondent pas";
  }
  return errors;
}
