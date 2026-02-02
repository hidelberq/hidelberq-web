import type { Route } from "./+types/debug";
import { drizzle } from "drizzle-orm/d1";
import { newsCache } from "../db/schema";
import { desc } from "drizzle-orm";

// --- Meta ---
export function meta(): Route.MetaDescriptors {
	return [
		{ title: "デバッグ: AI生成結果" },
		{ name: "robots", content: "noindex" },
	];
}

// --- Loader ---
export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);

	const entries = await db
		.select()
		.from(newsCache)
		.orderBy(desc(newsCache.createdAt))
		.limit(10);

	return { entries };
}

// --- Component ---
export default function Debug({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-screen bg-black text-white font-sans">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
				<div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-lg">🔍</span>
						<h1 className="text-lg font-bold">
							デバッグ: Step 1 AI生成結果
						</h1>
					</div>
					<a
						href="/"
						className="text-sm text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full hover:bg-blue-400/10"
					>
						タイムラインに戻る
					</a>
				</div>
			</header>

			<main className="max-w-3xl mx-auto px-4 py-6">
				{loaderData.entries.length === 0 ? (
					<div className="p-12 text-center text-gray-500">
						<div className="text-4xl mb-4">📭</div>
						<p className="text-lg mb-2">
							ニュースキャッシュがありません
						</p>
						<p className="text-sm">
							トップページを読み込むとStep
							1でニュースが取得されます
						</p>
					</div>
				) : (
					<div className="space-y-6">
						{loaderData.entries.map((entry) => (
							<article
								key={entry.id}
								className="border border-gray-800 rounded-lg overflow-hidden"
							>
								{/* Entry header */}
								<div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
									<div className="flex items-center gap-3 text-sm">
										<span className="font-mono text-gray-400">
											ID: {entry.id}
										</span>
										<span className="text-gray-600">|</span>
										<span className="text-blue-400 font-medium">
											{entry.fetchedDate}
										</span>
									</div>
									{entry.createdAt && (
										<span className="text-xs text-gray-500">
											{entry.createdAt.toLocaleString(
												"ja-JP",
											)}
										</span>
									)}
								</div>

								{/* Content length indicator */}
								<div className="px-4 py-1.5 bg-gray-900/30 border-b border-gray-800 text-xs text-gray-500">
									文字数: {entry.content.length}
								</div>

								{/* Raw content */}
								<div className="px-4 py-3">
									<pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300 font-sans">
										{entry.content}
									</pre>
								</div>
							</article>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
