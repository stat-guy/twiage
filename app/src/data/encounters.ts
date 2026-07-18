import type { Encounter } from "@/lib/types";
import chestPain from "../../../data/encounters/chest-pain.json";
import abdominalPain from "../../../data/encounters/abdominal-pain.json";
import shortnessOfBreath from "../../../data/encounters/shortness-of-breath.json";

export const encounters = [
  chestPain,
  abdominalPain,
  shortnessOfBreath,
] as unknown as Encounter[];
