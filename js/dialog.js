// ==========================================================
// Confirmation dialog
// One reusable "are you sure?" dialog, built on the <dialog> element
// in index.html. Used for the 18+ age check, the Party mode rules and Reset.
// ==========================================================

const dialogElement = document.getElementById('confirm-dialog');
const headingElement = document.getElementById('confirm-dialog-heading');
const messageElement = document.getElementById('confirm-dialog-message');
const confirmButton = document.getElementById('confirm-dialog-confirm');
const cancelButton = document.getElementById('confirm-dialog-cancel');

// The value the Confirm button gives the dialog when it closes.
const CONFIRM_VALUE = 'confirm';

// Show the dialog and resolve true for Confirm, or false for Cancel,
// the Escape key, or anything else that closes it.
// - heading (optional): a title above the message; the message is then
//   shown as normal-size body text, one line per "\n" (used for rules).
// - message: the question or the rules. Without a heading it is the title.
// - confirmLabel: the Confirm button's text. Cancel always says "Cancel".
export function askToConfirm({ heading = '', message, confirmLabel = 'Confirm' }) {
  showText(heading, message);
  confirmButton.textContent = confirmLabel;
  dialogElement.returnValue = '';
  dialogElement.showModal();
  // Start on Cancel, so pressing Enter straight away never confirms by accident.
  cancelButton.focus();

  return new Promise((resolve) => {
    dialogElement.addEventListener('close', () => {
      resolve(dialogElement.returnValue === CONFIRM_VALUE);
    }, { once: true });
  });
}

// Fill in the heading and message, and point screen readers at whichever
// one is the dialog's title.
function showText(heading, message) {
  const hasHeading = heading !== '';
  headingElement.textContent = heading;
  headingElement.hidden = !hasHeading;
  messageElement.textContent = message;
  dialogElement.classList.toggle('confirm-dialog--with-heading', hasHeading);
  dialogElement.setAttribute('aria-labelledby', hasHeading ? headingElement.id : messageElement.id);
}

// True while any dialog (this one or the saving fallback) is on screen, so
// other keyboard shortcuts can pause.
export function isDialogOpen() {
  return document.querySelector('dialog[open]') !== null;
}
