import { useEffect } from 'react';

export function useEscapeToClose(dialogId, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1]?.getAttribute('aria-labelledby') !== dialogId) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogId, onClose, enabled]);
}
