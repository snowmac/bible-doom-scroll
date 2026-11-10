import { useEffect, useRef } from 'react';

// Bottom sheet on phones, centered card on larger screens. Built on <dialog> for focus trap + Esc.
export default function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="sheet-body">
        <div className="grab" aria-hidden="true" />
        <h2>{title}</h2>
        {open && children}
      </div>
    </dialog>
  );
}
