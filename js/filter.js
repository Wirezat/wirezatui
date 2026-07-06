/**
 * wuiFilter — filter an array of objects by a query string across given fields.
 *
 * Uses regex so the user can type partial patterns. Falls back to empty on
 * invalid regex. Supports array input (filter rows) or single object (boolean).
 *
 * @param {object[]|object} rows  - Array to filter, or single object to test
 * @param {string}          q     - Query string (empty → keep all)
 * @param {string[]}        fields - Object keys to search
 * @returns {object[]|boolean}
 */
export function wuiFilter(rows, q, fields) {
  if (!q) return Array.isArray(rows) ? rows : true;
  let re;
  try { re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
  catch { return Array.isArray(rows) ? [] : false; }
  const test = obj => fields.some(f => re.test(String(obj[f] ?? '')));
  return Array.isArray(rows) ? rows.filter(test) : test(rows);
}
