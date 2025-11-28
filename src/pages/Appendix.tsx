import { FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";

const Appendix = () => {
  const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1nh4uDGOEhbmxXdtFJZ4WOTLWgrepKqPtCqa9G6ATNho/edit?rm=minimal&gid=1654334907";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Приложение</h1>
          <p className="text-muted-foreground">Редактируемая таблица</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <iframe
          src={spreadsheetUrl}
          className="w-full border-0"
          style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
          title="Google Sheets"
          allowFullScreen
        />
      </Card>
    </div>
  );
};

export default Appendix;
