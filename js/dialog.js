// ==========================================================
// Confirmation dialog
// One reusable "are you sure?" dialog, built on the <dialog> element
// in index.html. Used for the 18+ age check and for Reset.
// ==========================================================

const dialogElement = document.getElementById('confirm-dialog');
const messageElement = document.getElementById('confirm-dialog-message');
const confirmButton = document.getElementById('confirm-dialog-confirm');
const cancelButton = document.getElementById('confirm-dialog-cancel');

// The value the Confirm button gives the dialog when it closes.
const CONFIRM_VALUE = 'confirm';

// Show the dialog and resolve true for Confirm, or false for Cancel,
// the Escape key, or anything else that closes it.
export function askToConfirm({ message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
  messageElement.textContent = message;
  confirmButton.textContent = confirmLabel;
  cancelButton.textContent = cancelLabel;
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

// True while the dialog is on screen, so other keyboard shortcuts can pause.
export function isDialogOpen() {
  return dialogElement.open;
}
