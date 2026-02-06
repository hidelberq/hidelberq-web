import {GoogleGenAI} from "@google/genai";
import {drizzle} from "drizzle-orm/d1";
import {heroImages} from "../app/db/schema";
import {eq} from "drizzle-orm";

/**
 * 日本時間で「昨日」の日付を YYYY-MM-DD で返す
 */
function getYesterdayJST(): string {
    const now = new Date();
    // UTC → JST (+9h) → 昨日 (-1d)
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

/**
 * YYYY-MM-DD → YYYY/MM/DD
 */
function formatDateSlash(date: string): string {
    return date.replace(/-/g, "/");
}

// --- Workflowy API ---

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

/**
 * Workflowy API からノード一覧を取得
 */
async function fetchWorkflowyNodes(
    apiKey: string,
    parentId: string,
): Promise<WorkflowyNode[]> {
    const url = `https://workflowy.com/api/v1/nodes?parent_id=${parentId}`;
    const res = await fetch(url, {
        headers: {Authorization: `Bearer ${apiKey}`},
    });
    if (!res.ok) {
        throw new Error(`Workflowy API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    console.log("fetchWorkflowyNodes response data:", data);

    // レスポンスは { nodes: [...] } 形式
    if (data && typeof data === "object" && Array.isArray(data.nodes)) {
        return data.nodes as WorkflowyNode[];
    }
    if (Array.isArray(data)) {
        return data as WorkflowyNode[];
    }
    console.error("Unexpected Workflowy API response format:", JSON.stringify(data).slice(0, 500));
    return [];
}

/**
 * ノードのテキストから <time> タグの日付文字列を抽出する
 * 例: '<time startYear="2026" startMonth="2" startDay="5">Thu, Feb 5, 2026</time>'
 *   → "2026-02-05"
 */
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

/**
 * ノード一覧からテキストを再帰的に組み立てる
 */
function collectNodeText(node: WorkflowyNode, depth = 0): string {
    const lines: string[] = [];
    // HTMLタグを除去してテキストだけ取得
    const cleanName = node.name.replace(/<[^>]+>/g, "").trim();
    if (cleanName) {
        const indent = "  ".repeat(depth);
        lines.push(`${indent}${cleanName}`);
    }
    if (node.note) {
        const cleanNote = node.note.replace(/<[^>]+>/g, "").trim();
        if (cleanNote) {
            const indent = "  ".repeat(depth + 1);
            lines.push(`${indent}${cleanNote}`);
        }
    }
    return lines.join("\n");
}

/**
 * <mention> タグから hidelberq (id=3775965) のノードかどうか判定
 */
function isHidelberqMention(name: string): boolean {
    return name.includes('<mention id="3775965"');
}

/**
 * 昨日の日記を Workflowy から取得
 *
 * Workflowy の構造:
 * - 📕 日記 (NodeID=a2053d82...)
 *     - <time ...>日付</time>          ← 日付ノード (階層1)
 *         - <mention id="3775965">     ← hidelberq の mention ノード (階層2)
 *             - 〇〇があった            ← 日記の中身 (階層3)
 *             - XXがあった
 *
 * 手順:
 * 1. 日記ルートの子ノード一覧（日付ノード）を取得
 * 2. 昨日の日付のノードを見つける
 * 3. 日付ノードの子ノード（mention ノード）を取得
 * 4. hidelberq の mention ノードを見つける
 * 5. mention ノードの子ノード（日記の中身）を取得
 */
async function fetchDiary(
    apiKey: string,
    targetDate: string,
): Promise<string | null> {
    const parentId = "a2053d82-7f8a-3b7c-92fc-b51321b4c275";

    try {
        // 階層1: 日付ノード一覧を取得
        const dateNodes = await fetchWorkflowyNodes(apiKey, parentId);

        // 昨日の日付のノードを探す
        let targetNode: WorkflowyNode | null = null;
        for (const node of dateNodes) {
            const nodeDate = extractDateFromNode(node.name);
            if (nodeDate === targetDate) {
                targetNode = node;
                break;
            }
        }

        if (!targetNode) {
            console.log(`No diary entry found for ${targetDate}`);
            return null;
        }

        console.log(`Found diary node for ${targetDate}: ${targetNode.id}`);

        // 階層2: 日付ノードの子ノード（mention ノード）を取得
        const mentionNodes = await fetchWorkflowyNodes(apiKey, targetNode.id);

        if (mentionNodes.length === 0) {
            console.log(`Diary node for ${targetDate} has no children`);
            return null;
        }

        // hidelberq の mention ノードを探す
        let hidelberqNode: WorkflowyNode | null = null;
        for (const node of mentionNodes) {
            if (isHidelberqMention(node.name)) {
                hidelberqNode = node;
                break;
            }
        }

        if (!hidelberqNode) {
            console.log(`No hidelberq mention found for ${targetDate}`);
            return null;
        }

        console.log(`Found hidelberq mention node: ${hidelberqNode.id}`);

        // 階層3: mention ノードの子ノード（日記の中身）を取得
        const diaryEntries = await fetchWorkflowyNodes(apiKey, hidelberqNode.id);

        if (diaryEntries.length === 0) {
            console.log(`hidelberq mention for ${targetDate} has no diary entries`);
            return null;
        }

        const diaryText = diaryEntries
            .map((child) => collectNodeText(child))
            .join("\n");

        if (diaryText.trim().length > 0) {
            console.log(`Diary content for ${targetDate} (${diaryText.length} chars)`);
            return diaryText.trim();
        }

        return null;
    } catch (e) {
        console.error("Failed to fetch diary from Workflowy:", e);
        return null;
    }
}

// --- Weather fallback ---

/**
 * Gemini + Google Search で昨日の日本の天気を取得
 */
async function fetchYesterdayWeather(
    ai: GoogleGenAI,
    targetDate: string,
): Promise<string> {
    const dateStr = formatDateSlash(targetDate);
    const prompt = `${dateStr} の日本（東京）の天気はどうでしたか？天気、気温、特徴的な気象現象があれば教えてください。簡潔に3行程度で回答してください。`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
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

// --- Image generation ---

/**
 * 日記/天気内容を英語の画像生成プロンプトに変換
 */
async function buildImagePrompt(
    ai: GoogleGenAI,
    content: string,
    dateStr: string,
    source: "diary" | "weather",
): Promise<string> {
    const context =
        source === "diary"
            ? `以下は ${dateStr} の日記です:\n${content}`
            : `以下は ${dateStr} の天気情報です:\n${content}`;

    const translationPrompt = `${context}

上記の内容を元に、かわいくてポップなイラストの画像生成プロンプトを英語で作成してください。
要件:
- イラストのスタイルはかわいく、ポップで、カラフルに
- 日記/天気の内容を反映した具体的なシーンを描写する
- 右下に日付「${formatDateSlash(dateStr)}」と「hidelberq」のテキストを配置する指示を含める
- プロンプトのみを出力し、余計な説明は不要
- 200語以内に収める`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: translationPrompt,
    });

    let prompt = "";
    try {
        prompt = response.text ?? "";
    } catch {
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            prompt = parts
                .filter((p: { text?: string }) => typeof p.text === "string")
                .map((p: { text?: string }) => p.text)
                .join("");
        }
    }

    // フォールバックプロンプト
    if (!prompt.trim()) {
        prompt = `A cute, pop-style illustration of a colorful day. Bright pastel colors, kawaii aesthetic, cheerful atmosphere. Include the text "${formatDateSlash(dateStr)}" and "hidelberq" in the bottom-right corner.`;
    }

    return prompt.trim();
}

/**
 * Imagen 4 で画像を生成し、PNG バイナリを返す
 */
async function generateImage(
    ai: GoogleGenAI,
    prompt: string,
): Promise<Uint8Array> {
    const response = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt,
        config: {
            numberOfImages: 1,
            aspectRatio: "16:9",
        },
    });

    const generatedImages = response.generatedImages;
    if (!generatedImages || generatedImages.length === 0) {
        throw new Error("Imagen 4 did not return any images");
    }

    const imageBytes = generatedImages[0].image?.imageBytes;
    if (!imageBytes) {
        throw new Error("Imagen 4 returned empty image data");
    }

    // base64 → Uint8Array
    const binaryString = atob(imageBytes);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// --- Main ---

export async function generateHeroImage(env: Env): Promise<void> {
    const geminiApiKey = env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const ai = new GoogleGenAI({apiKey: geminiApiKey});
    const db = drizzle(env.DB);
    const yesterdayDate = getYesterdayJST();
    const todayDate = getTodayJST();
    const imageKey = `hero/${todayDate}.png`;

    console.log(
        `Generating hero image for today ${todayDate} based on yesterday ${yesterdayDate}`,
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
        console.log("Using diary content for hero image");
    } else {
        contentForPrompt = await fetchYesterdayWeather(ai, yesterdayDate);
        source = "weather";
        console.log("Using weather fallback for hero image");
    }

    // 3. 画像生成プロンプトを構築
    const imagePrompt = await buildImagePrompt(
        ai,
        contentForPrompt,
        todayDate,
        source,
    );
    console.log("Image prompt:", imagePrompt);

    // 4. Imagen 4 で画像生成
    const imageBytes = await generateImage(ai, imagePrompt);
    console.log(`Generated image: ${imageBytes.length} bytes`);

    // 5. R2 に保存
    await env.HERO_BUCKET.put(imageKey, imageBytes, {
        httpMetadata: {
            contentType: "image/png",
            cacheControl: "public, max-age=86400",
        },
    });
    console.log(`Saved to R2: ${imageKey}`);

    // 6. DB に記録（既存レコードがあれば上書き）
    const existing = await db
        .select()
        .from(heroImages)
        .where(eq(heroImages.date, todayDate))
        .limit(1);

    if (existing.length > 0) {
        await db
            .update(heroImages)
            .set({
                imageKey,
                prompt: imagePrompt,
                source,
                diaryContent: diaryContent ?? null,
            })
            .where(eq(heroImages.date, todayDate));
    } else {
        await db.insert(heroImages).values({
            date: todayDate,
            imageKey,
            prompt: imagePrompt,
            source,
            diaryContent: diaryContent ?? null,
        });
    }

    console.log(`Hero image generation completed for ${todayDate}`);
}

/**
 * 指定プロンプトで画像を再生成する
 * 既存のヒーローイメージのプロンプトを編集して再生成したい場合に使用
 */
export async function regenerateHeroImageWithPrompt(
    env: Env,
    customPrompt: string,
    targetDate: string,
): Promise<void> {
    const geminiApiKey = env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const ai = new GoogleGenAI({apiKey: geminiApiKey});
    const db = drizzle(env.DB);
    const imageKey = `hero/${targetDate}.png`;

    console.log(`Regenerating hero image for ${targetDate} with custom prompt`);

    // Imagen 4 で画像生成
    const imageBytes = await generateImage(ai, customPrompt);
    console.log(`Generated image: ${imageBytes.length} bytes`);

    // R2 に保存（上書き）
    await env.HERO_BUCKET.put(imageKey, imageBytes, {
        httpMetadata: {
            contentType: "image/png",
            cacheControl: "public, max-age=86400",
        },
    });
    console.log(`Saved to R2: ${imageKey}`);

    // DB を更新（既存レコードがあれば上書き、なければ新規）
    const existing = await db
        .select()
        .from(heroImages)
        .where(eq(heroImages.date, targetDate))
        .limit(1);

    if (existing.length > 0) {
        await db
            .update(heroImages)
            .set({
                imageKey,
                prompt: customPrompt,
                source: existing[0].source,
            })
            .where(eq(heroImages.date, targetDate));
    } else {
        await db.insert(heroImages).values({
            date: targetDate,
            imageKey,
            prompt: customPrompt,
            source: "diary",
        });
    }

    console.log(`Hero image regeneration completed for ${targetDate}`);
}
