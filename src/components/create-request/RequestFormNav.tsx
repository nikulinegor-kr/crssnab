import { useState } from "react";
import { REQUEST_SECTION_OPEN_EVENT } from "./FormSectionCard";

const ITEMS = [
  { id: "req-sec-main", label: "Заявка" },
  { id: "req-sec-invoice", label: "Счета" },
  { id: "req-sec-items", label: "Позиции" },
  { id: "req-sec-logistics", label: "Логистика" },
  { id: "req-sec-files", label: "Файлы", editOnly: true },
  { id: "req-sec-zrs", label: "ЗРС" },
];

/** Section navigation for the request forms: opens the block and scrolls to it. */
export const RequestFormNav = ({ includeFiles = false }: { includeFiles?: boolean }) => {
  const [active, setActive] = useState("req-sec-main");
  const sections = ITEMS.filter((item) => includeFiles || !item.editOnly);

  return (
    <nav className="request-form-nav" aria-label="Разделы заявки">
      {sections.map((item) => (
        <button
          key={item.id}
          type="button"
          className="request-form-nav__item"
          aria-controls={item.id}
          aria-current={includeFiles && active === item.id ? "location" : undefined}
          onClick={(e) => {
            window.dispatchEvent(new CustomEvent(REQUEST_SECTION_OPEN_EVENT, { detail: item.id }));
            const win = e.currentTarget.closest(".request-form-redesign") ?? document;
            if (includeFiles) setActive(item.id);
            window.requestAnimationFrame(() => {
              const body = win.querySelector<HTMLElement>(".request-form-body");
              const target = win.querySelector<HTMLElement>(`[data-request-section="${item.id}"]`);
              if (!body || !target) return;
              const inset = parseFloat(getComputedStyle(body).scrollPaddingTop) || 12;
              const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - inset;
              const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              body.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
            });
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};
