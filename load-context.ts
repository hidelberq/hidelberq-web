import type { Auth, Logger } from "@nw-union/nw-utils";
import { newAuthCloudflare } from "@nw-union/nw-utils/adapter/auth-cloudflare";
import { newAuthMock } from "@nw-union/nw-utils/adapter/auth-mock";
import { newLogConsole } from "@nw-union/nw-utils/adapter/log-console";
import { newLogJson } from "@nw-union/nw-utils/adapter/log-json";
import type { AppLoadContext } from "react-router";
import { match } from "ts-pattern";
import { newNoteApi } from "./adapter/note/api";
import {
  newDocKiokuRepository,
  newDocRepository,
} from "./adapter/repository/drizzle/doc";
import {
  newNoteKiokuRepository,
  newNoteRepository,
} from "./adapter/repository/drizzle/note";
import { newUserRepository } from "./adapter/repository/drizzle/user";
import {
  newYoutubeKiokuRepository,
  newYoutubeRepository,
} from "./adapter/repository/drizzle/youtube";
import { newLocalStorage } from "./adapter/storage/local";
import { newStorage } from "./adapter/storage/r2";
import { newTime } from "./adapter/time/now";
import { newYoutubeApi } from "./adapter/youtube/api";
import { newYoutubeMock } from "./adapter/youtube/mock";
import { newDocWorkFlows } from "./domain/Doc/workflow";
import { newKiokuWorkFlows } from "./domain/Kioku/workflow";
import { newNoteWorkFlows } from "./domain/Note/workflow";
import { newSystemWorkFlows, type StoragePort } from "./domain/System/workflow";
import { newUserWorkFlows } from "./domain/User/workflow";
import { newYoutubeWorkFlows } from "./domain/Youtube/workflow";
import type {
  DocWorkFlows,
  KiokuWorkFlows,
  NoteWorkFlows,
  SystemWorkFlows,
  UserWorkFlows,
  YoutubeWorkFlows,
} from "./type";

declare global {
  interface CloudflareEnvironment extends Env {}
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: CloudflareEnvironment;
      ctx: Omit<ExecutionContext, "props">;
    };
    log: Logger;
    auth: Auth;
    wf: {
      doc: DocWorkFlows;
      user: UserWorkFlows;
      sys: SystemWorkFlows;
      kioku: KiokuWorkFlows;
      youtube: YoutubeWorkFlows;
      note: NoteWorkFlows;
    };
  }
}

type GetLoadContextArgs = {
  request: Request;
  context: Pick<AppLoadContext, "cloudflare">;
};

export function getLoadContext({ context }: GetLoadContextArgs) {
  const { cloudflare } = context;
  const log = createLog(cloudflare.env);
  const db = cloudflare.env.DB;
  const time = newTime();

  return {
    cloudflare,
    log,
    auth: createAuth(cloudflare.env),
    wf: {
      doc: newDocWorkFlows(newDocRepository(db, log), time),
      user: newUserWorkFlows(newUserRepository(db, log), time),
      sys: newSystemWorkFlows(createStorage(cloudflare.env, log)),
      kioku: newKiokuWorkFlows(
        newDocKiokuRepository(db, log),
        newYoutubeKiokuRepository(db, log),
        newNoteKiokuRepository(db, log),
      ),
      youtube: newYoutubeWorkFlows(
        newYoutubeRepository(db, log),
        createYoutube(cloudflare.env, log),
        time,
      ),
      note: newNoteWorkFlows(
        newNoteRepository(db, log),
        createNote(cloudflare.env, log),
        time,
      ),
    },
  };
}

// Dependency Injection --------------------------------------------------------

const createAuth = (env: CloudflareEnvironment): Auth =>
  match(env.AUTH_ADAPTER)
    .with("mock", () => newAuthMock())
    .with("cloudflare", () => newAuthCloudflare(env.AUTH_TEAM_DOMAIN))
    .exhaustive();

const createLog = (env: CloudflareEnvironment): Logger =>
  match(env.LOG_ADAPTER)
    .with("console", () => newLogConsole(env.LOG_LEVEL))
    .with("json", () => newLogJson(env.LOG_LEVEL))
    .exhaustive();

const createStorage = (env: CloudflareEnvironment, log: Logger): StoragePort =>
  match(env.STORAGE_ADAPTER)
    .with("localstorage", () => newLocalStorage(log))
    .with("r2", () => newStorage(env.BUCKET, env.STORAGE_DOMAIN, log))
    .exhaustive();

const createYoutube = (env: CloudflareEnvironment, log: Logger) =>
  match(env.YOUTUBE_ADAPTER)
    .with("mock", () => newYoutubeMock())
    .with("api", () => newYoutubeApi(env.YOUTUBE_API_KEY ?? "", log))
    .exhaustive();

const createNote = (env: CloudflareEnvironment, log: Logger) =>
  match(env.NOTE_ADAPTER)
    // .with("mock", () => newNoteMock())
    .with("api", () => newNoteApi(log))
    .exhaustive();
