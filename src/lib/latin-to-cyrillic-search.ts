/**
 * Латиница → кириллица для поиска имён карт (Avalon).
 * Обрабатывается каждый сегмент между "-" отдельно, затем сегменты склеиваются
 * (как при normalize без дефисов), чтобы "ia" не цеплялась через границу слова.
 */

const MULTI: readonly { from: string; to: string }[] = [
  { from: "sch", to: "щ" },
  { from: "sh", to: "ш" },
  { from: "ch", to: "ч" },
  { from: "zh", to: "ж" },
  { from: "kh", to: "х" },
  { from: "th", to: "т" },
  { from: "ts", to: "ц" },
  { from: "ng", to: "нг" },
  { from: "ph", to: "ф" },
  { from: "qu", to: "кв" },
  { from: "ya", to: "я" },
  { from: "yu", to: "ю" },
  { from: "ye", to: "е" },
  { from: "yo", to: "ё" },
  { from: "yi", to: "и" },
  { from: "ay", to: "ай" },
  { from: "ey", to: "ей" },
  { from: "oy", to: "ой" },
  { from: "uy", to: "уй" },
  { from: "ie", to: "ие" },
  { from: "io", to: "ио" },
  { from: "ia", to: "я" },
  { from: "iu", to: "ю" },
].sort((a, b) => b.from.length - a.from.length);

const SINGLE: Record<string, string> = {
  a: "а",
  b: "б",
  c: "к",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "кс",
  y: "й",
  z: "з",
};

export function translitLatinSegmentForSearch(segment: string): string {
  const s = segment.toLowerCase();
  let i = 0;
  let out = "";
  while (i < s.length) {
    let matched = false;
    if (/[a-z]/.test(s[i]!)) {
      for (const { from, to } of MULTI) {
        if (s.slice(i, i + from.length) === from) {
          out += to;
          i += from.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const ch = s[i]!;
        out += SINGLE[ch] ?? ch;
        i += 1;
      }
    } else {
      out += s[i]!;
      i += 1;
    }
  }
  return out;
}

export function latinNameToCyrillicSearchString(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((part) => translitLatinSegmentForSearch(part))
    .join("");
}
