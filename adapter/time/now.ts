import { okAsync } from "neverthrow";
import type { TimePort } from "../../domain/port";

export const newTime = (): TimePort => ({
  getNow: () => okAsync(new Date()),
});
