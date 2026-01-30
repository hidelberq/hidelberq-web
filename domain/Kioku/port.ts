import type { AppError } from "@nw-union/nw-utils";
import type { ResultAsync } from "neverthrow";
import type { Kioku } from "./type";

export interface DocKiokuRepositoryPort {
  getAll(): ResultAsync<Kioku[], AppError>;
}

export interface NoteKiokuRepositoryPort {
  getAll(): ResultAsync<Kioku[], AppError>;
}

export interface YoutubeKiokuRepositoryPort {
  getAll(): ResultAsync<Kioku[], AppError>;
}
