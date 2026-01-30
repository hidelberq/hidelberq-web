import { ExternalLinkIcon, GitHubIcon } from "../../components/Icons";
import type { AppData } from "./apps-data";

interface AppCardProps {
  app: AppData;
}

const LiveAppLink = ({ app }: { app: AppData }) => (
  <a href={app.url} target="_blank" rel="noreferrer" className="flex-1 group">
    <div className="flex items-center gap-3 mb-1">
      <span className="text-lg">{app.icon}</span>
      <h2 className="text-lg text-base font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
        {app.name}
        <ExternalLinkIcon className="w-4 h-4 opacity-50" />
      </h2>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 ml-7">
      {app.description}
    </p>
  </a>
);

const DevAppInfo = ({ app }: { app: AppData }) => (
  <div className="flex-1">
    <div className="flex items-center gap-3 mb-1">
      <span className="text-lg">{app.icon}</span>
      <h2 className="text-lg text-base font-medium text-gray-900 dark:text-gray-100">
        {app.name}
      </h2>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 ml-7">
      {app.description}
    </p>
  </div>
);

const SourceLink = ({ app }: { app: AppData }) => (
  <a
    href={app.source}
    target="_blank"
    rel="noreferrer"
    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-all"
    aria-label={`View ${app.name} source`}
  >
    <GitHubIcon className="w-6 h-6 text-white dark:text-white" />
  </a>
);

const DevelopmentBadge = () => (
  <span className="text-sm font-medium mr-4 text-gray-500 dark:text-gray-500">
    開発中...
  </span>
);

export const AppCard = ({ app }: AppCardProps) => {
  const isLive = app.status === "live";

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 pb-6">
      <div className="flex items-center justify-between">
        {isLive ? <LiveAppLink app={app} /> : <DevAppInfo app={app} />}
        <div className="flex items-center gap-2 ml-4">
          {isLive ? <SourceLink app={app} /> : <DevelopmentBadge />}
        </div>
      </div>
    </div>
  );
};
