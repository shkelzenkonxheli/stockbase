const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

function normalizeCode39Value(value: string) {
  return value.trim().toUpperCase();
}

export function isCode39ValueSupported(value: string) {
  const normalized = normalizeCode39Value(value);
  return normalized.length > 0 && [...normalized].every((char) => char in CODE39_PATTERNS);
}

type Code39BarcodeProps = {
  value: string;
  height?: number;
  narrowBarWidth?: number;
  wideBarWidth?: number;
  className?: string;
};

export function Code39Barcode({
  value,
  height = 64,
  narrowBarWidth = 2,
  wideBarWidth = 5,
  className,
}: Code39BarcodeProps) {
  const normalized = normalizeCode39Value(value);

  if (!isCode39ValueSupported(normalized)) {
    return null;
  }

  const encodedValue = `*${normalized}*`;
  const bars: Array<{ x: number; width: number }> = [];
  let cursor = 0;

  encodedValue.split("").forEach((char, charIndex) => {
    const pattern = CODE39_PATTERNS[char];

    pattern.split("").forEach((token, tokenIndex) => {
      const width = token === "w" ? wideBarWidth : narrowBarWidth;
      const isBar = tokenIndex % 2 === 0;

      if (isBar) {
        bars.push({ x: cursor, width });
      }

      cursor += width;
    });

    if (charIndex < encodedValue.length - 1) {
      cursor += narrowBarWidth;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${cursor} ${height}`}
      aria-label={`Barcode ${normalized}`}
      role="img"
      className={className}
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width={cursor} height={height} fill="white" />
      {bars.map((bar, index) => (
        <rect
          key={`${bar.x}-${index}`}
          x={bar.x}
          y="0"
          width={bar.width}
          height={height}
          fill="black"
        />
      ))}
    </svg>
  );
}
