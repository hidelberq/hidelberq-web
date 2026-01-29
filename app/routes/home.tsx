import type {Route} from "./+types/home";
import {Form, useNavigation, useSubmit} from "react-router";
import {drizzle} from "drizzle-orm/d1";
import {memos} from "../db/schema";
import {desc, eq} from "drizzle-orm";
import {useState} from "react";
import {GoogleGenerativeAI} from "@google/generative-ai";

// ▼ 過去の言葉を考慮してAI生成する関数
async function fetchGeminiQuote(apiKey: string, pastQuotes: string[]): Promise<string | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({model: "gemini-2.5-flash-lite"});

        // 過去の言葉をリスト化してプロンプトに埋め込む
        const pastExamples = pastQuotes.length > 0
            ? `\n【避けるべき過去の生成例（これらと被らないようにしてください）】:\n${pastQuotes.join("\n")}`
            : "";

        const prompt = `
あなたは35歳のWebエンジニアの良き理解者です。
彼は仕事での人間関係やプレッシャーに疲れており、少し心が弱っています。
また、社会学的・哲学的・心理学的な思考や、本質的な議論を好みます。

彼に向けて、心理学の知見や哲学的な視点を交えて、励ましの言葉と、具体的にすぐ実行できるアクションを教えて下さい。

${pastExamples}

条件:
- **上記の「過去の生成例」とは異なる視点、表現、比喩を使うこと（重要）**
- 200文字以内の日本語
- 冒頭に 💡 をつける (例: 💡 言葉...)
- 安っぽい励まし（「頑張れ」など）は避ける
    `.trim();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text || null;

    } catch (e) {
        console.error("Gemini SDK Error:", e);
        return null;
    }
}

// ▼ loader関数
export async function loader({context}: Route.LoaderArgs) {
    const db = drizzle(context.cloudflare.env.DB);
    const apiKey = context.cloudflare.env.GEMINI_API_KEY;

    // 1. 最新のメモを含む、直近のデータを取得 (最大30件)
    // ※ ここから過去の名言を探します
    const recentMemos = await db.select()
        .from(memos)
        .orderBy(desc(memos.createdAt))
        .limit(30)
        .all();

    const latestMemo = recentMemos[0];

    // 2. 生成判定: 「最新が名言でない」場合のみ実行
    // if (!latestMemo || !latestMemo.content.startsWith("💡")) {
    if (true) {
        let quoteContent: string | null = null;

        // 直近の過去の名言を抽出（APIに渡すため）
        const pastQuotes = recentMemos
            .filter(m => m.content.startsWith("💡")) // 名言だけ抽出
            .map(m => m.content)
            .slice(0, 5); // 最新の5件に絞る

        // A. SDKで取得 (過去リストを渡す)
        if (apiKey) {
            console.log("Fetching from Gemini (with past context)...");
            quoteContent = await fetchGeminiQuote(apiKey, pastQuotes);
        }
        //
        // // B. 失敗時はローカル
        // if (!quoteContent) {
        //     console.log("Fallback to local quotes.");
        //     quoteContent = getRandomQuote();
        // }

        // C. DB保存
        if (quoteContent) {
            await db.insert(memos).values({content: quoteContent.trim()}).execute();

            // 保存したデータをリストの先頭に追加して画面に即反映させるために再取得
            // (簡易的にリロードさせるため、ここでは再取得処理はせず、return時に全取得しなおします)
        }
    }

    // 3. 表示用の全リストを取得して返す
    const result = await db.select()
        .from(memos)
        .orderBy(desc(memos.createdAt))
        .all();

    return {memos: result};
}

// ... (以下、action と UIコンポーネントは前回と同じです) ...
export async function action({request, context}: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const db = drizzle(context.cloudflare.env.DB);

    if (intent === "create") {
        const content = formData.get("content") as string;
        if (content) await db.insert(memos).values({content}).execute();
    }
    if (intent === "update") {
        const id = Number(formData.get("id"));
        const content = formData.get("content") as string;
        if (content) await db.update(memos).set({content}).where(eq(memos.id, id)).execute();
    }
    if (intent === "delete") {
        const id = Number(formData.get("id"));
        await db.delete(memos).where(eq(memos.id, id)).execute();
    }
    return {success: true};
}

