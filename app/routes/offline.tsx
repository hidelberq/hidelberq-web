export default function Offline() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">オフライン</h1>
        <p className="text-lg text-white/70 mb-6">
          インターネット接続がありません。接続を確認してからもう一度お試しください。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-violet-700 px-6 py-3 font-medium text-white hover:bg-violet-600 transition-colors"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}
