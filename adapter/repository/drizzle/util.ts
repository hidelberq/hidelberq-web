import { AppError, SystemError } from "@nw-union/nw-utils";
import { match, P } from "ts-pattern";

export const dbErrorHandling = (e: unknown): AppError =>
  match(e)
    .with(P.instanceOf(AppError), (e) => e)
    .with(P.instanceOf(Error), (e) => new SystemError(e.message, [], e))
    .otherwise((e) => new SystemError(`database unknown error. error: ${e}`));
