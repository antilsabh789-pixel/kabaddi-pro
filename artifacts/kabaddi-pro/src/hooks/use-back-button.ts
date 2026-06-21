import { useEffect, useRef, useCallback } from 'react';

/**
 * useBackButton — prevents the Android back button from exiting the app when
 * an overlay/modal/screen is open.
 *
 * HOW IT WORKS:
 *   1. When `isOpen` becomes true, we push a new history entry.
 *   2. If the user presses the Android back button, the browser fires a
 *      `popstate` event. We intercept it and call `onClose` instead of
 *      letting the WebView navigate back (which would exit the app).
 *   3. If the user closes the overlay via the X button (not back button),
 *      we manually go back to remove the extra history entry we pushed.
 *
 * USAGE:
 *   const [showModal, setShowModal] = useState(false);
 *   useBackButton(showModal, () => setShowModal(false));
 *
 *   // That's it! The hook handles all the history management automatically.
 *
 * MULTIPLE OVERLAYS:
 *   Each overlay that uses this hook gets its own history entry. If multiple
 *   overlays are open (e.g., a modal on top of a modal), pressing back closes
 *   them one at a time (LIFO order), which is the expected behavior.
 */

export function useBackButton(isOpen: boolean, onClose: () => void): void {
  // Track whether WE pushed a history entry (so we know whether to pop it)
  const pushedRef = useRef(false);
  // Track whether the close was triggered by us (to avoid double-popping)
  const closingRef = useRef(false);
  // Keep the latest onClose in a ref so the popstate handler always calls
  // the current version
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Handle open: push a history entry when the overlay opens
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      // Push a new history state. The URL stays the same; we just add an entry
      // so the back button has somewhere to "go back" to.
      window.history.pushState({ overlay: true, timestamp: Date.now() }, '');
      pushedRef.current = true;
    }
  }, [isOpen]);

  // Handle close: if we pushed an entry and the overlay is now closed
  // (closed via X button, not back button), go back to remove our entry
  useEffect(() => {
    if (!isOpen && pushedRef.current && !closingRef.current) {
      // The overlay was closed via the X button (not the back button).
      // We need to pop the history entry we pushed.
      closingRef.current = true;
      window.history.back();
    }
    // Reset closing flag after the back navigation completes
    if (!isOpen && closingRef.current) {
      // Use a microtask to ensure the back() has been processed
      Promise.resolve().then(() => {
        closingRef.current = false;
        pushedRef.current = false;
      });
    }
  }, [isOpen]);

  // Listen for popstate (back button pressed)
  const handlePopState = useCallback(() => {
    if (pushedRef.current && !closingRef.current) {
      // The back button was pressed while our overlay was open.
      // Call onClose instead of letting the WebView exit.
      pushedRef.current = false;
      onCloseRef.current();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handlePopState]);
}
