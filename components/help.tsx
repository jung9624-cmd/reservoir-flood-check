"use client";

// 용어 도움말 (?) 단추. 누르거나 Enter·Space로 열고 Esc·바깥 누르기로 닫는다. 내용은 lib/glossary.ts
import { useEffect, useId, useRef, useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

export function Help({ k }: { k: GlossaryKey }) {
  const t = GLOSSARY[k];
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <span ref={box} className="no-print relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`${t.term} 도움말`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="inline-flex size-[18px] items-center justify-center rounded-full border border-[#8c959f] text-[11px] leading-none font-semibold text-sub hover:border-ink hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className="absolute top-6 left-0 z-50 w-72 rounded-md border border-ink bg-white p-3 text-left text-[13px] leading-5 font-normal text-ink shadow-md">
          <b className="font-semibold">{t.term}</b>
          <span className="mt-1 block">{t.definition}</span>
          <span className="mt-1.5 block text-xs text-sub">근거: {t.basis}</span>
        </span>
      )}
    </span>
  );
}
