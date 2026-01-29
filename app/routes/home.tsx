import type {Route} from "./+types/home";
import {Form, useNavigation, useSubmit} from "react-router";
import {drizzle} from "drizzle-orm/d1";
import {memos} from "../db/schema";
import {desc, eq} from "drizzle-orm";
import {useState} from "react";
import {getRandomQuote} from "../data/quotes";
import {GoogleGenerativeAI} from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ▼ 引数に userInput (ユーザーの直近のメモ) を追加
async function fetchGeminiQuote(apiKey: string, pastQuotes: string[], userInput: string): Promise<string | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

        const pastExamples = pastQuotes.length > 0
            ? `\n【避けるべき過去の生成例】:\n${pastQuotes.join("\n")}`
            : "";

        // ▼ プロンプトを「対話型・思考深化型」に変更
        const prompt = `
あなたは35歳のWebエンジニアの良き理解者であり、メンタルヘルスの専門医です。
彼は仕事での人間関係やプレッシャーに疲れていますが、社会学的・哲学的・心理学的な「本質的な議論」を好みます。

【ユーザーが直近で書いたメモ】
「${userInput}」

【指示】
上記のユーザーのメモ（思考）に対し、応答してください。
単に共感するだけでなく、その思考を**「発展」「探求」**させてください。
心理学の知見、社会学的な構造理解、あるいは哲学的な視座を用い、
新しい視点や、ハッとするような気づきを与えてください。

${pastExamples}

条件:
- **ユーザーのメモの内容を踏まえた内容にすること（必須）**
- メモが単なるタスク等の場合は、そこから実存的な意味を見出すか、あるいは労りの言葉をかける
- 200文字以内の日本語
- 冒頭に 💡 をつける
- 安っぽい励まし（「頑張れ」）は禁止。理性的かつ受容的に。
- すぐ実行できる小さなアクションか、問いかけを含める
    `.trim();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text() || null;

    } catch (e) {
        console.error("Gemini SDK Error:", e);
        return null;
    }
}

// ▼ loader関数
export async function loader({context}: Route.LoaderArgs) {
    const db = drizzle(context.cloudflare.env.DB);
    const apiKey = context.cloudflare.env.GEMINI_API_KEY;

    const recentMemos = await db.select()
        .from(memos)
        .orderBy(desc(memos.createdAt))
        .limit(30)
        .all();

    const latestMemo = recentMemos[0];

    // 1. 生成判定: 「最新が名言でない」(=ユーザーが書いたメモである) 場合のみ実行
    if (!latestMemo || !latestMemo.content.startsWith("💡")) {
        let quoteContent: string | null = null;

        const pastQuotes = recentMemos
            .filter(m => m.content.startsWith("💡"))
            .map(m => m.content)
            .slice(0, 5);

        // ユーザーのメモ内容を取得 (空の場合はデフォルト文言)
        const userContent = latestMemo ? latestMemo.content : "仕事で疲れています...";

        if (apiKey) {
            console.log("Deepening thought with Gemini...");
            // ▼ ここで userContent を渡す
            quoteContent = await fetchGeminiQuote(apiKey, pastQuotes, userContent);
        }

        if (!quoteContent) {
            console.log("Fallback to local quotes.");
            quoteContent = getRandomQuote();
        }

        if (quoteContent) {
            await db.insert(memos).values({content: quoteContent.trim()}).execute();
        }
    }

    // 表示用データ取得
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

// ▼ UIコンポーネント
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

                {/* 新規作成エリア (変更なし) */}
                <div className="mb-8">
                    <Form method="post" className="relative flex items-start gap-2 group">
                        <span className="text-gray-300 text-xl mt-1 select-none">•</span>
                        <input type="hidden" name="intent" value="create"/>
                        <textarea
                            name="content"
                            placeholder="Click here to add a note (Markdown supported)..."
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
                                        // ▼ 編集モード (Rawテキストを表示・編集)
                                        <Form method="post" onSubmit={() => setEditingId(null)} className="w-full">
                                            <input type="hidden" name="intent" value="update"/>
                                            <input type="hidden" name="id" value={memo.id}/>
                                            <textarea
                                                name="content"
                                                defaultValue={memo.content}
                                                autoFocus
                                                className="w-full bg-white border border-blue-200 rounded p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm resize-none font-mono text-sm" // 編集時は等幅フォントの方が見やすいかも
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
                                        // ▼ 表示モード (Markdownレンダリング)
                                        <div
                                            onClick={() => setEditingId(memo.id)}
                                            className={`cursor-pointer border border-transparent hover:border-gray-200 rounded px-1 -mx-1 
                        prose prose-sm prose-slate max-w-none 
                        prose-p:my-0 prose-headings:my-1 prose-ul:my-0 prose-li:my-0 
                        ${isQuote ? "text-gray-500 italic" : "text-gray-700"}`}
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    // リンクを別タブで開くように上書き
                                                    a: ({node, ...props}) => <a {...props} target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-blue-500 hover:underline"/>
                                                }}
                                            >
                                                {memo.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>

                                {/* 削除ボタン (変更なし) */}
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