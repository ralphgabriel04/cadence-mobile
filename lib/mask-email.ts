/**
 * Masks an email address to prevent shoulder surfing.
 *
 * Rules:
 * - Shows first 2 and last 2 chars of the local part, replaces the rest with asterisks
 * - If local part is 4 chars or fewer, shows first char + "***"
 * - Domain remains fully visible
 *
 * @example maskEmail("christian8339@hotmail.com") // "ch*********39@hotmail.com"
 * @example maskEmail("jo@gmail.com")              // "j***@gmail.com"
 * @example maskEmail("test@cadence.app")          // "t***@cadence.app"
 * @example maskEmail("hello@cadence.app")         // "he*lo@cadence.app"
 */
export function maskEmail(email: string): string {
  if (!email) return "";

  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;

  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  if (local.length <= 4) {
    return local[0] + "***" + domain;
  }

  const first = local.substring(0, 2);
  const last = local.substring(local.length - 2);
  const middleLength = local.length - 4;
  const masked = "*".repeat(middleLength);

  return first + masked + last + domain;
}
