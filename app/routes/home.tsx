import type {Route} from "./+types/home";
import {Form, useNavigation, useSubmit} from "react-router";
import {drizzle} from "drizzle-orm/d1";
import {memos} from "../db/schema";
import {desc, eq} from "drizzle-orm";
import {useState} from "react";

// ▼ データの取得 (READ)
export async function loader({context}: Route.LoaderArgs) {
    const db = drizzle(context.cloudflare.env.DB);
    const result = await db.select()
        .from(memos)
        .orderBy(desc(memos.createdAt))
        .all();
    return {memos: result};
}

// ▼ データの操作 (CREATE / UPDATE / DELETE)
export async function action({request, context}: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const db = drizzle(context.cloudflare.env.DB);

    // 1. 作成 (Create)
    if (intent === "create") {
        const content = formData.get("content") as string;
        if (content) {
            await db.insert(memos).values({content}).execute();
        }
    }

    // 2. 更新 (Update)
    if (intent === "update") {
        const id = Number(formData.get("id"));
        const content = formData.get("content") as string;
        if (content) {
            await db.update(memos)
                .set({content})
                .where(eq(memos.id, id))
                .execute();
        }
    }

    // 3. 削除 (Delete)
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

    // 編集中のメモIDを管理するState
    const [editingId, setEditingId] = useState<number | null>(null);

    // 新規作成フォームの送信処理 (Ctrl+Enter対応)
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
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="absolute right-0 top-0 opacity-0 group-focus-within:opacity-100 transition-opacity text-blue-500 font-bold px-2 py-1"
                        >
                            Add
                        </button>
                    </Form>
                </div>

                {/* メモ一覧 */}
                <div className="space-y-1">
                    {loaderData.memos.map((memo) => (
                        <div key={memo.id}
                             className="group flex items-start gap-2 py-1 -ml-2 px-2 rounded hover:bg-gray-50 transition-colors">
                            <span
                                className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 select-none mt-1">•</span>

                            <div className="flex-grow min-w-0">
                                {editingId === memo.id ? (
                                    // ▼ 編集モード (Edit Mode)
                                    <Form
                                        method="post"
                                        onSubmit={() => setEditingId(null)} // 送信したら編集終了
                                        className="w-full"
                                    >
                                        <input type="hidden" name="intent" value="update"/>
                                        <input type="hidden" name="id" value={memo.id}/>
                                        <textarea
                                            name="content"
                                            defaultValue={memo.content}
                                            autoFocus
                                            className="w-full bg-white border border-blue-200 rounded p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm resize-none"
                                            rows={Math.max(1, memo.content.split('\n').length)}
                                            onKeyDown={(e) => {
                                                // Ctrl+Enterで保存
                                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                    e.preventDefault();
                                                    submit(e.currentTarget.form);
                                                    setEditingId(null);
                                                }
                                                // Escapeでキャンセル
                                                if (e.key === 'Escape') {
                                                    setEditingId(null);
                                                }
                                            }}
                                        />
                                        <div className="flex gap-2 justify-end mt-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditingId(null)}
                                                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </Form>
                                ) : (
                                    // ▼ 表示モード (View Mode)
                                    <div
                                        onClick={() => setEditingId(memo.id)} // クリックで編集モードへ
                                        className="cursor-pointer whitespace-pre-wrap text-gray-700 leading-relaxed border border-transparent hover:border-gray-200 rounded px-1 -mx-1"
                                    >
                                        {memo.content}
                                    </div>
                                )}
                            </div>

                            {/* 削除ボタン (ホバー時、かつ編集していない時のみ表示) */}
                            {editingId !== memo.id && (
                                <Form method="post"
                                      onSubmit={(e) => !confirm('Delete this note?') && e.preventDefault()}
                                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                                    <input type="hidden" name="intent" value="delete"/>
                                    <input type="hidden" name="id" value={memo.id}/>
                                    <button
                                        type="submit"
                                        className="text-gray-300 hover:text-red-400 p-1 rounded hover:bg-red-50"
                                        title="Delete"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
                                             viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </Form>
                            )}
                        </div>
                    ))}

                    {loaderData.memos.length === 0 && (
                        <p className="text-gray-300 italic pl-6 pt-4 text-sm">No notes found. Start typing above!</p>
                    )}
                </div>

            </div>
        </div>
    );
}