const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Ported from the original Python bot's Pillow-based generate_image(): same base
// image, same font, same size/color/position, just rendered with @napi-rs/canvas
// instead (prebuilt binaries, no native build step needed on the host).
const BASE_IMAGE_PATH = path.join(__dirname, 'assets', 'base.png');
const FONT_PATH = path.join(__dirname, 'assets', 'HelveticaNeueBold.ttf');
const FONT_FAMILY = 'IncidentCounterFont';
const FONT_SIZE = 400;
const TEXT_COLOR = '#181a19';
const TOP_OFFSET = 50; // was 10 — nudged down 40px total, sat too high on the sign

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
  fontRegistered = true;
}

// Renders the "days since last incident" sign with `number` stamped in the blank
// area at the top, centered horizontally. Returns a PNG Buffer ready to attach
// to a Discord message.
async function generateImage(number) {
  ensureFontRegistered();

  const baseImage = await loadImage(BASE_IMAGE_PATH);
  const canvas = createCanvas(baseImage.width, baseImage.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(baseImage, 0, 0);

  const text = String(number);
  ctx.font = `${FONT_SIZE}px "${FONT_FAMILY}"`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textBaseline = 'top';

  const textWidth = ctx.measureText(text).width;
  const x = (canvas.width - textWidth) / 2;
  ctx.fillText(text, x, TOP_OFFSET);

  return canvas.toBuffer('image/png');
}

module.exports = { generateImage };
