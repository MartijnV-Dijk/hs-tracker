// No packet says how much experience a hero level needs, and the client works
// it out in compiled code rather than reading a table. These anchors are the
// community's published Season 9 figures plus one Season 10 reading at hero
// level 10, as gathered by the KewkLW/hs-tracker fork. Every figure built on
// them is an estimate, and the panel says so.
const ANCHORS = [
  [0, 3_208_120],
  [3, 3_412_559],
  [10, 4_123_490],
  [21, 5_265_277],
  [36, 8_196_982],
  [38, 8_734_805],
  [52, 13_950_774],
  [72, 28_654_905],
  [149, 177_327_360],
];

export function heroXpRequired(level) {
  if (!Number.isFinite(level) || level < 0) return null;
  const whole = Math.floor(level);
  const upper = ANCHORS.findIndex(([anchorLevel]) => anchorLevel >= whole);
  const [[fromLevel, fromXp], [toLevel, toXp]] =
    upper === -1 ? ANCHORS.slice(-2) : [ANCHORS[Math.max(0, upper - 1)], ANCHORS[Math.max(1, upper)]];
  return Math.round(fromXp + ((toXp - fromXp) * (whole - fromLevel)) / (toLevel - fromLevel));
}

// The game's own bar can stand past the estimate. Taking the larger of the two
// keeps the bar from overflowing and the next level from looking already due.
export function levelProgress(herolevel, xpInLevel) {
  const required = Math.max(heroXpRequired(herolevel) ?? 0, xpInLevel);
  return { required, share: required > 0 ? xpInLevel / required : 0 };
}

export function levelForecast(herolevel, xpInLevel, xpPerHour, count) {
  const rows = [];
  let needed = 0;
  for (let step = 0; step < count; step += 1) {
    const level = herolevel + step;
    needed += step === 0 ? levelProgress(level, xpInLevel).required - xpInLevel : heroXpRequired(level);
    rows.push({ level: level + 1, needed, secs: xpPerHour > 0 ? (needed / xpPerHour) * 3600 : null });
  }
  return rows;
}
