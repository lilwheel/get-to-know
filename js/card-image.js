// ==========================================================
// Card image
// Draws a card as a 1080 × 1350 picture with the browser's own Canvas API
// (no library). Colours, fonts, outlines and the sticker and flower shapes
// are read from css/styles.css and index.html, so the picture matches the
// card on screen in the current theme. Everything happens on the device.
// ==========================================================

import { CONFIG } from './config.js';

// ----------------------------------------------------------
// Theme tokens
// ----------------------------------------------------------

// Read a CSS variable from the page (the current theme's value).
function token(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// A CSS length token (e.g. "3px") in image pixels.
function tokenPx(name) {
  return parseFloat(token(name)) * CONFIG.cardImage.scale;
}

// The fonts the picture uses, as Canvas font strings.
function fontString(kind, sizePx) {
  if (kind === 'display') {
    return `${sizePx}px ${token('--font-family-display')}`;
  }
  const weight = kind === 'bold' ? token('--font-weight-bold') : token('--font-weight-body');
  return `${weight} ${sizePx}px ${token('--font-family-body')}`;
}

// The three font faces the picture needs.
function requiredFonts() {
  return [fontString('display', 20), fontString('bold', 20), fontString('body', 20)];
}

// True if every font the picture needs has already loaded (they normally
// have, because the card on screen uses them). Then the picture can be made
// straight away, which iPhone needs to open its share sheet.
export function cardImageFontsReady() {
  return requiredFonts().every((font) => document.fonts.check(font));
}

// Wait for the fonts, so the picture never falls back to a plain font.
export function loadCardImageFonts() {
  return Promise.all(requiredFonts().map((font) => document.fonts.load(font)));
}

// ----------------------------------------------------------
// Drawing the whole picture
// ----------------------------------------------------------

// Draw a card and return the canvas. `card` is what js/app.js builds for
// the card on screen (text in the current wording, fact, badges), plus the
// card's `level` and `levelName`.
export function drawCardImage(card) {
  const { width, height, scale } = CONFIG.cardImage;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.textBaseline = 'alphabetic';

  // The page colour all round, like the app's background
  context.fillStyle = token('--color-page');
  context.fillRect(0, 0, width, height);

  // The card panel, with room underneath for the level flowers and the credit
  const margin = 72;
  const footerHeight = 180;
  const panel = { x: margin, y: margin, width: width - margin * 2, height: height - margin - footerHeight };
  drawPanel(context, panel, card.isAdult);

  const padding = 40 * scale;
  const content = {
    x: panel.x + padding,
    y: panel.y + padding,
    width: panel.width - padding * 2,
    bottom: panel.y + panel.height - padding,
  };
  if (card.isParty) {
    drawPartyBadge(context, panel);
  }
  if (card.isAdult) {
    drawAdultBadge(context, panel);
  }
  const footnoteTop = drawFootnote(context, card, content);
  // A Party question starts below the corner sticker, as on screen
  const stickerBottom = panel.y + tokenPx('--space-medium') + tokenPx('--starburst-size');
  const bodyTop = card.isParty && card.type !== 'dare' ? Math.max(content.y, stickerBottom) : content.y;
  drawBody(context, card, { x: content.x, width: content.width, top: bodyTop, bottom: footnoteTop - tokenPx('--space-medium') });

  drawLevel(context, card, panel.y + panel.height + 70);
  drawCredit(context, height - 44);
  return canvas;
}

// Turn the canvas into a PNG file without waiting (toDataURL is immediate),
// so on iPhone the share sheet can still open straight after the tap.
export function canvasToPngBlob(canvas) {
  const base64 = canvas.toDataURL('image/png').split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: 'image/png' });
}

// ----------------------------------------------------------
// Panel, stickers and badges
// ----------------------------------------------------------

