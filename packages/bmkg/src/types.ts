export type BmkgFeedName = "autogempa" | "gempaterkini" | "gempadirasakan";

export interface BmkgGempaRaw {
  Tanggal: string;
  Jam: string;
  DateTime: string;
  Coordinates: string;
  Lintang: string;
  Bujur: string;
  Magnitude: string;
  Kedalaman: string;
  Wilayah: string;
  Potensi?: string;
  Dirasakan?: string;
  Shakemap?: string;
}

export interface FeltReport {
  mmi: string;
  place: string;
}

export interface NormalizedEarthquake {
  eventKey: string;
  feed: BmkgFeedName;
  eventTimeUtc: string;
  eventTimeWib: string;
  latitude: number;
  longitude: number;
  depthKm: number;
  magnitude: number;
  regionName: string;
  potentialText: string | null;
  tsunamiPotential: boolean | null;
  feltText: string | null;
  feltReports: FeltReport[];
  shakemapUrl: string | null;
  source: "BMKG";
}
