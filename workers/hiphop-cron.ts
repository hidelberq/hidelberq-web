import { GoogleGenAI } from "@google/genai";
import { drizzle } from "drizzle-orm/d1";
import { hiphopTracks } from "../app/db/schema";
import { eq } from "drizzle-orm";

/**
 * 日本時間で「昨日」の日付を YYYY-MM-DD で返す
 */
function getYesterdayJST(): string {
	const now = new Date();
	const jstMs = now.getTime() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000;
	const yesterday = new Date(jstMs);
	const y = yesterday.getUTCFullYear();
	const m = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
	const d = String(yesterday.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * 日本時間で「今日」の日付を YYYY-MM-DD で返す
 */
function getTodayJST(): string {
	const now = new Date();
	const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
	const today = new Date(jstMs);
	const y = today.getUTCFullYear();
	const m = String(today.getUTCMonth() + 1).padStart(2, "0");
	const d = String(today.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

// --- Workflowy API (hero-image.ts と同じパターン) ---

interface WorkflowyNode {
	id: string;
	name: string;
	note: string | null;
	parent_id: string | null;
	priority: number;
	completed: boolean;
	data: { layoutMode: string };
	createdAt: number;
	modifiedAt: number;
	completedAt: number | null;
}

async function fetchWorkflowyNodes(
	apiKey: string,
	parentId: string,
): Promise<WorkflowyNode[]> {
	const url = `https://workflowy.com/api/v1/nodes?parent_id=${parentId}`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!res.ok) {
		throw new Error(`Workflowy API error: ${res.status} ${res.statusText}`);
	}
	const data: unknown = await res.json();
	if (
		data &&
		typeof data === "object" &&
		"nodes" in data &&
		Array.isArray((data as { nodes: unknown }).nodes)
	) {
		return (data as { nodes: WorkflowyNode[] }).nodes;
	}
	if (Array.isArray(data)) {
		return data as WorkflowyNode[];
	}
	return [];
}

function extractDateFromNode(name: string): string | null {
	const match = name.match(
		/<time\s+startYear="(\d+)"\s+startMonth="(\d+)"\s+startDay="(\d+)"/,
	);
	if (!match) return null;
	const y = match[1];
	const m = match[2].padStart(2, "0");
	const d = match[3].padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function collectNodeText(node: WorkflowyNode): string {
	const lines: string[] = [];
	const cleanName = node.name.replace(/<[^>]+>/g, "").trim();
	if (cleanName) lines.push(cleanName);
	if (node.note) {
		const cleanNote = node.note.replace(/<[^>]+>/g, "").trim();
		if (cleanNote) lines.push(cleanNote);
	}
	return lines.join("\n");
}

function isHidelberqMention(name: string): boolean {
	return name.includes('<mention id="3775965"');
}

async function fetchDiary(
	apiKey: string,
	targetDate: string,
): Promise<string | null> {
	const parentId = "a2053d82-7f8a-3b7c-92fc-b51321b4c275";
	try {
		const dateNodes = await fetchWorkflowyNodes(apiKey, parentId);
		let targetNode: WorkflowyNode | null = null;
		for (const node of dateNodes) {
			const nodeDate = extractDateFromNode(node.name);
			if (nodeDate === targetDate) {
				targetNode = node;
				break;
			}
		}
		if (!targetNode) return null;

		const mentionNodes = await fetchWorkflowyNodes(apiKey, targetNode.id);
		if (mentionNodes.length === 0) return null;

		let hidelberqNode: WorkflowyNode | null = null;
		for (const node of mentionNodes) {
			if (isHidelberqMention(node.name)) {
				hidelberqNode = node;
				break;
			}
		}
		if (!hidelberqNode) return null;

		const diaryEntries = await fetchWorkflowyNodes(
			apiKey,
			hidelberqNode.id,
		);
		if (diaryEntries.length === 0) return null;

		const diaryText = diaryEntries
			.map((child) => collectNodeText(child))
			.join("\n");
		return diaryText.trim().length > 0 ? diaryText.trim() : null;
	} catch (e) {
		console.error("Failed to fetch diary from Workflowy:", e);
		return null;
	}
}

// --- 天気フォールバック ---

async function fetchYesterdayWeather(
	ai: GoogleGenAI,
	targetDate: string,
): Promise<string> {
	const dateStr = targetDate.replace(/-/g, "/");
	const prompt = `${dateStr} の日本（東京）の天気はどうでしたか？天気、気温、特徴的な気象現象があれば教えてください。簡潔に3行程度で回答してください。`;

	const response = await ai.models.generateContent({
		model: "gemini-2.5-flash",
		contents: prompt,
		config: {
			tools: [{ googleSearch: {} }],
		},
	});

	let text = "";
	try {
		text = response.text ?? "";
	} catch {
		const parts = response.candidates?.[0]?.content?.parts;
		if (parts) {
			text = parts
				.filter((p: { text?: string }) => typeof p.text === "string")
				.map((p: { text?: string }) => p.text)
				.join("");
		}
	}
	return text || "晴れの穏やかな一日でした。";
}

// --- Suno API (sunoapi.org) ---

interface SunoGenerateResponse {
	code: number;
	msg: string;
	data: {
		taskId: string;
	};
}

interface SunoTrackData {
	id: string;
	audioUrl: string;
	streamAudioUrl: string;
	imageUrl: string;
	prompt: string;
	modelName: string;
	title: string;
	tags: string;
	createTime: string;
	duration: number;
}

interface SunoRecordInfoResponse {
	code: number;
	msg: string;
	data: {
		taskId: string;
		status: string;
		response: {
			sunoData: SunoTrackData[];
		};
	};
}

/**
 * Suno API でインストゥルメンタルトラックを生成
 */
async function generateSunoTrack(
	apiKey: string,
	style: string,
	title: string,
): Promise<string> {
	const response = await fetch(
		"https://api.sunoapi.org/api/v1/generate",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				customMode: true,
				instrumental: true,
				style,
				title,
				model: "V4",
				callBackUrl: "https://hidelberq.com/api/suno-callback",
			}),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Suno API generate error: ${response.status} ${text}`);
	}

	const result = (await response.json()) as SunoGenerateResponse;
	if (result.code !== 200) {
		throw new Error(`Suno API error: ${result.msg}`);
	}
	return result.data.taskId;
}

/**
 * Suno API のタスクステータスをポーリング
 */
async function pollSunoTask(
	apiKey: string,
	taskId: string,
	maxWaitMs = 300000, // 最大5分
): Promise<SunoTrackData> {
	const startTime = Date.now();
	const pollInterval = 10000; // 10秒間隔

	while (Date.now() - startTime < maxWaitMs) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval));

		const response = await fetch(
			`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			},
		);

		if (!response.ok) {
			console.log(`Polling response not ok: ${response.status}, retrying...`);
			continue;
		}

		const result = (await response.json()) as SunoRecordInfoResponse;

		if (result.data.status === "SUCCESS") {
			const tracks = result.data.response.sunoData;
			if (tracks && tracks.length > 0) {
				return tracks[0]; // 最初のトラックを使用
			}
			throw new Error("Suno API returned SUCCESS but no track data");
		}

		if (
			result.data.status === "FAILED" ||
			result.data.status === "ERROR"
		) {
			throw new Error(
				`Suno API task failed: ${result.msg}`,
			);
		}

		console.log(`Suno task ${taskId} status: ${result.data.status}, waiting...`);
	}

	throw new Error(`Suno API task ${taskId} timed out after ${maxWaitMs}ms`);
}

