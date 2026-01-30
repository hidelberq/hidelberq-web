import type { DocId, String1To100, Url, UserId } from "../vo";

export type Doc = {
  type: "Doc";

  id: DocId;
  title: String1To100;
  description: String1To100 | null;
  status: "public" | "private";
  body: string;
  thumbnailUrl: Url | null;
  userId: UserId;
  createdAt: Date;
  updatedAt: Date;
};
