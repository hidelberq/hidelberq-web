import type { Route } from "./+types/api.books-search";
import type { BookSearchResult } from "~/books/types";

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

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const query = url.searchParams.get("q");

	if (!query || query.trim().length === 0) {
		return Response.json({ results: [] });
	}

	const googleBooksUrl = new URL(
		"https://www.googleapis.com/books/v1/volumes",
	);
	googleBooksUrl.searchParams.set("q", query);
	googleBooksUrl.searchParams.set("maxResults", "10");
	googleBooksUrl.searchParams.set("langRestrict", "ja");
	googleBooksUrl.searchParams.set("printType", "books");

	const response = await fetch(googleBooksUrl.toString());

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

	return Response.json({ results });
}
