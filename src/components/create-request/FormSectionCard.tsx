import { ReactNode, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const REQUEST_SECTION_OPEN_EVENT = "request-form-open-section";

interface FormSectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  titleClassName?: string;
  /** Short summary shown under the title of a compact section. */
  summary?: ReactNode;
  /** Anchor id used by the form navigation. */
  sectionId?: string;
  /** Render children without a card (used inside the combined top section). */
  bare?: boolean;
}

export const FormSectionCard = ({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
  titleClassName,
  summary,
  sectionId,
  bare = false,
}: FormSectionCardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsible && defaultCollapsed);
  const contentId = useId();

  useEffect(() => {
    if (!sectionId) return;
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === sectionId) setIsCollapsed(false);
    };
    window.addEventListener(REQUEST_SECTION_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(REQUEST_SECTION_OPEN_EVENT, onOpen);
  }, [sectionId]);

  if (bare) return <div className="req-flat">{children}</div>;

  const header = (
    <>
      <span className="request-section__heading">
        <span className={cn("request-section__title", titleClassName)}>{title}</span>
        {summary && <span className="request-section__summary">{summary}</span>}
      </span>
      {collapsible && (
        <ChevronDown
          className={cn("request-section__chevron h-5 w-5 shrink-0", !isCollapsed && "rotate-180")}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <section
      id={sectionId}
      data-request-section={sectionId}
      className={cn("request-form-section request-section", className)}
    >
      {collapsible ? (
        <button
          type="button"
          className="request-section__header"
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          onClick={() => setIsCollapsed((v) => !v)}
        >
          {header}
        </button>
      ) : (
        <div className="request-section__header">{header}</div>
      )}
      <div id={contentId} className="request-section__body" hidden={isCollapsed}>
        {children}
      </div>
    </section>
  );
};
