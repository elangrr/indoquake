export interface VelocityModel {
  id: string;
  name: string;
  pVelocityKmS: number;
  sVelocityKmS: number;
  uncertaintyRatio: number;
}

export const DEFAULT_VELOCITY_MODEL: VelocityModel = {
  id: "constant-crustal",
  name: "Model kecepatan kerak konstan (dapat dikonfigurasi)",
  pVelocityKmS: 6.1,
  sVelocityKmS: 3.5,
  uncertaintyRatio: 0.25,
};
