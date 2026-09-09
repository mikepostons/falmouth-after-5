import test from "node:test";
import assert from "node:assert/strict";
function luminance(hex) {
  const rgb = hex
    .match(/[a-f0-9]{2}/gi)
    .map((n) => parseInt(n, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test("category colours meet normal-text contrast on white and selected buttons", () => {
  for (const c of [
    "#cf167c",
    "#1269b0",
    "#28783b",
    "#9250b1",
    "#ae6200",
    "#00828f",
    "#414d62",
  ])
    assert.ok(1.05 / (luminance(c) + 0.05) >= 4.5, c);
});
