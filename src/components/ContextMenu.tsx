import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Renders a nested list under the item, expanded on click. */
  children?: MenuItem[];
  separator?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: MenuItem[];
  onClose(): void;
}

export function ContextMenu({ x, y, title, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Keep the menu on screen.
  useEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)),
    });
  }, [x, y, open]);

  const choose = (item: MenuItem) => {
    if (item.disabled) return;
    onClose();
    item.onSelect?.();
  };

  return (
    <div ref={ref} className="bb-menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {title && <div className="bb-menu-title">{title}</div>}
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="bb-menu-sep" />
        ) : (
          <div key={i}>
            <button
              role="menuitem"
              className="bb-menu-item"
              disabled={item.disabled}
              onClick={() => (item.children ? setOpen(open === i ? null : i) : choose(item))}
            >
              {item.label}
              {item.children && <span className="bb-spacer">{open === i ? '▾' : '▸'}</span>}
            </button>
            {item.children && open === i && (
              <div className="bb-menu-sub">
                {item.children.map((c, j) => (
                  <button key={j} role="menuitem" className="bb-menu-item" disabled={c.disabled} onClick={() => choose(c)}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}
