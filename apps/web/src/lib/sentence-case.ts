/** "TIDAK BERPOTENSI TSUNAMI" -> "Tidak berpotensi tsunami" (labels from upstream packages). */
export function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase("id-ID");
  return lower.charAt(0).toLocaleUpperCase("id-ID") + lower.slice(1);
}
