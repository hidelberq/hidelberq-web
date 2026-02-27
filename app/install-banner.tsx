import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// iOS Safari かどうかを判定
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

// スタンドアロンモード（既にインストール済み）かどうかを判定
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone: boolean }).standalone)
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block h-5 w-5 align-text-bottom text-blue-400"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    if (sessionStorage.getItem("pwa-banner-dismissed")) {
      setDismissed(true);
      return;
    }

    if (isIOS()) {
      setShowIOSGuide(true);
      return;
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

  if (dismissed || installed) return null;

  // Chromium 系ブラウザ向けインストールバナー
  if (deferredPrompt) {
    return (
      <BannerWrapper onDismiss={handleDismiss}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">アプリをインストール</p>
          <p className="text-sm text-white/60">
            ホーム画面に追加してすぐにアクセス
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <DismissButton onClick={handleDismiss} />
          <button
            onClick={handleInstall}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 transition-colors"
          >
            インストール
          </button>
        </div>
      </BannerWrapper>
    );
  }

  // iOS Safari 向けガイドバナー
  if (showIOSGuide) {
    return (
      <BannerWrapper onDismiss={handleDismiss}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">アプリをホーム画面に追加</p>
          <p className="text-sm text-white/60">
            <ShareIcon /> をタップして「ホーム画面に追加」を選択
          </p>
        </div>
        <DismissButton onClick={handleDismiss} />
      </BannerWrapper>
    );
  }

  return null;
}

function BannerWrapper({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-slide-up">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-violet-900/95 p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <img
            src="/icon-192.png"
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          {children}
        </div>
      </div>
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
    >
      閉じる
    </button>
  );
}
