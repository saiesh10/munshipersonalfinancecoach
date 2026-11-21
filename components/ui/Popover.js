'use client';

import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export default function Popover({
  trigger,
  children,
  align = 'left', // 'left' | 'right'
  className = '',
  isOpen: controlledIsOpen,
  onOpenChange
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const popoverRef = useRef(null);

  const toggleOpen = () => {
    const next = !isOpen;
    if (!isControlled) setInternalIsOpen(next);
    if (onOpenChange) onOpenChange(next);
  };

  const close = () => {
    if (!isControlled) setInternalIsOpen(false);
    if (onOpenChange) onOpenChange(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        close();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <div onClick={toggleOpen} className="inline-flex">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-1 min-w-[200px] bg-surface rounded-card border border-border shadow-lift p-2',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}