export default function Home({loaderData}: Route.ComponentProps) {
    const navigation = useNavigation();
    const submit = useSubmit();
    const isSubmitting = navigation.state === "submitting";
    const [editingId, setEditingId] = useState<number | null>(null);

    const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans">
            <div className="max-w-3xl mx-auto py-12 px-6">
                <header className="mb-8 pl-2 border-l-4 border-gray-300">
                    <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
                </header>

                {/* 新規作成エリア */}
                <div className="mb-8">
                    <Form method="post" className="relative flex items-start gap-2 group">
                        <span className="text-gray-300 text-xl mt-1 select-none">•</span>
                        <input type="hidden" name="intent" value="create"/>
                        <textarea
                            name="content"
                            placeholder="Click here to add a note..."
                            onKeyDown={handleCreateKeyDown}
                            className="w-full bg-transparent text-lg text-gray-700 placeholder:text-gray-300 focus:outline-none resize-none overflow-hidden py-1 leading-relaxed border-b border-transparent focus:border-gray-100 transition-colors"
                            rows={1}
                            onInput={(e) => {
                                e.currentTarget.style.height = 'auto';
                                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                            }}
                        />
                        <button type="submit" disabled={isSubmitting}
                                className="absolute right-0 top-0 opacity-0 group-focus-within:opacity-100 transition-opacity text-blue-500 font-bold px-2 py-1">Add
                        </button>
                    </Form>
                </div>

                {/* メモ一覧 */}
                <div className="space-y-1">
                    {loaderData.memos.map((memo) => {
                        const isQuote = memo.content.startsWith("💡");
                        return (
                            <div key={memo.id}
                                 className="group flex items-start gap-2 py-1 -ml-2 px-2 rounded hover:bg-gray-50 transition-colors">
                                <span
                                    className={`flex-shrink-0 mt-1 select-none ${isQuote ? "text-yellow-400" : "text-gray-400 group-hover:text-gray-600"}`}>•</span>
                                <div className="flex-grow min-w-0">
                                    {editingId === memo.id ? (
                                        <Form method="post" onSubmit={() => setEditingId(null)} className="w-full">
                                            <input type="hidden" name="intent" value="update"/>
                                            <input type="hidden" name="id" value={memo.id}/>
                                            <textarea
                                                name="content"
                                                defaultValue={memo.content}
                                                autoFocus
                                                className="w-full bg-white border border-blue-200 rounded p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm resize-none"
                                                rows={Math.max(1, memo.content.split('\n').length)}
                                                onKeyDown={(e) => {
                                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                        e.preventDefault();
                                                        submit(e.currentTarget.form);
                                                        setEditingId(null);
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setEditingId(null);
                                                    }
                                                }}
                                            />
                                            <div className="flex gap-2 justify-end mt-1">
                                                <button type="button" onClick={() => setEditingId(null)}
                                                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel
                                                </button>
                                                <button type="submit"
                                                        className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Save
                                                </button>
                                            </div>
                                        </Form>
                                    ) : (
                                        <div onClick={() => setEditingId(memo.id)}
                                             className={`cursor-pointer whitespace-pre-wrap leading-relaxed border border-transparent hover:border-gray-200 rounded px-1 -mx-1 ${isQuote ? "text-gray-500 italic" : "text-gray-700"}`}>
                                            {memo.content}
                                        </div>
                                    )}
                                </div>
                                {editingId !== memo.id && (
                                    <Form method="post"
                                          onSubmit={(e) => !confirm('Delete this note?') && e.preventDefault()}
                                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                                        <input type="hidden" name="intent" value="delete"/>
                                        <input type="hidden" name="id" value={memo.id}/>
                                        <button type="submit"
                                                className="text-gray-300 hover:text-red-400 p-1 rounded hover:bg-red-50"
                                                title="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                                                 viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M6 18L18 6M6 6l12 12"/>
                                            </svg>
                                        </button>
                                    </Form>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}