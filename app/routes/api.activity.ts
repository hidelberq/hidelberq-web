import { drizzle } from "drizzle-orm/d1";
import { activityLog } from "../db/schema";
import type { Route } from "./+types/api.activity";

export async function action({ request, context }: Route.ActionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const apiKey = context.cloudflare.env.ACTIVITY_API_KEY;
	if (!apiKey) {
		return new Response("API key not configured", { status: 500 });
	}

	const auth = request.headers.get("Authorization");
	if (auth !== `Bearer ${apiKey}`) {
		return new Response("Unauthorized", { status: 401 });
	}

	const body = (await request.json()) as {
		type?: string;
		message?: string;
		metadata?: string;
	};

	if (!body.type || !body.message) {
		return new Response("Bad Request: type and message are required", {
			status: 400,
		});
	}

	const db = drizzle(context.cloudflare.env.DB);
	await db.insert(activityLog).values({
		type: body.type,
		message: body.message,
		metadata: body.metadata ?? null,
	});

	return Response.json({ ok: true });
}
