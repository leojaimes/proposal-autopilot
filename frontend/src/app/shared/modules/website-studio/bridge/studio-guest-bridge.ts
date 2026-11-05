/**
 * Bi-directional Guest-Host Bridge for Universal Website Studio.
 * Allows parent editor to listen to element selections, hover states,
 * and dispatch live DOM updates without full iframe reloads.
 */

export type StudioBridgeMessageType =
  | "STUDIO_GUEST_READY"
  | "STUDIO_SLOT_CLICKED"
  | "STUDIO_SLOT_HOVERED"
  | "STUDIO_UPDATE_SLOT"
  | "STUDIO_SCROLL_SECTION"
  | "STUDIO_UPDATE_THEME";

export interface StudioBridgeMessage {
  type: StudioBridgeMessageType;
  payload?: any;
}

export const GUEST_BRIDGE_SCRIPT = `
(function() {
  if (window.__STUDIO_GUEST_INITIALIZED__) return;
  window.__STUDIO_GUEST_INITIALIZED__ = true;

  // Style overlay for slot hover/selection
  var style = document.createElement('style');
  style.id = '__studio-bridge-styles';
  style.textContent = \`
    [data-slot] {
      position: relative !important;
      transition: outline 0.15s ease, box-shadow 0.15s ease !important;
      cursor: pointer !important;
    }
    [data-slot]:hover {
      outline: 2px dashed #0284c7 !important;
      outline-offset: 3px !important;
    }
    [data-slot].__studio-selected {
      outline: 2px solid #2563eb !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25) !important;
    }
    [data-section] {
      transition: outline 0.2s ease !important;
    }
    [data-section].__studio-section-highlight {
      outline: 3px solid #f59e0b !important;
      outline-offset: 4px !important;
    }
  \`;
  document.head.appendChild(style);

  // Click handler for data-slot elements
  document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-slot]');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    // Remove previous selection
    document.querySelectorAll('.__studio-selected').forEach(function(el) {
      el.classList.remove('__studio-selected');
    });
    target.classList.add('__studio-selected');

    var sectionEl = target.closest('[data-section]');
    var sectionId = sectionEl ? sectionEl.getAttribute('data-section') : null;
    var slotId = target.getAttribute('data-slot');
    var rect = target.getBoundingClientRect();

    window.parent.postMessage({
      type: 'STUDIO_SLOT_CLICKED',
      payload: {
        slotId: slotId,
        sectionId: sectionId,
        tag: target.tagName.toLowerCase(),
        content: target.innerText || target.innerHTML,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        }
      }
    }, '*');
  }, true);

  // Parent Message Listener for Live Mutations
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'STUDIO_UPDATE_SLOT') {
      var slotId = data.payload.slotId;
      var newContent = data.payload.content;
      var el = document.querySelector('[data-slot="' + slotId + '"]');
      if (el) {
        if (el.tagName.toLowerCase() === 'img') {
          el.setAttribute('src', newContent);
        } else {
          el.innerHTML = newContent;
        }
      }
    } else if (data.type === 'STUDIO_SCROLL_SECTION') {
      var secId = data.payload.sectionId;
      var secEl = document.querySelector('[data-section="' + secId + '"]') || document.getElementById(secId);
      if (secEl) {
        secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        secEl.classList.add('__studio-section-highlight');
        setTimeout(function() {
          secEl.classList.remove('__studio-section-highlight');
        }, 1500);
      }
    } else if (data.type === 'STUDIO_UPDATE_THEME') {
      var primary = data.payload.primary;
      var secondary = data.payload.secondary;
      if (primary) {
        document.querySelectorAll('[style*="background-color:"]').forEach(function(el) {
          el.style.backgroundColor = primary;
        });
      }
    }
  });

  // Notify parent that guest bridge is ready
  window.parent.postMessage({ type: 'STUDIO_GUEST_READY' }, '*');
})();
`;

