import type { YoutubeId } from "../vo";

export type Youtube = {
  type: "Youtube";

  id: YoutubeId;
  info: YoutubeInfo;
  createdAt: Date;
  updatedAt: Date;
};

export type YoutubeInfo = {
  type: "YoutubeInfo";

  title: string;
  channelName: string;
  duration: string;
  isPublic: boolean;
};