/**
 * URLから音声ファイルをダウンロード
 */
async function downloadAudio(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download audio: ${response.status}`);
	}
	return response.arrayBuffer();
}

// --- Gemini プロンプト生成 ---

/**
 * 日記/天気内容からHiphopトラックのスタイルとタイトルを生成
 */
async function buildTrackPrompt(
	ai: GoogleGenAI,
	content: string,
	dateStr: string,
	source: "diary" | "weather",
): Promise<{ style: string; title: string; prompt: string }> {
	const context =
		source === "diary"
			? `以下は ${dateStr} の日記です:\n${content}`
			: `以下は ${dateStr} の天気情報です:\n${content}`;

	const generationPrompt = `${context}

上記の内容を元に、Hiphopインストゥルメンタルトラックの情報を生成してください。

要件:
- 日記/天気の内容の気分やテーマを反映したHiphopビートのスタイルを考える
- スタイルは英語で、Suno AI の音楽生成に適した形式にする
- タイトルは日本語で、日記の内容を反映した短いもの（10文字以内）
- JSON形式のみを出力（説明不要）

出力例:
{"style": "lo-fi hip-hop, chill trap, jazzy beats, 85bpm", "title": "雨の帰り道"}`;

	const response = await ai.models.generateContent({
		model: "gemini-2.5-flash",
		contents: generationPrompt,
	});

	let text = "";
	try {
		text = response.text ?? "";
	} catch {
		const parts = response.candidates?.[0]?.content?.parts;
		if (parts) {
			text = parts
				.filter((p: { text?: string }) => typeof p.text === "string")
				.map((p: { text?: string }) => p.text)
				.join("");
		}
	}

	try {
		// JSON部分を抽出
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as {
				style: string;
				title: string;
			};
			return {
				style: parsed.style,
				title: parsed.title,
				prompt: text.trim(),
			};
		}
	} catch (e) {
		console.error("Failed to parse Gemini response as JSON:", e);
	}

	// フォールバック
	return {
		style: "hip-hop, boom bap, jazzy, chill vibes, 90bpm",
		title: `${dateStr} のビート`,
		prompt: text.trim() || "default hip-hop beat",
	};
}

// --- メイン ---

export async function generateHiphopTrack(
	env: Env,
): Promise<string | null> {
	const sunoApiKey = env.SUNO_API_KEY;
	if (!sunoApiKey) {
		console.log("SUNO_API_KEY is not set, skipping hiphop track generation");
		return null;
	}

	const geminiApiKey = env.GEMINI_API_KEY;
	if (!geminiApiKey) {
		console.log(
			"GEMINI_API_KEY is not set, skipping hiphop track generation",
		);
		return null;
	}

	const ai = new GoogleGenAI({ apiKey: geminiApiKey });
	const db = drizzle(env.DB);
	const yesterdayDate = getYesterdayJST();
	const todayDate = getTodayJST();

	console.log(
		`Generating hiphop track for today ${todayDate} based on yesterday ${yesterdayDate}`,
	);

	// 1. Workflowy から昨日の日記を取得
	let diaryContent: string | null = null;
	let source: "diary" | "weather" = "diary";

	const workflowyApiKey = env.WORKFLOWY_API_KEY;
	if (workflowyApiKey) {
		diaryContent = await fetchDiary(workflowyApiKey, yesterdayDate);
	}

	// 2. 日記がなければ天気にフォールバック
	let contentForPrompt: string;
	if (diaryContent) {
		contentForPrompt = diaryContent;
		source = "diary";
		console.log("Using diary content for hiphop track");
	} else {
		contentForPrompt = await fetchYesterdayWeather(ai, yesterdayDate);
		source = "weather";
		console.log("Using weather fallback for hiphop track");
	}

	// 3. Gemini でスタイル・タイトルを生成
	const { style, title, prompt } = await buildTrackPrompt(
		ai,
		contentForPrompt,
		todayDate,
		source,
	);
	console.log(`Track style: ${style}, title: ${title}`);

	// 4. Suno API でトラック生成
	const taskId = await generateSunoTrack(sunoApiKey, style, title);
	console.log(`Suno task created: ${taskId}`);

	// 5. ポーリングで完了を待つ
	const track = await pollSunoTask(sunoApiKey, taskId);
	console.log(
		`Track generated: ${track.title} (${track.duration}s) - ${track.audioUrl}`,
	);

	// 6. 音声ファイルをダウンロードしてR2に保存
	const audioData = await downloadAudio(track.audioUrl);
	const instrumentalKey = `hiphop/${todayDate}/instrumental.mp3`;

	await env.MUSIC_BUCKET.put(instrumentalKey, audioData, {
		httpMetadata: {
			contentType: "audio/mpeg",
			cacheControl: "public, max-age=86400",
		},
	});
	console.log(`Saved to R2: ${instrumentalKey}`);

	// 7. DB に記録（既存レコードがあれば上書き）
	const existing = await db
		.select()
		.from(hiphopTracks)
		.where(eq(hiphopTracks.date, todayDate))
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(hiphopTracks)
			.set({
				instrumentalKey,
				instrumentalUrl: track.audioUrl,
				title: track.title,
				prompt,
				style,
				duration: Math.round(track.duration),
				diaryContent: diaryContent ?? null,
				source,
				sunoTaskId: taskId,
			})
			.where(eq(hiphopTracks.date, todayDate));
	} else {
		await db.insert(hiphopTracks).values({
			date: todayDate,
			instrumentalKey,
			instrumentalUrl: track.audioUrl,
			title: track.title,
			prompt,
			style,
			duration: Math.round(track.duration),
			diaryContent: diaryContent ?? null,
			source,
			sunoTaskId: taskId,
		});
	}

	console.log(`Hiphop track generation completed for ${todayDate}`);
	const sourceLabel = source === "diary" ? "日記" : "天気";
	return `Hiphopトラックを生成 (${sourceLabel}ベース: ${todayDate}) - ${track.title}`;
}
