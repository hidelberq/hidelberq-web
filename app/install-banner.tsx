import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 既に閉じたことがある場合は表示しない
    if (sessionStorage.getItem("pwa-banner-dismissed")) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  }, []);

  if (!deferredPrompt || dismissed || installed) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-slide-up">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-violet-900/95 p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <img
            src="/icon-192.png"
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">
              アプリをインストール
            </p>
            <p className="text-sm text-white/60">
              ホーム画面に追加してすぐにアクセス
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleDismiss}
              className="rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              閉じる
            </button>
            <button
              onClick={handleInstall}
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 transition-colors"
            >
              インストール
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
