import type { DocId, NoteId, YoutubeId } from "../vo";

export type DocKioku = {
  type: "DocKioku";

  id: DocId;
  title: string;
  userName: string;
  thumbnailUrl: string;
  createdAt: Date;
};

export type NoteKioku = {
  type: "NoteKioku";

  id: NoteId;
  title: string;
  noteUserName: string;
  url: string;
  thumbnailUrl: string;
  createdAt: Date;
};

export type YoutubeKioku = {
  type: "YoutubeKioku";

  id: YoutubeId;
  title: string;
  channelName: string;
  isPublic: boolean;
  duration: string;
  createdAt: Date;
};

export type Kioku = DocKioku | NoteKioku | YoutubeKioku;
