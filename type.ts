import type { AppError } from "@nw-union/nw-utils";
import { newType } from "@nw-union/nw-utils/lib/zod";
import type { ResultAsync } from "neverthrow";
import z from "zod";

// ---------------------------

export type Doc = {
  id: string;
  title: string;
  description: string;
  status: DocStatus;
  body: string;
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

const docStatus = z.enum([
  "public", // 公開
  "private", // メンバー限定
]);
export type DocStatus = z.infer<typeof docStatus>;
export const allDocStatus = docStatus.options;
export const newDocStatus = newType(docStatus, "DocStatus");

// ---------------------------

export interface DocWorkFlows {
  // ドキュメント作成
  create(cmd: CreateDocCmd): ResultAsync<CreateDocEvt, AppError>;
  // ドキュメントを編集する
  update(cmd: UpdateDocCmd): ResultAsync<UpdateDocEvt, AppError>;
  // ドキュメントを削除する
  delete(cmd: DeleteDocCmd): ResultAsync<DeleteDocEvt, AppError>;

  // ドキュメントを見る
  get(q: GetDocQuery): ResultAsync<GetDocEvt, AppError>;
}

// CreateDoc コマンド
export type CreateDocCmd = {
  title: string;
  userId: string; // 作成者ID
};

// CreateDoc イベント
export type CreateDocEvt = {
  id: string;
};

// UpdateDoc コマンド
export type UpdateDocCmd = {
  id: string; // 編集するドキュメントのID
  title: string;
  description: string;
  status: DocStatus;
  body: string;
  thumbnailUrl: string;
  userId: string; // 編集者ID
};

// UpdateDoc イベント
export type UpdateDocEvt = undefined;

// DeleteDoc コマンド
export type DeleteDocCmd = {
  id: string; // 削除するドキュメントのID
};

// DeleteDoc イベント
export type DeleteDocEvt = undefined;

// GetDoc クエリ
export type GetDocQuery = {
  id: string;
};

// GetDoc イベント
export type GetDocEvt = {
  doc: Doc;
};

// ---------------------------

export interface SystemWorkFlows {
  // ファイルをアップロードする
  uploadFile(cmd: UploadFileCmd): ResultAsync<UploadFileEvt, AppError>;
}

// UploadFile コマンド
export interface UploadFileCmd {
  file: Blob;
}

// UploadFile イベント
export interface UploadFileEvt {
  url: string;
}

// ---------------------------

export type User = {
  id: string;
  name: string;
  email: string;
  imgUrl: string;
  discord: string;
  github: string;
};

export interface UserWorkFlows {
  // ユーザーを取得する
  get(q: GetUserQuery): ResultAsync<GetUserEvt, AppError>;
  // ユーザーを更新する
  update(cmd: UpdateUserCmd): ResultAsync<UpdateUserEvt, AppError>;
}

// GetUser クエリ
export interface GetUserQuery {
  id: string;
  email: string;
}

// GetUser イベント
export interface GetUserEvt {
  user: User;
}

// UpdateUser コマンド
export type UpdateUserCmd = {
  id: string; // 更新するユーザーのID
  name: string;
  imgUrl: string;
  discord: string;
  github: string;
};

// UpdateUser イベント
export type UpdateUserEvt = undefined;

// ---------------------------

export type Kioku = {
  id: string;
  title: string;
  name: string;
  category: "doc" | "note" | "youtube" | "privateYoutube";
  thumbnailUrl: string;
  duration?: string;
  url: string;
  createdAt: Date;
};

export interface KiokuWorkFlows {
  // キオクを探す
  get(): ResultAsync<Kioku[], AppError>;
}

// ---------------------------

export interface YoutubeWorkFlows {
  create(cmd: CreateYoutubeCmd): ResultAsync<CreateYoutubeEvt, AppError>;
}

export type CreateYoutubeCmd = {
  id: string;
  userId: string;
};

export type CreateYoutubeEvt = {
  id: string;
};

// ---------------------------

export interface NoteWorkFlows {
  create(cmd: CreateNoteCmd): ResultAsync<CreateNoteEvt, AppError>;
}

export type CreateNoteCmd = {
  noteId: string;
  userId: string;
};

export type CreateNoteEvt = {
  id: string;
};
