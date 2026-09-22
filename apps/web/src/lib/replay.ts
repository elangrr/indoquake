export interface ReplayState {
  eventKey: string;
  latitude: number;
  longitude: number;
  startedAtMs: number;
  speed: number;
}

export const REPLAY_SPEED = 20;
