const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapes untrusted strings before interpolation into innerHTML or attributes.
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Copies plain text using Clipboard API with a safe textarea fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when clipboard permission is restricted on insecure context.
    }
  }

  if (typeof document === 'undefined') return false;
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  document.body.appendChild(temp);
  temp.select();
  temp.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(temp);
  return ok;
}

let activeToastTimer = null;

/**
 * Displays a dismissible floating toast with an optional action button (e.g. Undo).
 */
export function showToast(message, { actionLabel = '', onAction = null, durationMs = 5000 } = {}) {
  const container = document.getElementById('appToast');
  if (!container) return;

  if (activeToastTimer) {
    clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }

  const msgEl = container.querySelector('[data-toast-message]');
  const btnEl = container.querySelector('[data-toast-action]');
  if (msgEl) msgEl.textContent = message;

  if (btnEl) {
    if (actionLabel && typeof onAction === 'function') {
      btnEl.textContent = actionLabel;
      btnEl.classList.remove('hidden');
      btnEl.onclick = () => {
        hideToast();
        onAction();
      };
    } else {
      btnEl.classList.add('hidden');
      btnEl.onclick = null;
    }
  }

  container.classList.remove('hidden');
  activeToastTimer = setTimeout(hideToast, durationMs);
}

export function hideToast() {
  const container = document.getElementById('appToast');
  if (container) container.classList.add('hidden');
  if (activeToastTimer) {
    clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }
}
