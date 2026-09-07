import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = ["Новые", "В работе", "На проверке", "Выполнено"];

/** Column skeletons so the board renders instantly while data loads. */
export function PlannerBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {COLUMNS.map((title) => (
        <Card key={title} className="p-3 space-y-3 min-h-[40dvh]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{title}</span>
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default PlannerBoardSkeleton;
