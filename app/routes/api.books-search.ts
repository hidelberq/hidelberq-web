import type { Route } from "./+types/api.books-search";
import type { BookSearchResult } from "~/books/types";
import { drizzle } from "drizzle-orm/d1";
import { eq, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { bookSearchCache } from "~/db/schema";

interface GoogleBooksResponse {
	totalItems: number;
	items?: Array<{
		volumeInfo: {
			title?: string;
			authors?: string[];
			industryIdentifiers?: Array<{
				type: string;
				identifier: string;
			}>;
			publishedDate?: string;
			publisher?: string;
			imageLinks?: {
				thumbnail?: string;
				smallThumbnail?: string;
			};
			pageCount?: number;
			description?: string;
		};
	}>;
}

// キャッシュ有効期間: 24時間
const CACHE_TTL_SECONDS = 60 * 60 * 24;

function normalizeQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const query = url.searchParams.get("q");

	if (!query || query.trim().length === 0) {
		return Response.json({ results: [] });
	}

	const db = drizzle(context.cloudflare.env.DB);
	const normalized = normalizeQuery(query);

	// キャッシュから検索
	const now = Math.floor(Date.now() / 1000);
	const cacheExpiry = now - CACHE_TTL_SECONDS;

	const [cached] = await db
		.select()
		.from(bookSearchCache)
		.where(eq(bookSearchCache.query, normalized))
		.limit(1);

	if (cached) {
		const cachedTime = cached.createdAt
			? Math.floor(cached.createdAt.getTime() / 1000)
			: 0;
		if (cachedTime > cacheExpiry) {
			// キャッシュヒット
			const results = JSON.parse(cached.results) as BookSearchResult[];
			return Response.json({ results });
		}
		// 期限切れキャッシュを削除
		await db
			.delete(bookSearchCache)
			.where(eq(bookSearchCache.id, cached.id));
	}

	// 古いキャッシュも定期的に掃除（確率的に実行）
	if (Math.random() < 0.1) {
		await db
			.delete(bookSearchCache)
			.where(
				lt(
					bookSearchCache.createdAt,
					sql`${cacheExpiry}`,
				),
			);
	}

	// Google Books API にリクエスト
	const googleBooksUrl = new URL(
		"https://www.googleapis.com/books/v1/volumes",
	);
	googleBooksUrl.searchParams.set("q", query);
	googleBooksUrl.searchParams.set("maxResults", "10");
	googleBooksUrl.searchParams.set("langRestrict", "ja");
	googleBooksUrl.searchParams.set("printType", "books");

	const response = await fetch(googleBooksUrl.toString());

	if (response.status === 429) {
		// レート制限: キャッシュに空結果を短時間保存して連続リクエストを防ぐ
		return Response.json(
			{ results: [], error: "rate_limited" },
			{ status: 429 },
		);
	}

	if (!response.ok) {
		return Response.json({ results: [] });
	}

	const data = (await response.json()) as GoogleBooksResponse;

	const results: BookSearchResult[] = (data.items ?? []).map((item) => {
		const vol = item.volumeInfo;
		const isbn =
			vol.industryIdentifiers?.find((id) => id.type === "ISBN_13")
				?.identifier ??
			vol.industryIdentifiers?.find((id) => id.type === "ISBN_10")
				?.identifier ??
			null;

		// HTTPS に変換
		let coverUrl = vol.imageLinks?.thumbnail ?? null;
		if (coverUrl?.startsWith("http://")) {
			coverUrl = coverUrl.replace("http://", "https://");
		}

		return {
			title: vol.title ?? "",
			author: vol.authors?.join(", ") ?? "",
			isbn,
			publishedYear: vol.publishedDate?.slice(0, 4) ?? null,
			publisher: vol.publisher ?? null,
			coverImageUrl: coverUrl,
			pageCount: vol.pageCount ?? null,
			description: vol.description?.slice(0, 200) ?? null,
		};
	});

	// 結果をキャッシュに保存
	await db
		.insert(bookSearchCache)
		.values({
			query: normalized,
			results: JSON.stringify(results),
		})
		.onConflictDoUpdate({
			target: bookSearchCache.query,
			set: {
				results: JSON.stringify(results),
				createdAt: sql`(strftime('%s', 'now'))`,
			},
		});

	return Response.json({ results });
}
