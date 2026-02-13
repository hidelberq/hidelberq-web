import type { Route } from "./+types/daily-track-audio";

/**
 * 日替わりHiphopトラックの音声ファイルを配信するloader
 * /daily-track/audio/:date/:type (type: "instrumental" | "rap")
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
	const { date, type } = params;

	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return new Response("Invalid date format", { status: 400 });
	}

	if (type !== "instrumental" && type !== "rap") {
		return new Response("Invalid type. Use 'instrumental' or 'rap'", {
			status: 400,
		});
	}

	const filename = type === "instrumental" ? "instrumental.mp3" : "rap.mp3";
	const key = `hiphop/${date}/${filename}`;
	const object = await context.cloudflare.env.MUSIC_BUCKET.get(key);

	if (!object) {
		return new Response("Track not found", { status: 404 });
	}

	const url = new URL(request.url);
	const isDownload = url.searchParams.get("download") === "1";

	const headers: Record<string, string> = {
		"Content-Type": "audio/mpeg",
		"Cache-Control": "public, max-age=86400",
		ETag: object.httpEtag,
	};

	if (isDownload) {
		const downloadFilename = `${date}-${type}.mp3`;
		headers["Content-Disposition"] =
			`attachment; filename="${downloadFilename}"`;
	}

	return new Response(object.body, { headers });
}
