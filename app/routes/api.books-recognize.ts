import type { Route } from "./+types/api.books-recognize";
import { GoogleGenAI } from "@google/genai";
import type { BookSearchResult } from "~/books/types";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { bookSearchCache } from "~/db/schema";

// Gemini Vision で認識された書籍情報
interface RecognizedBook {
	title: string;
	author: string;
}

// キャッシュ有効期間: 24時間
const CACHE_TTL_SECONDS = 60 * 60 * 24;

function normalizeQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, " ");
}

// Google Books API で書籍情報を補完
async function searchGoogleBooks(
	query: string,
	env: { DB: D1Database; GOOGLE_BOOKS_API_KEY?: string },
): Promise<BookSearchResult | null> {
	const db = drizzle(env.DB);
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
			const results = JSON.parse(cached.results) as BookSearchResult[];
			return results[0] ?? null;
		}
	}

	const googleBooksUrl = new URL(
		"https://www.googleapis.com/books/v1/volumes",
	);
	googleBooksUrl.searchParams.set("q", query);
	googleBooksUrl.searchParams.set("maxResults", "3");
	googleBooksUrl.searchParams.set("langRestrict", "ja");
	googleBooksUrl.searchParams.set("printType", "books");

	if (env.GOOGLE_BOOKS_API_KEY) {
		googleBooksUrl.searchParams.set("key", env.GOOGLE_BOOKS_API_KEY);
	}

	try {
		const response = await fetch(googleBooksUrl.toString());
		if (!response.ok) return null;

		const data = (await response.json()) as {
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
		};

		if (!data.items?.length) return null;

		const results: BookSearchResult[] = data.items.map((item) => {
			const vol = item.volumeInfo;
			const isbn =
				vol.industryIdentifiers?.find((id) => id.type === "ISBN_13")
					?.identifier ??
				vol.industryIdentifiers?.find((id) => id.type === "ISBN_10")
					?.identifier ??
				null;

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

		// キャッシュに保存
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

		return results[0] ?? null;
	} catch {
		return null;
	}
}

// 拡張子を MIME タイプから決定
function getExtension(mimeType: string): string {
	const map: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
		"image/heic": "heic",
		"image/heif": "heif",
	};
	return map[mimeType] ?? "jpg";
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const geminiApiKey = env.GEMINI_API_KEY;

	if (!geminiApiKey) {
		return Response.json(
			{ error: "AI機能が設定されていません" },
			{ status: 500 },
		);
	}

	const formData = await request.formData();
	const imageFile = formData.get("image") as File | null;
	const memberId = (formData.get("memberId") as string) || "anonymous";

	if (!imageFile || imageFile.size === 0) {
		return Response.json(
			{ error: "画像ファイルが必要です" },
			{ status: 400 },
		);
	}

	// 10MB 制限
	if (imageFile.size > 10 * 1024 * 1024) {
		return Response.json(
			{ error: "画像サイズは10MB以下にしてください" },
			{ status: 400 },
		);
	}

	// 画像を ArrayBuffer として読み込み
	const arrayBuffer = await imageFile.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);
	const mimeType = imageFile.type || "image/jpeg";

	// R2 に画像を保存（バケット未作成でも認識処理は続行）
	let photoUrl: string | null = null;
	if (env.BOOK_BUCKET) {
		try {
			const ext = getExtension(mimeType);
			const timestamp = Date.now();
			const photoKey = `book-photos/${memberId}/${timestamp}.${ext}`;

			await env.BOOK_BUCKET.put(photoKey, bytes, {
				httpMetadata: {
					contentType: mimeType,
					cacheControl: "public, max-age=31536000, immutable",
				},
			});

			photoUrl = `/book-photo/${photoKey}`;
		} catch (e) {
			console.error("R2 save failed (continuing with recognition):", e);
		}
	}

	// base64 に変換（Gemini Vision 用）
	// チャンクごとにバイナリ文字列を構築してから一括で btoa する
	// （チャンクごとに btoa するとパディングが混入して不正な base64 になる）
	let binaryString = "";
	const chunkSize = 8192;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binaryString += String.fromCharCode(...chunk);
	}
	const base64 = btoa(binaryString);

	// Gemini Vision で書籍を認識
	const ai = new GoogleGenAI({ apiKey: geminiApiKey });

	const prompt = `この写真に写っている本のタイトルと著者名を認識してください。
背表紙、表紙、帯などから読み取れる情報を元に、できるだけ正確に識別してください。

以下のJSON形式で回答してください。余計な説明は不要で、JSONのみを返してください:
[
  {"title": "本のタイトル", "author": "著者名"},
  {"title": "本のタイトル2", "author": "著者名2"}
]

注意:
- 著者名が読み取れない場合は空文字 "" にしてください
- 本が写っていない場合は空配列 [] を返してください
- タイトルは正式名称で返してください（副題があれば含める）`;

	try {
		const response = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: [
				{
					role: "user",
					parts: [
						{
							inlineData: {
								mimeType,
								data: base64,
							},
						},
						{ text: prompt },
					],
				},
			],
		});

		let responseText = "";
		try {
			responseText = response.text ?? "";
		} catch {
			const parts = response.candidates?.[0]?.content?.parts;
			if (parts) {
				responseText = parts
					.filter(
						(p: { text?: string }) => typeof p.text === "string",
					)
					.map((p: { text?: string }) => p.text)
					.join("");
			}
		}

		if (!responseText) {
			return Response.json(
				{ error: "画像から書籍を認識できませんでした" },
				{ status: 422 },
			);
		}

		// JSON 部分を抽出（マークダウンのコードブロックを除去）
		let jsonText = responseText.trim();
		const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			jsonText = jsonMatch[0];
		}

		let recognizedBooks: RecognizedBook[];
		try {
			recognizedBooks = JSON.parse(jsonText) as RecognizedBook[];
		} catch {
			return Response.json(
				{ error: "認識結果の解析に失敗しました", raw: responseText },
				{ status: 422 },
			);
		}

		if (!Array.isArray(recognizedBooks) || recognizedBooks.length === 0) {
			return Response.json({ books: [], message: "本が認識されませんでした", photoUrl });
		}

		// Google Books API で各書籍の情報を補完
		const enrichedBooks: (BookSearchResult & { recognized: RecognizedBook })[] = [];

		for (const book of recognizedBooks) {
			if (!book.title) continue;

			const query = book.author
				? `${book.title} ${book.author}`
				: book.title;
			const googleResult = await searchGoogleBooks(query, env);

			if (googleResult) {
				enrichedBooks.push({
					...googleResult,
					recognized: book,
				});
			} else {
				// Google Books で見つからない場合は認識結果のみ
				enrichedBooks.push({
					title: book.title,
					author: book.author || "",
					isbn: null,
					publishedYear: null,
					publisher: null,
					coverImageUrl: null,
					pageCount: null,
					description: null,
					recognized: book,
				});
			}
		}

		return Response.json({ books: enrichedBooks, photoUrl });
	} catch (e) {
		console.error("Book recognition error:", e);
		return Response.json(
			{ error: "書籍の認識中にエラーが発生しました" },
			{ status: 500 },
		);
	}
}
