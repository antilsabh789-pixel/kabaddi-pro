'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const emptySubscribe = () => () => {};

/**
 * Renders children into a portal attached to document.body.
 * This ensures that `position: fixed` overlays work correctly
 * even when rendered inside scroll containers or transformed parents.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) return null;

  return createPortal(children, document.body);
}
