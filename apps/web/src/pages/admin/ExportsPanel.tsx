import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, downloadReport } from "@/lib/api";

export function ExportsPanel({ token }: { token: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (key: string, path: string, filename: string) => {
    setBusy(key);
    try {
      await downloadReport(path, token, filename);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => download("colors", "/export/color-selection-csv", "taste-of-bloom-color-selection.csv")}
        >
          <Download className="h-4 w-4" /> {busy === "colors" ? "Preparing..." : "Color Selection CSV"}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => download("judging", "/export/judge-scores-csv", "taste-of-bloom-judge-scores.csv")}
        >
          <Download className="h-4 w-4" /> {busy === "judging" ? "Preparing..." : "Judge Scores CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}
