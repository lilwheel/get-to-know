// ==========================================================
// Swipe handling
// Makes a card draggable with touch or mouse (via pointer events).
// While dragging, the card follows the pointer on each animation frame.
// On release it either reports a swipe (long drag or fast flick)
// or snaps back to the centre.
// ==========================================================

import { CONFIG } from './config.js';

// ----------------------------------------------------------
// Public: attach dragging to one card
// ----------------------------------------------------------

// Make cardElement draggable. canSwipe() says whether dragging is allowed
// right now; onSwipe('left' | 'right') is called when a swipe completes.
export function attachSwipe(cardElement, { canSwipe, onSwipe }) {
  const drag = {
    pointerId: null,
    startX: 0,
    currentX: 0,
    samples: [],
    frameId: null,
  };

  // Start a drag, unless the press was on the source link or dragging isn't allowed.
  function handlePointerDown(event) {
    const isMainButton = event.button === 0;
    if (!isMainButton || !canSwipe() || event.target.closest('a')) {
      return;
    }
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.currentX = event.clientX;
    drag.samples = [{ x: event.clientX, time: event.timeStamp }];
    cardElement.setPointerCapture(event.pointerId);
    cardElement.classList.add('is-dragging');
  }

  // Record the pointer position and ask for a frame to move the card.
  // If the stack moved some other way mid-drag (Next button, arrow key),
  // let go of the card so the drag can't pull it back or swipe twice.
  function handlePointerMove(event) {
    if (event.pointerId !== drag.pointerId) {
      return;
    }
    if (!canSwipe()) {
      endDrag(cardElement, drag);
      return;
    }
    drag.currentX = event.clientX;
    recordSample(drag, event.clientX, event.timeStamp);
    if (drag.frameId === null) {
      drag.frameId = requestAnimationFrame(moveCardOnFrame);
    }
  }

  // Runs on the next animation frame: move the card, unless the drag was
  // taken over by another move since the frame was requested.
  function moveCardOnFrame() {
    drag.frameId = null;
    if (canSwipe()) {
      applyDragPosition(cardElement, drag);
    }
  }

  // Finish the drag: swipe if it went far or fast enough, otherwise snap back.
  // The release point is recorded too, so a drag that paused before letting go
  // isn't mistaken for a flick.
  function handlePointerUp(event) {
    if (event.pointerId !== drag.pointerId) {
      return;
    }
    if (!canSwipe()) {
      endDrag(cardElement, drag);
      return;
    }
    drag.currentX = event.clientX;
    recordSample(drag, event.clientX, event.timeStamp);
    const swipeDirection = getSwipeDirection(drag);
    endDrag(cardElement, drag);
    if (swipeDirection === null) {
      snapBack(cardElement);
    } else {
      onSwipe(swipeDirection);
    }
  }

  // The browser took the pointer away (e.g. a system gesture): always snap back.
  function handlePointerCancel(event) {
    if (event.pointerId !== drag.pointerId) {
      return;
    }
    endDrag(cardElement, drag);
    snapBack(cardElement);
  }

  const passive = { passive: true };
  cardElement.addEventListener('pointerdown', handlePointerDown, passive);
  cardElement.addEventListener('pointermove', handlePointerMove, passive);
  cardElement.addEventListener('pointerup', handlePointerUp, passive);
  cardElement.addEventListener('pointercancel', handlePointerCancel, passive);
}

// ----------------------------------------------------------
// Drag helpers
// ----------------------------------------------------------

// Speed needs two points, so the window never trims below this many samples.
const MIN_SAMPLES_FOR_SPEED = 2;

// Keep only the recent pointer positions, used to measure release speed.
// If the pointer sat still, the one older sample kept makes the measured
// time long, so the speed comes out slow, as it should.
function recordSample(drag, x, time) {
  drag.samples.push({ x, time });
  const oldestAllowedTime = time - CONFIG.velocitySampleWindowMs;
  while (drag.samples.length > MIN_SAMPLES_FOR_SPEED && drag.samples[0].time < oldestAllowedTime) {
    drag.samples.shift();
  }
}

// Move and tilt the card to follow the pointer. Runs once per animation frame.
function applyDragPosition(cardElement, drag) {
  const offsetX = drag.currentX - drag.startX;
  const tiltDegrees = offsetX * CONFIG.dragRotationDegreesPerPixel;
  cardElement.style.transform = `translateX(${offsetX}px) rotate(${tiltDegrees}deg)`;
}

// Stop tracking the pointer and cancel any frame that hasn't run yet.
function endDrag(cardElement, drag) {
  if (drag.frameId !== null) {
    cancelAnimationFrame(drag.frameId);
    drag.frameId = null;
  }
  if (cardElement.hasPointerCapture(drag.pointerId)) {
    cardElement.releasePointerCapture(drag.pointerId);
  }
  drag.pointerId = null;
}

// Send the card back to the centre with the spring animation from the CSS.
function snapBack(cardElement) {
  cardElement.classList.remove('is-dragging');
  cardElement.style.transform = '';
}

// ----------------------------------------------------------
// Swipe decision
// ----------------------------------------------------------

// Return 'left' or 'right' if the drag counts as a swipe, or null if it doesn't.
function getSwipeDirection(drag) {
  const offsetX = drag.currentX - drag.startX;
  const velocity = getReleaseVelocity(drag.samples);
  const wentFarEnough = Math.abs(offsetX) > window.innerWidth * CONFIG.swipeDistanceRatio;
  // A flick only counts if it moves the same way the card was dragged.
  const wasFlicked = Math.abs(velocity) > CONFIG.flickVelocityPxPerMs
    && Math.sign(velocity) === Math.sign(offsetX);

  if (!wentFarEnough && !wasFlicked) {
    return null;
  }
  return offsetX < 0 ? 'left' : 'right';
}

// Speed of the pointer just before release, in pixels per millisecond.
function getReleaseVelocity(samples) {
  if (samples.length < 2) {
    return 0;
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsedMs = last.time - first.time;
  return elapsedMs > 0 ? (last.x - first.x) / elapsedMs : 0;
}
