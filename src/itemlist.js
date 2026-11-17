// These lists come out of notepad, Discord messages and spreadsheet columns, so
// a line may carry a bullet, a count or an odd apostrophe. None of that is the
// player's problem to clean up.
const BULLET = /^(?:[-*•]|\d+[.)]|\d+\s*x)\s*/i;
const COMMENT = /^(?:#|\/\/)/;

export function nameKey(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function itemLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !COMMENT.test(line))
    .map((line) => line.replace(BULLET, '').trim())
    .filter(Boolean);
}

export function matchItemNames(text, knownNames) {
  const byKey = new Map();
  for (const name of knownNames) {
    const key = nameKey(name);
    if (!byKey.has(key)) byKey.set(key, name);
  }
  const found = new Set();
  const unknown = new Set();
  for (const line of itemLines(text)) {
    const known = byKey.get(nameKey(line));
    if (known) found.add(known);
    else unknown.add(line);
  }
  return { found: [...found], unknown: [...unknown] };
}
