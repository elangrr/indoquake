import { ImageResponse } from "next/og";

export const alt = "Indoquake, gempa terkini Indonesia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Field-station palette from globals.css (light): paper, ink, one signal rule. No gradient, no emoji.
const PAPER = "#eef0ee";
const INK = "#16191b";
const SIGNAL = "#b8380a";
const RULE = "#c3c9c4";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 80,
          background: PAPER,
          color: INK,
          borderBottom: "16px solid " + SIGNAL,
        }}
      >
        <div style={{ display: "flex", width: 120, height: 6, background: SIGNAL, marginBottom: 40 }} />
        <div style={{ display: "flex", fontSize: 128, fontWeight: 700, letterSpacing: -4 }}>Indoquake</div>
        <div style={{ display: "flex", fontSize: 56, marginTop: 16, paddingTop: 24, borderTop: "2px solid " + RULE }}>
          Gempa terkini Indonesia
        </div>
      </div>
    ),
    size,
  );
}
