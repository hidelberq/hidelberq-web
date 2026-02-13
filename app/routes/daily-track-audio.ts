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

	// mp3を優先し、なければm4aを探す
	const mp3Key = `hiphop/${date}/${type}.mp3`;
	const m4aKey = `hiphop/${date}/${type}.m4a`;

	let object = await context.cloudflare.env.MUSIC_BUCKET.get(mp3Key);
	let ext = "mp3";
	let contentType = "audio/mpeg";

	if (!object) {
		object = await context.cloudflare.env.MUSIC_BUCKET.get(m4aKey);
		ext = "m4a";
		contentType = "audio/mp4";
	}

	if (!object) {
		return new Response("Track not found", { status: 404 });
	}

	const url = new URL(request.url);
	const isDownload = url.searchParams.get("download") === "1";

	const headers: Record<string, string> = {
		"Content-Type": contentType,
		"Cache-Control": "public, max-age=86400",
		ETag: object.httpEtag,
	};

	if (isDownload) {
		const downloadFilename = `${date}-${type}.${ext}`;
		headers["Content-Disposition"] =
			`attachment; filename="${downloadFilename}"`;
	}

	return new Response(object.body, { headers });
}
