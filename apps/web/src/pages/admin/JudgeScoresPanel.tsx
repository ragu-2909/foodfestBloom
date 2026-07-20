import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api, JudgeScoreEntryRow, JudgeScoreSummaryRow } from "@/lib/api";
import { formatClock } from "@/lib/format";

export function JudgeScoresPanel({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [summary, setSummary] = useState<JudgeScoreSummaryRow[]>([]);
  const [entries, setEntries] = useState<JudgeScoreEntryRow[]>([]);

  useEffect(() => {
    api<{ summary: JudgeScoreSummaryRow[]; entries: JudgeScoreEntryRow[] }>("/admin/judge-scores", { token })
      .then((data) => {
        setSummary(data.summary);
        setEntries(data.entries);
      })
      .catch(() => {});
  }, [token, refreshKey]);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Gavel className="h-5 w-5 text-primary" />
        <CardTitle>Judge Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Team Averages</TabsTrigger>
            <TabsTrigger value="entries">All Entries ({entries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Judges</TableHead>
                  <TableHead>Hygiene</TableHead>
                  <TableHead>Dress</TableHead>
                  <TableHead>Sweet</TableHead>
                  <TableHead>Savoury</TableHead>
                  <TableHead>Taste</TableHead>
                  <TableHead>Total /50</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row) => (
                  <TableRow key={row.teamId}>
                    <TableCell className="font-medium">{row.teamName}</TableCell>
                    <TableCell>{row.tableNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.judgeCount > 0 ? "success" : "muted"}>{row.judgeCount}</Badge>
                    </TableCell>
                    <TableCell>{row.avgHygiene ?? "—"}</TableCell>
                    <TableCell>{row.avgDressCode ?? "—"}</TableCell>
                    <TableCell>{row.avgSweet ?? "—"}</TableCell>
                    <TableCell>{row.avgSavoury ?? "—"}</TableCell>
                    <TableCell>{row.avgTaste ?? "—"}</TableCell>
                    <TableCell className="font-display font-bold">{row.avgTotal ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {summary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      No teams yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="entries">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Judge</TableHead>
                  <TableHead>Hygiene</TableHead>
                  <TableHead>Dress</TableHead>
                  <TableHead>Sweet</TableHead>
                  <TableHead>Savoury</TableHead>
                  <TableHead>Taste</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.teamName}</TableCell>
                    <TableCell>{row.judgeName}</TableCell>
                    <TableCell>{row.hygiene}</TableCell>
                    <TableCell>{row.dressCode}</TableCell>
                    <TableCell>{row.sweet}</TableCell>
                    <TableCell>{row.savoury}</TableCell>
                    <TableCell>{row.taste}</TableCell>
                    <TableCell className="font-semibold">{row.total}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatClock(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      No scores submitted yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
