import { createMetaTags } from "../util";
import type { Route } from "./+types/apps";
import { AppCard } from "./apps/AppCard";
import { APPS_DATA } from "./apps/apps-data";

export const meta = (_: Route.MetaArgs) =>
  createMetaTags({
    title: "Apps | NWU",
    description: "NWUが開発したアプリケーション一覧",
  });

export default function Apps() {
  return (
    <main className="bg-white dark:bg-gray-900 min-h-screen pb-20 flex flex-col justify-start items-center p-8 pt-12 md:pt-16 transition-colors duration-300 font-sg">
      <div className="max-w-2xl w-full">
        <div className="my-8">
          <h1 className="text-2xl py-2 font-medium text-center text-gray-800 dark:text-gray-300">
            Apps
          </h1>
        </div>

        <div className="space-y-4">
          {APPS_DATA.map((app) => (
            <AppCard key={app.name} app={app} />
          ))}
        </div>
      </div>
    </main>
  );
}