// The card: hard offset shadow, paper fill, ink outline, and on 18+ cards
// the accent ring just inside the outline.
function drawPanel(context, panel, isAdult) {
  const radius = tokenPx('--radius-panel');
  const outline = tokenPx('--outline-width');
  const shadowOffset = parseFloat(token('--shadow-hard')) * CONFIG.cardImage.scale;

  roundedRectPath(context, panel.x + shadowOffset, panel.y + shadowOffset, panel.width, panel.height, radius);
  context.fillStyle = token('--color-shadow');
  context.fill();

  roundedRectPath(context, panel.x, panel.y, panel.width, panel.height, radius);
  context.fillStyle = token('--color-card-background');
  context.fill();
  context.lineWidth = outline;
  context.strokeStyle = token('--color-outline');
  context.stroke();

  if (isAdult) {
    const ring = tokenPx('--accent-ring-width');
    const inset = outline / 2 + ring / 2;
    roundedRectPath(context, panel.x + inset, panel.y + inset, panel.width - inset * 2, panel.height - inset * 2,
      Math.max(0, radius - inset));
    context.lineWidth = ring;
    context.strokeStyle = token('--color-accent');
    context.stroke();
  }
}

// The Party starburst in the card's top corner.
function drawPartyBadge(context, panel) {
  const size = tokenPx('--starburst-size');
  const offset = tokenPx('--space-medium');
  drawStarburst(context, panel.x + panel.width - offset - size, panel.y + offset, size, CONFIG.cardLabels.party);
}

// The 18+ sticker in the card's top corner: accent fill, thin ink outline,
// small hard shadow.
function drawAdultBadge(context, panel) {
  const text = CONFIG.cardLabels.adult.toUpperCase();
  context.font = fontString('display', remPx('--font-size-footnote'));
  const paddingX = tokenPx('--space-small');
  const paddingY = tokenPx('--space-xsmall');
  const textWidth = context.measureText(text).width;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeHeight = remPx('--font-size-footnote') * 1.5 + paddingY * 2;
  const offset = tokenPx('--space-medium');
  const x = panel.x + panel.width - offset - badgeWidth;
  const y = panel.y + offset;
  const radius = tokenPx('--radius-medium');
  const shadow = parseFloat(token('--shadow-hard-small')) * CONFIG.cardImage.scale;

  roundedRectPath(context, x + shadow, y + shadow, badgeWidth, badgeHeight, radius);
  context.fillStyle = token('--color-shadow');
  context.fill();
  roundedRectPath(context, x, y, badgeWidth, badgeHeight, radius);
  context.fillStyle = token('--color-accent');
  context.fill();
  context.lineWidth = tokenPx('--outline-width-thin');
  context.strokeStyle = token('--color-outline');
  context.stroke();
  drawCentredText(context, text, x + badgeWidth / 2, y + badgeHeight / 2, token('--color-text'));
}

// A starburst sticker (Party badge, DARE label): an ink star with a slightly
// smaller accent star inside, so the ink shows as an outline, and the label.
function drawStarburst(context, x, y, size, label) {
  const outline = tokenPx('--outline-width');
  starburstPath(context, x, y, size);
  context.fillStyle = token('--color-outline');
  context.fill();
  starburstPath(context, x + outline, y + outline, size - outline * 2);
  context.fillStyle = token('--color-accent');
  context.fill();
  context.font = fontString('display', remPx('--font-size-sticker'));
  drawCentredText(context, label.toUpperCase(), x + size / 2, y + size / 2, token('--color-text'));
}

// The starburst outline, read from the --starburst-shape polygon in the CSS.
function starburstPath(context, x, y, size) {
  const points = token('--starburst-shape').replace(/^polygon\(|\)$/g, '').split(',')
    .map((pair) => pair.trim().split(/\s+/).map((value) => parseFloat(value) / 100));
  context.beginPath();
  points.forEach(([pointX, pointY], index) => {
    const method = index === 0 ? 'moveTo' : 'lineTo';
    context[method](x + pointX * size, y + pointY * size);
  });
  context.closePath();
}

// ----------------------------------------------------------
// Card text and footnote
// ----------------------------------------------------------

