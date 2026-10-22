/**
 * The device's current date as `yyyy-mm-dd`, in the device's own timezone.
 *
 * Why this exists rather than `new Date().toISOString().slice(0, 10)`:
 * `toISOString()` converts to UTC first. For an athlete in Montréal
 * (UTC-4 in summer), every evening from 20:00 local onward would report
 * tomorrow's date, and the home screen would show tomorrow's session for the
 * last four hours of every day. The same bug in reverse hits UTC+ timezones in
 * the early morning.
 *
 * get_today_screen() takes this value as a parameter precisely so the decision
 * of "which day is it" is made where the timezone is known -- on the device --
 * and never on the server.
 */
export function localDateISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
