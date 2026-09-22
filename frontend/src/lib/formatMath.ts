export function formatMathText(text: string | null | undefined): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Replace LaTeX operators with standard Unicode Vietnamese Math symbols
  cleaned = cleaned.replace(/\\times\b/g, '×');
  cleaned = cleaned.replace(/\\div\b/g, ':');
  cleaned = cleaned.replace(/\\cdot\b/g, '.');
  cleaned = cleaned.replace(/\\leq?\b/g, '≤');
  cleaned = cleaned.replace(/\\geq?\b/g, '≥');
  cleaned = cleaned.replace(/\\neq\b/g, '≠');
  cleaned = cleaned.replace(/\\approx\b/g, '≈');
  cleaned = cleaned.replace(/\\pm\b/g, '±');
  cleaned = cleaned.replace(/\\degree\b|\\deg\b/g, '°');

  // 2. Replace LaTeX spacing commands (\, \; \: \! \ ) e.g. 400\,000 -> 400 000
  cleaned = cleaned.replace(/\\,/g, ' ');
  cleaned = cleaned.replace(/\\([;:!])/g, ' ');
  cleaned = cleaned.replace(/\\ /g, ' ');

  // 3. Convert \frac{a}{b} -> a/b
  cleaned = cleaned.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
    const n = num.trim();
    const d = den.trim();
    const cleanNum = n.includes('+') || n.includes('-') || n.includes(' ') ? `(${n})` : n;
    const cleanDen = d.includes('+') || d.includes('-') || d.includes(' ') ? `(${d})` : d;
    return `${cleanNum}/${cleanDen}`;
  });

  // 4. Square roots: \sqrt{x} -> √(x)
  cleaned = cleaned.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // 5. Remove LaTeX dollar sign delimiters: $...$ or $$...$$
  cleaned = cleaned.replace(/\$\$([^\$]+)\$\$/g, '$1');
  cleaned = cleaned.replace(/\$([^\$]+)\$/g, '$1');

  // 6. Clean remaining stray dollar signs or stray backslashes
  cleaned = cleaned.replace(/\$/g, '');
  cleaned = cleaned.replace(/\\([a-zA-Z]+)/g, '$1');
  cleaned = cleaned.replace(/\\([#$%&_{}])/g, '$1');
  cleaned = cleaned.replace(/\\/g, '');

  // 7. Normalize multiple spaces
  cleaned = cleaned.replace(/  +/g, ' ');


  return cleaned.trim();
}
