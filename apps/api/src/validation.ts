import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const text = z.string().trim().min(1).max(500);

export const voteSchema = z.object({
  email,
  teamId: z.string().uuid()
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1)
});

export const votingStartSchema = z.object({
  durationMinutes: z.number().int().min(1).max(240).default(10)
});

export const colorSelectionStartSchema = z.object({
  durationMinutes: z.number().int().min(1).max(240).default(15)
});

export const settingsSchema = z.object({
  showLiveResults: z.boolean().optional(),
  eventName: z.string().trim().min(1).max(120).optional(),
  colorSelectionOpen: z.boolean().optional(),
  judgePasscode: z.string().trim().min(3).max(40).optional()
});

export const teamColorAssignSchema = z.object({
  colorId: z.string().uuid().nullable()
});

export const colorSchema = z.object({
  name: text.max(120),
  hexCode: z.string().trim().regex(/^#[0-9A-F]{6}$/i, "Hex code must be in #RRGGBB format.")
});

export const teamTableAssignSchema = z.object({
  tableNumber: z.number().int().min(1).max(9999).nullable()
});

export const judgeLoginSchema = z.object({
  passcode: z.string().trim().min(1),
  judgeName: z.string().trim().min(2).max(60)
});

const score = z.number().int().min(1).max(10);

export const judgeScoreSchema = z.object({
  teamId: z.string().uuid(),
  judgeName: z.string().trim().min(2).max(60),
  hygiene: score,
  dressCode: score,
  sweet: score,
  savoury: score,
  taste: score
});
