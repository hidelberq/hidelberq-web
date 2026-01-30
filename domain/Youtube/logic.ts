import type { YoutubeId } from "../vo";
import type { Youtube, YoutubeInfo } from "./type";

// ----------------------------------------------------------------------------
// Validator (DTO -> Domain Type)
// ----------------------------------------------------------------------------
// なし

// ----------------------------------------------------------------------------
// Domain Logic (Domain Type -> Domain Type)
// ----------------------------------------------------------------------------
/**
 * Youtube を新規作成
 *
 * Logic Rules:
 *   - id, title, channelName, duration, isPublic は入力値をそのまま使用
 *   - createdAt, updatedAt は引数 now となる
 */
export const createYoutube = ([id, info, now]: [
  YoutubeId,
  YoutubeInfo,
  Date,
]): Youtube => ({
  type: "Youtube",
  id,
  info,
  createdAt: now,
  updatedAt: now,
});

// ----------------------------------------------------------------------------
// Converter (Domain Type -> DTO)
// ----------------------------------------------------------------------------
// なし
