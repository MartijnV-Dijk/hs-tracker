// Excel reads a CSV with the list separator of the machine's region, and in
// every region that writes 1,5 for one and a half that separator is a
// semicolon. A comma file opened there lands in a single column.
export function csvDelimiter(locale) {
  return (1.5).toLocaleString(locale).includes(',') ? ';' : ',';
}

export function localStamp(ms) {
  const at = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

// The byte order mark is what makes Excel read the file as UTF-8, so a
// character or zone name outside plain ASCII survives the round trip.
export function toCsv(header, rows, delimiter = ',') {
  const cell = (value) => {
    const text = String(value ?? '');
    return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(delimiter)).join('\r\n') + '\r\n';
}
