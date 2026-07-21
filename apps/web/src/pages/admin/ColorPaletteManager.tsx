import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, ColorOption } from "@/lib/api";

const capacityVariant = (color: ColorOption) =>
  color.remaining <= 0 ? "success" : color.remaining < color.capacity ? "accent" : "muted";

export function ColorPaletteManager({
  token,
  colors,
  onChanged
}: {
  token: string;
  colors: ColorOption[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const addColor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await api("/admin/colors", {
        method: "POST",
        token,
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      form.reset();
      setOpen(false);
      await onChanged();
      toast.success("Color added.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to add color.");
    } finally {
      setBusy(false);
    }
  };

  const deleteColor = async (id: string) => {
    try {
      await api(`/admin/colors/${id}`, { method: "DELETE", token });
      await onChanged();
      toast.success("Color removed.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to remove color.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Color Palette</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" /> Add Color
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a color</DialogTitle>
            </DialogHeader>
            <form onSubmit={addColor} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Color name</Label>
                <Input id="name" name="name" placeholder="e.g. Amber Gold" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hexCode">Hex code</Label>
                <Input id="hexCode" name="hexCode" placeholder="#F59E0B" required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy ? "Adding..." : "Add Color"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {colors.map((color) => (
            <div key={color.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: color.hexCode }} />
                <div>
                  <p className="text-sm font-medium leading-tight">{color.name}</p>
                  <p className="text-xs text-muted-foreground">{color.hexCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={capacityVariant(color)}>
                  {color.remaining}/{color.capacity} left
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={color.remaining !== color.capacity}
                  onClick={() => deleteColor(color.id)}
                  title={color.remaining !== color.capacity ? "Only colors with no reservations can be removed" : "Remove color"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {colors.length === 0 && <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">No colors yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
