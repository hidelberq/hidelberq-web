import type { Route } from "./+types/hero-image";

export async function loader({ params, context }: Route.LoaderArgs) {
	const date = params.date;

	// YYYY-MM-DD フォーマットの簡易バリデーション
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return new Response("Invalid date format", { status: 400 });
	}

	const key = `hero/${date}.png`;
	const object = await context.cloudflare.env.HERO_BUCKET.get(key);

	if (!object) {
		return new Response("Image not found", { status: 404 });
	}

	return new Response(object.body, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=86400",
			ETag: object.httpEtag,
		},
	});
}