// The middle of the card: on dares the DARE sticker, the text and the
// "Whole table" line; on questions just the text. The text starts large and
// shrinks until the whole block fits between the top and the footnote.
function drawBody(context, card, area) {
  const { questionFontMaxPx, questionFontMinPx, questionFontStepPx } = CONFIG.cardImage;
  const isDare = card.type === 'dare';
  const gap = tokenPx('--space-medium');
  const stickerSize = isDare ? tokenPx('--starburst-size-small') : 0;
  const whoSize = remPx('--font-size-footnote');
  const lineHeightRatio = parseFloat(token('--line-height-heading'));
  const extraHeight = isDare ? stickerSize + gap + gap + whoSize * lineHeightRatio : 0;
  const available = area.bottom - area.top;

  let fontSize = questionFontMaxPx;
  let lines = [];
  while (fontSize >= questionFontMinPx) {
    context.font = fontString('bold', fontSize);
    lines = balancedLines(context, card.text, area.width);
    if (lines.length * fontSize * lineHeightRatio + extraHeight <= available) {
      break;
    }
    fontSize -= questionFontStepPx;
  }
  fontSize = Math.max(fontSize, questionFontMinPx);
  context.font = fontString('bold', fontSize);
  const lineHeight = fontSize * lineHeightRatio;
  const blockHeight = lines.length * lineHeight + extraHeight;
  let y = area.top + Math.max(0, (available - blockHeight) / 2);
  const centreX = area.x + area.width / 2;

  if (isDare) {
    drawStarburst(context, centreX - stickerSize / 2, y, stickerSize, CONFIG.cardLabels.dare);
    y += stickerSize + gap;
  }
  context.font = fontString('bold', fontSize);
  context.fillStyle = token('--color-text');
  context.textAlign = 'center';
  lines.forEach((line, index) => {
    context.fillText(line, centreX, y + lineHeight * index + fontSize * 0.95);
  });
  y += lines.length * lineHeight;
  if (isDare) {
    context.font = fontString('bold', whoSize);
    context.fillStyle = token('--color-text-muted');
    context.fillText(CONFIG.cardLabels.dareWho, centreX, y + gap + whoSize);
  }
  context.textAlign = 'left';
}

// The narration box at the bottom of the card: "Did you know?" and the fact,
// then the study's name as plain text (no links in a picture). Returns its top.
function drawFootnote(context, card, content) {
  if (!card.factText) {
    return content.bottom;
  }
  const fontSize = remPx('--font-size-footnote');
  const lineHeight = fontSize * parseFloat(token('--line-height-body'));
  const paddingX = tokenPx('--space-medium');
  const paddingY = tokenPx('--space-small');
  const textWidth = content.width - paddingX * 2;
  const { factIntro, study } = CONFIG.cardLabels;

  const factLines = wrapRichText(context, [
    { text: factIntro, font: fontString('bold', fontSize) },
    { text: card.factText, font: fontString('body', fontSize) },
  ], textWidth);
  const studyText = card.factCitation ? `${study}: ${card.factCitation}` : '';
  const boxHeight = paddingY * 2 + lineHeight * (factLines.length + (studyText ? 1 : 0));
  const top = content.bottom - boxHeight;

  roundedRectPath(context, content.x, top, content.width, boxHeight, tokenPx('--radius-medium'));
  context.fillStyle = token('--color-caption-background');
  context.fill();
  context.lineWidth = tokenPx('--outline-width-thin');
  context.strokeStyle = token('--color-outline');
  context.stroke();

  const centreX = content.x + content.width / 2;
  let baseline = top + paddingY + fontSize * 1.1;
  context.fillStyle = token('--color-text-muted');
  factLines.forEach((line) => {
    drawRichLine(context, line, centreX, baseline);
    baseline += lineHeight;
  });
  if (studyText) {
    context.font = fontString('bold', fontSize);
    context.textAlign = 'center';
    context.fillText(studyText, centreX, baseline);
    context.textAlign = 'left';
  }
  return top;
}

// ----------------------------------------------------------
// Under the card: level flowers and the credit
// ----------------------------------------------------------

