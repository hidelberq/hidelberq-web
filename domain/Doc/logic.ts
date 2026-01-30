import { createDocId, type String1To100, type Url, type UserId } from "../vo";
import type { Doc } from "./type";

// ----------------------------------------------------------------------------
// Validator (DTO -> DomainType)
// ----------------------------------------------------------------------------
// なし

// ----------------------------------------------------------------------------
// Domain Logic (DomainType -> DomainType)
// ----------------------------------------------------------------------------
/**
 * Doc を新規作成
 *
 * @param title - Doc のタイトル
 * @param userId - 作成者のユーザーID
 * @param now - 現在日時
 * @return Doc - 作成された Doc
 *
 * Logic Rules:
 *   - title は 入力値の値となる
 *   - title を見出し1として body にセット
 *   - description, thumbnailUrl は null にセット
 *   - status は "private" にセット
 *   - userId は 引数 userId となる
 *   - createdAt, updatedAt は 引数 now となる
 */
export const createDoc = ([title, userId, now]: [
  String1To100,
  UserId,
  Date,
]): Doc => ({
  type: "Doc",
  id: createDocId(),
  title,
  description: null,
  status: "private",
  body: initialDocBody(title),
  thumbnailUrl: null,
  userId,
  createdAt: now,
  updatedAt: now,
});

const initialDocBody = (title: string): string =>
  JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: title.trim() }],
      },
      { type: "paragraph" },
    ],
  });

/**
 * Doc を更新
 *
 * @param doc - 更新対象の Doc
 * @param title - Doc のタイトル
 * @param description - Doc の説明文
 * @param status - Doc の公開ステータス
 * @param body - Doc の本文
 * @param thumbnailUrl - Doc のサムネイルURL
 * @param now - 現在日時
 *
 * @return Doc - 更新された Doc
 *
 * Logic Rules:
 *  - title, description, status, body, thumbnailUrl を 引数の値で更新する
 *  - updatedAt は 引数 now となる
 */
export const updatedDoc = ([
  doc,
  title,
  description,
  status,
  body,
  thumbnailUrl,
  now,
]: [
  Doc,
  String1To100,
  String1To100 | null,
  "public" | "private",
  string,
  Url | null,
  Date,
]): Doc => ({
  ...doc,
  title,
  description,
  status,
  body,
  thumbnailUrl,
  updatedAt: now,
});

// ----------------------------------------------------------------------------
// Converter (Domain Type -> DTO)
// ----------------------------------------------------------------------------
// なし
