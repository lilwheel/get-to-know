// ==========================================================
// Saving the card picture
// Puts the picture on the device with the fewest taps, and never sends it
// anywhere:
//   - iPhone and iPad: the share sheet, whose "Save Image" puts it in Photos
//     (a normal download there would go to the Files app instead).
//   - Everywhere else: a normal download (Android shows it in the gallery's
//     Download album; desktops save a PNG to Downloads).
//   - If neither works: the picture full-screen, with "Press and hold the
//     image to save it". Add ?save=preview to the address to try this.
// ==========================================================

import { CONFIG } from './config.js';
import { debugLog } from './debug.js';

const previewDialog = document.getElementById('save-preview');
const previewImage = document.getElementById('save-preview-image');
const previewMessage = document.getElementById('save-preview-message');
const forcePreview = new URLSearchParams(window.location.search).get('save') === 'preview';

// Downloads are cleaned up after this long (enough for every browser to start saving).
const DOWNLOAD_CLEANUP_MS = 10000;

// Save the picture. Resolves to how it went: 'downloaded', 'shared',
// 'cancelled' (the share sheet was closed) or 'preview' (the fallback).
export async function saveImage(blob, fileName) {
  if (forcePreview) {
    showPreview(blob);
    return 'preview';
  }
  const file = new File([blob], fileName, { type: blob.type });
  if (isAppleTouchDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      debugLog('Share sheet closed or refused', { error: error.name });
      if (error.name === 'AbortError') {
        return 'cancelled';
      }
      showPreview(blob);
      return 'preview';
    }
  }
  if ('download' in HTMLAnchorElement.prototype) {
    downloadFile(blob, fileName);
    return 'downloaded';
  }
  showPreview(blob);
  return 'preview';
}

// iPhone, iPod or iPad. iPads say they are Macs, so a Mac with a touch
// screen counts too (Macs have none). If this guesses wrong, the person just
// gets a normal download, which still works.
function isAppleTouchDevice() {
  const userAgent = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
}

// Start a normal download of the file.
function downloadFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_CLEANUP_MS);
}

// The fallback: show the picture full-screen so it can be saved by hand.
function showPreview(blob) {
  const url = URL.createObjectURL(blob);
  previewImage.src = url;
  previewImage.alt = CONFIG.saveLabels.pressAndHold;
  previewMessage.textContent = CONFIG.saveLabels.pressAndHold;
  previewDialog.addEventListener('close', () => URL.revokeObjectURL(url), { once: true });
  previewDialog.showModal();
}