// The three level flowers (filled up to the card's level) and the level name.
function drawLevel(context, card, centreY) {
  const flowerSize = 44;
  const flowerGap = 10;
  const nameGap = 18;
  const fontSize = 30;
  context.font = fontString('bold', fontSize);
  const nameWidth = context.measureText(card.levelName).width;
  const flowersWidth = flowerSize * CONFIG.deepestLevel + flowerGap * (CONFIG.deepestLevel - 1);
  let x = (CONFIG.cardImage.width - flowersWidth - nameGap - nameWidth) / 2;
  const flowerPath = new Path2D(document.querySelector('#flower path').getAttribute('d'));
  const flowerScale = flowerSize / 24;
  const outline = token('--color-outline');

  for (let level = CONFIG.lowestLevel; level <= CONFIG.deepestLevel; level += 1) {
    context.save();
    context.translate(x, centreY - flowerSize / 2);
    context.scale(flowerScale, flowerScale);
    context.fillStyle = level <= card.level ? token('--color-level-dot-filled') : token('--color-card-background');
    context.fill(flowerPath);
    context.lineWidth = parseFloat(token('--flower-stroke-width'));
    context.lineJoin = 'round';
    context.strokeStyle = outline;
    context.stroke(flowerPath);
    context.beginPath();
    context.arc(12, 12, 2.2, 0, Math.PI * 2);
    context.fillStyle = outline;
    context.fill();
    context.restore();
    x += flowerSize + flowerGap;
  }
  context.fillStyle = token('--color-text');
  context.fillText(card.levelName, x - flowerGap + nameGap, centreY + fontSize * 0.35);
}

// "Getting to Know", small and centred at the bottom, in ink.
function drawCredit(context, baseline) {
  context.font = fontString('display', 30);
  context.fillStyle = token('--color-text');
  context.textAlign = 'center';
  context.fillText(CONFIG.cardImage.credit, CONFIG.cardImage.width / 2, baseline);
  context.textAlign = 'left';
}

// ----------------------------------------------------------
// Text helpers
// ----------------------------------------------------------

// A rem-sized CSS font token (e.g. "0.8125rem") in image pixels.
function remPx(name) {
  return parseFloat(token(name)) * 16 * CONFIG.cardImage.scale;
}

// Draw text centred on a point (both ways).
function drawCentredText(context, text, centreX, centreY, colour) {
  context.fillStyle = colour;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, centreX, centreY);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
}

// Split text into lines no wider than maxWidth, word by word.
function wrapLines(context, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

// Like the card's `text-wrap: balance`: the fewest lines, with the lines as
// even in length as possible (the narrowest width that keeps that count).
function balancedLines(context, text, maxWidth) {
  const lineCount = wrapLines(context, text, maxWidth).length;
  let narrow = maxWidth / 2;
  let wide = maxWidth;
  while (wide - narrow > 4) {
    const middle = (narrow + wide) / 2;
    if (wrapLines(context, text, middle).length > lineCount) {
      narrow = middle;
    } else {
      wide = middle;
    }
  }
  return wrapLines(context, text, wide);
}

// Wrap text made of differently styled parts (the bold "Did you know?" then
// the fact). Each line is a list of { text, font, width } words.
function wrapRichText(context, parts, maxWidth) {
  const words = parts.flatMap((part) => part.text.split(/\s+/).map((text) => ({ text, font: part.font })));
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const word of words) {
    context.font = word.font;
    const wordWidth = context.measureText(word.text).width;
    const spaceWidth = line.length > 0 ? context.measureText(' ').width : 0;
    if (line.length > 0 && lineWidth + spaceWidth + wordWidth > maxWidth) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    const leadingSpace = line.length > 0 ? context.measureText(' ').width : 0;
    line.push({ ...word, width: wordWidth, leadingSpace });
    lineWidth += leadingSpace + wordWidth;
  }
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}

// Draw one wrapped line of styled words, centred.
function drawRichLine(context, line, centreX, baseline) {
  const totalWidth = line.reduce((sum, word) => sum + word.leadingSpace + word.width, 0);
  let x = centreX - totalWidth / 2;
  for (const word of line) {
    x += word.leadingSpace;
    context.font = word.font;
    context.fillText(word.text, x, baseline);
    x += word.width;
  }
}

// A rectangle with rounded corners (drawn by hand, so older browsers work too).
function roundedRectPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
