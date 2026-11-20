import { Request } from "@/hooks/useRequests";
import { getRequestRouteStage, isRequestRouteStepDone, REQUEST_ROUTE_LABELS } from "@/lib/requestCard";
import { cn } from "@/lib/utils";

interface RequestRouteProps {
  request: Request;
  readOnly?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function RequestRoute({ request }: RequestRouteProps) {
  const current = getRequestRouteStage(request);
  return (
    <div className="request-route-block">
      <ol className="request-route" aria-label="Этап заявки">
        {REQUEST_ROUTE_LABELS.map((label, index) => {
          const done = isRequestRouteStepDone(request, index);
          return (
            <li
              key={label}
              className={cn("request-route__step", `request-route__step--${index}`, index === current && "is-current", done && "is-done", index > current && !done && "is-future")}
              aria-current={index === current ? "step" : undefined}
            >
              <span className="request-route__dot" aria-hidden="true" />
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
