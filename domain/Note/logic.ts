import { createNoteId } from "../vo";
import type { Note, NoteInfo } from "./type";

// ----------------------------------------------------------------------------
// Validator (DTO -> Domain Type)
// ----------------------------------------------------------------------------
// なし

// ----------------------------------------------------------------------------
// Domain Logic (Domain Type -> Domain Type)
// ----------------------------------------------------------------------------
/**
 * Note を新規作成
 *
 * Logic Rules:
 *   - id, title, noteUserName, url, thumbnailUrl は入力値をそのまま使用
 *   - createdAt, updatedAt は引数 now となる
 */
export const createNote = ([info, now]: [NoteInfo, Date]): Note => ({
  type: "Note",
  id: createNoteId(),
  info,
  createdAt: now,
  updatedAt: now,
});

// ----------------------------------------------------------------------------
// Converter (Domain Type -> DTO)
// ----------------------------------------------------------------------------
// なし
