import { match } from "ts-pattern";
import type { Kioku as KiokuDto } from "../../type";
import { toShortDocId } from "../vo";
import type { Kioku } from "./type";

// 複数の Kioku[] をマージして、createdAt で降順ソートする関数
export const mergeAndSortKiokus = (kiokuLists: Kioku[][]): Kioku[] =>
  [...kiokuLists.flat()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

export const convertToKiokuDto = (k: Kioku): KiokuDto =>
  match(k)
    .with({ type: "DocKioku" }, (docKioku) => ({
      id: docKioku.id,
      title: docKioku.title,
      name: docKioku.userName,
      category: "doc" as const,
      thumbnailUrl: docKioku.thumbnailUrl,
      url: `/docs/${toShortDocId(docKioku.id)}`,
      createdAt: docKioku.createdAt,
    }))
    .with({ type: "NoteKioku" }, (noteKioku) => ({
      id: noteKioku.id,
      title: noteKioku.title,
      name: noteKioku.noteUserName,
      category: "note" as const,
      thumbnailUrl: noteKioku.thumbnailUrl,
      url: noteKioku.url,
      createdAt: noteKioku.createdAt,
    }))
    .with({ type: "YoutubeKioku" }, (youtubeKioku) => ({
      id: youtubeKioku.id,
      title: youtubeKioku.title,
      name: youtubeKioku.channelName,
      category: youtubeKioku.isPublic
        ? ("youtube" as const)
        : ("privateYoutube" as const),
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeKioku.id}/hqdefault.jpg`,
      duration: youtubeKioku.duration,
      url: `https://www.youtube.com/watch?v=${youtubeKioku.id}`,
      createdAt: youtubeKioku.createdAt,
    }))
    .exhaustive();
