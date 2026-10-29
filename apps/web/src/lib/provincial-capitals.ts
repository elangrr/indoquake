/** The capital of each of the 38 provinces (seat of the provincial government), keyed by province slug. */
export interface ProvincialCapital {
  name: string;
  latitude: number;
  longitude: number;
}

export const PROVINCIAL_CAPITALS: Readonly<Record<string, ProvincialCapital>> = {
  aceh: { name: "Banda Aceh", latitude: 5.5483, longitude: 95.3238 },
  "sumatera-utara": { name: "Medan", latitude: 3.5952, longitude: 98.6722 },
  "sumatera-barat": { name: "Padang", latitude: -0.9471, longitude: 100.4172 },
  riau: { name: "Pekanbaru", latitude: 0.5071, longitude: 101.4478 },
  "kepulauan-riau": { name: "Tanjung Pinang", latitude: 0.9186, longitude: 104.4554 },
  jambi: { name: "Jambi", latitude: -1.6101, longitude: 103.6131 },
  "sumatera-selatan": { name: "Palembang", latitude: -2.9761, longitude: 104.7754 },
  "kepulauan-bangka-belitung": { name: "Pangkalpinang", latitude: -2.1316, longitude: 106.1169 },
  bengkulu: { name: "Bengkulu", latitude: -3.7928, longitude: 102.2608 },
  lampung: { name: "Bandar Lampung", latitude: -5.4292, longitude: 105.261 },
  banten: { name: "Serang", latitude: -6.1104, longitude: 106.1503 },
  "dki-jakarta": { name: "Jakarta", latitude: -6.1862, longitude: 106.834 },
  "jawa-barat": { name: "Bandung", latitude: -6.9175, longitude: 107.6191 },
  "jawa-tengah": { name: "Semarang", latitude: -6.9667, longitude: 110.4167 },
  "di-yogyakarta": { name: "Yogyakarta", latitude: -7.7956, longitude: 110.3695 },
  "jawa-timur": { name: "Surabaya", latitude: -7.2575, longitude: 112.7521 },
  bali: { name: "Denpasar", latitude: -8.6705, longitude: 115.2126 },
  "nusa-tenggara-barat": { name: "Mataram", latitude: -8.5833, longitude: 116.1167 },
  "nusa-tenggara-timur": { name: "Kupang", latitude: -10.1772, longitude: 123.607 },
  "kalimantan-barat": { name: "Pontianak", latitude: -0.0263, longitude: 109.3425 },
  "kalimantan-tengah": { name: "Palangka Raya", latitude: -2.2161, longitude: 113.9135 },
  "kalimantan-selatan": { name: "Banjarbaru", latitude: -3.4572, longitude: 114.8103 },
  "kalimantan-timur": { name: "Samarinda", latitude: -0.5022, longitude: 117.1536 },
  "kalimantan-utara": { name: "Tanjung Selor", latitude: 2.8375, longitude: 117.3653 },
  "sulawesi-utara": { name: "Manado", latitude: 1.4748, longitude: 124.8421 },
  gorontalo: { name: "Gorontalo", latitude: 0.5435, longitude: 123.0568 },
  "sulawesi-tengah": { name: "Palu", latitude: -0.8917, longitude: 119.8707 },
  "sulawesi-barat": { name: "Mamuju", latitude: -2.6748, longitude: 118.8885 },
  "sulawesi-selatan": { name: "Makassar", latitude: -5.1477, longitude: 119.4327 },
  "sulawesi-tenggara": { name: "Kendari", latitude: -3.9985, longitude: 122.5129 },
  maluku: { name: "Ambon", latitude: -3.6954, longitude: 128.1814 },
  "maluku-utara": { name: "Sofifi", latitude: 0.7372, longitude: 127.5583 },
  papua: { name: "Jayapura", latitude: -2.5337, longitude: 140.7181 },
  "papua-barat": { name: "Manokwari", latitude: -0.8615, longitude: 134.062 },
  "papua-selatan": { name: "Merauke", latitude: -8.4932, longitude: 140.4018 },
  "papua-tengah": { name: "Nabire", latitude: -3.3667, longitude: 135.4833 },
  "papua-pegunungan": { name: "Wamena", latitude: -4.0956, longitude: 138.9459 },
  "papua-barat-daya": { name: "Sorong", latitude: -0.8762, longitude: 131.2558 },
};
