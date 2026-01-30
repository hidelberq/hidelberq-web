import type { NoteId, Url } from "../vo";

export type Note = {
  type: "Note";

  id: NoteId;
  info: NoteInfo;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteInfo = {
  type: "NoteInfo";

  title: string;
  noteUserName: string;
  url: Url;
  thumbnailUrl: Url | null;
};
