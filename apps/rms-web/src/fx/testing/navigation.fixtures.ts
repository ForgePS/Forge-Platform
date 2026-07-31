import { RMS_FEATURE_FLAGS } from "@/lib/constants";

export const allProductFlagsOn = Object.fromEntries(
  Object.values(RMS_FEATURE_FLAGS).map((key) => [key, true]),
) as Record<string, boolean>;

export const noProductFlags = Object.fromEntries(
  Object.values(RMS_FEATURE_FLAGS).map((key) => [key, false]),
) as Record<string, boolean>;
