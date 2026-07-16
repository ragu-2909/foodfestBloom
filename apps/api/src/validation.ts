import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const text = z.string().trim().min(1).max(500);

export const registrationSchema = z.object({
  email,
  employeeName: text.max(120),
  teamName: text.max(160),
  teamMembers: text.max(1000),
  foodCategory: text.max(120),
  contactNumber: z.string().trim().min(6).max(30),
  description: z.string().trim().max(1000).optional().nullable()
});

export const voteSchema = z.object({
  email,
  teamId: z.string().uuid()
});

export const teamSchema = z.object({
  name: text.max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  members: z.string().trim().max(1000).optional().nullable(),
  category: text.max(120)
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1)
});

export const votingStartSchema = z.object({
  durationMinutes: z.number().int().min(1).max(240).default(10)
});

export const settingsSchema = z.object({
  registrationOpen: z.boolean().optional(),
  showLiveResults: z.boolean().optional(),
  eventName: z.string().trim().min(1).max(120).optional(),
  colorSelectionOpen: z.boolean().optional()
});
