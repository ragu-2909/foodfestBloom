import { Cookie, Shirt, Soup, Sparkles, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { ScoreCategories } from "@/lib/api";

export type CategoryKey = keyof ScoreCategories;

export const categories: { key: CategoryKey; label: string; question: string; icon: LucideIcon }[] = [
  { key: "hygiene", label: "Hygiene", question: "How was hygiene at their station?", icon: Sparkles },
  { key: "dressCode", label: "Dress Code", question: "How was their dress code & presentation?", icon: Shirt },
  { key: "sweet", label: "Sweet Dish", question: "How was the sweet dish?", icon: Cookie },
  { key: "savoury", label: "Savoury Dish", question: "How was the savoury dish?", icon: Soup },
  { key: "taste", label: "Overall Taste", question: "Overall, how was the taste?", icon: UtensilsCrossed }
];
