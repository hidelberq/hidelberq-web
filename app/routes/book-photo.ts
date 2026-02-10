import type { Route } from "./+types/book-photo";

export async function loader({ params, context }: Route.LoaderArgs) {
	const key = params["*"];

	if (!key) {
		return new Response("Not found", { status: 404 });
	}

	const object = await context.cloudflare.env.BOOK_BUCKET.get(key);

	if (!object) {
		return new Response("Image not found", { status: 404 });
	}

	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
			"Cache-Control": "public, max-age=31536000, immutable",
			ETag: object.httpEtag,
		},
	});
}
