// Character-level alignment (ElevenLabs shape) -> per-word timings in seconds.
// Words are whitespace-delimited runs, in text order, which matches how timeline.js tokenizes.
export function alignmentToWords(alignment) {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!chars || !starts || !ends || chars.length !== starts.length || chars.length !== ends.length) {
    throw new Error('Voice service returned no usable alignment');
  }
  const words = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i])) {
      if (cur) { words.push(cur); cur = null; }
    } else if (!cur) cur = { start: starts[i], end: ends[i] };
    else cur.end = ends[i];
  }
  if (cur) words.push(cur);
  return words;
}

export const countWords = (text) => text.split(/\s+/).filter(Boolean).length;
