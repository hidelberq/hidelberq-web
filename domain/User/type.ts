import type { Email, Path, Url } from "../vo";

export type User = {
  type: "User";

  id: string;
  name: string;
  email: Email;
  imgUrl: Url | Path | null;
  discord: string;
  github: string;
  createdAt: Date;
  updatedAt: Date;
};
