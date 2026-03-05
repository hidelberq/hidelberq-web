import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useFetcher } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { theWorkSessions } from "~/db/schema";
import type { Route } from "./+types/the-work";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "ザ・ワーク | hidelberq" },
		{
			name: "description",
			content:
				"バイロン・ケイティの「ザ・ワーク」- ジャッジメント・ワークシートと4つの質問で思い込みを問いかける",
		},
	];
}

// --- loader ---
export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId");
	if (!memberId) {
		return { sessions: [] };
	}
	const db = drizzle(context.cloudflare.env.DB);
	const sessions = await db
		.select()
		.from(theWorkSessions)
		.where(eq(theWorkSessions.memberId, memberId))
		.orderBy(desc(theWorkSessions.updatedAt))
		.limit(50);
	return { sessions };
}

// --- action ---
export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent") as string;
	const db = drizzle(context.cloudflare.env.DB);

	if (intent === "save") {
		const memberId = formData.get("memberId") as string;
		const sessionId = formData.get("sessionId") as string | null;
		const title = formData.get("title") as string;
		const worksheet = formData.get("worksheet") as string;
		const selectedBelief = formData.get("selectedBelief") as string;
		const fourQuestions = formData.get("fourQuestions") as string;
		const turnaround = formData.get("turnaround") as string;
		const beliefWorks = formData.get("beliefWorks") as string;
		const step = formData.get("step") as string;

		const values = {
			title,
			worksheet,
			selectedBelief: selectedBelief || null,
			fourQuestions: fourQuestions || null,
			turnaround: turnaround || null,
			beliefWorks: beliefWorks || null,
			step,
			updatedAt: new Date(),
		};

		if (sessionId) {
			await db
				.update(theWorkSessions)
				.set(values)
				.where(eq(theWorkSessions.id, Number(sessionId)));
			return { success: true, sessionId: Number(sessionId) };
		}
		const result = await db
			.insert(theWorkSessions)
			.values({ memberId, ...values })
			.returning({ id: theWorkSessions.id });
		return { success: true, sessionId: result[0].id };
	}

	if (intent === "ai-review") {
		const belief = formData.get("belief") as string;
		const fourQuestionsJson = formData.get("fourQuestions") as string;
		const turnaroundJson = formData.get("turnaround") as string;

		const geminiApiKey = context.cloudflare.env.GEMINI_API_KEY;
		if (!geminiApiKey) {
			return { error: "GEMINI_API_KEY が設定されていません" };
		}

		const fq = JSON.parse(fourQuestionsJson) as {
			isTrue: string;
			absolutelyTrue: string;
			reaction: string;
			withoutThought: string;
		};
		const ta = JSON.parse(turnaroundJson) as {
			toSelf: string;
			toOther: string;
			toOpposite: string;
		};

		const prompt = `あなたはバイロン・ケイティです。「ザ・ワーク」の創始者として、以下のワークに対して温かく、直接的なフィードバックを日本語で提供してください。

ケイティとしての語り口の特徴:
- 優しく、しかし直接的に語りかける
- 質問を通じてさらなる気づきを促す
- ワークをした人の勇気を認める
- 「ハニー」「スウィートハート」のような愛称は日本語では使わず、「あなた」で語りかける

## ワークの内容

**ビリーフ:** 「${belief}」

### 4つの質問への回答:
1. それは本当ですか？ → ${fq.isTrue || "（未回答）"}
2. それが本当だと、絶対に言い切れますか？ → ${fq.absolutelyTrue || "（未回答）"}
3. その考えを信じるとき、どう反応しますか？ → ${fq.reaction || "（未回答）"}
4. その考えがなかったら、どうなりますか？ → ${fq.withoutThought || "（未回答）"}

### 置き換え（ターンアラウンド）:
- 自分への置き換え: ${ta.toSelf || "（未回答）"}
- 相手への置き換え: ${ta.toOther || "（未回答）"}
- 反対への置き換え: ${ta.toOpposite || "（未回答）"}

## フィードバックの指針:
1. ワークの深さを認め、良い点を具体的に伝える
2. 質問3（反応）と質問4（考えなしの自分）の回答が十分に掘り下げられているかチェックし、さらに探求できるポイントがあれば問いかけの形で提案する
3. ターンアラウンドの具体例が十分かどうかコメントする（3つ以上の具体例が理想）
4. ワークを通じて見えてきた可能性や気づきについて語る
5. 400字程度で簡潔にまとめる`;

		try {
			const ai = new GoogleGenAI({ apiKey: geminiApiKey });
			const response = await ai.models.generateContent({
				model: "gemini-2.5-flash",
				contents: prompt,
			});

			let reviewText = "";
			try {
				reviewText = response.text ?? "";
			} catch {
				const parts = response.candidates?.[0]?.content?.parts;
				if (parts) {
					reviewText = parts
						.filter(
							(p: { text?: string }) =>
								typeof p.text === "string",
						)
						.map((p: { text?: string }) => p.text)
						.join("");
				}
			}

			return { aiReview: reviewText };
		} catch (e) {
			return {
				error: `AIレビューの生成に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`,
			};
		}
	}

	if (intent === "delete") {
		const sessionId = formData.get("sessionId") as string;
		await db
			.delete(theWorkSessions)
			.where(eq(theWorkSessions.id, Number(sessionId)));
		return { success: true, deleted: true };
	}

	return { error: "不明な操作です" };
}

// --- 型定義 ---

type Step =
	| "worksheet"
	| "select-belief"
	| "four-questions"
	| "turnaround"
	| "review";

const stepOrder: Step[] = [
	"worksheet",
	"select-belief",
	"four-questions",
	"turnaround",
	"review",
];
const getStepIndex = (s: Step) => stepOrder.indexOf(s);

type WorksheetAnswers = {
	name: string;
	emotion: string;
	reason: string;
	wants: string[];
	advice: string[];
	needs: string[];
	traits: string[];
	neverAgain: string[];
};

type FourQuestionsAnswers = {
	isTrue: string;
	absolutelyTrue: string;
	reaction: string;
	withoutThought: string;
};

type TurnaroundAnswers = {
	toSelf: string;
	toOther: string;
	toOpposite: string;
};

// 1つのビリーフに対するワーク結果
type BeliefWork = {
	belief: string;
	fourQuestions: FourQuestionsAnswers;
	turnaround: TurnaroundAnswers;
	aiReview?: string;
	memo?: string;
};

const initialWorksheet: WorksheetAnswers = {
	name: "",
	emotion: "",
	reason: "",
	wants: [""],
	advice: [""],
	needs: [""],
	traits: [""],
	neverAgain: [""],
};

const initialFourQuestions: FourQuestionsAnswers = {
	isTrue: "",
	absolutelyTrue: "",
	reaction: "",
	withoutThought: "",
};

const initialTurnaround: TurnaroundAnswers = {
	toSelf: "",
	toOther: "",
	toOpposite: "",
};

const LOCAL_STORAGE_KEY = "theWork_draft";

type DraftState = {
	step: Step;
	worksheet: WorksheetAnswers;
	selectedBelief: string;
	fourQuestions: FourQuestionsAnswers;
	turnaround: TurnaroundAnswers;
	beliefs: string[];
	completedBeliefWorks: BeliefWork[];
	maxReachedStep: number;
};

function saveDraft(state: DraftState) {
	try {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// 無視
	}
}

function loadDraft(): DraftState | null {
	try {
		const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as DraftState;
	} catch {
		return null;
	}
}

function clearDraft() {
	try {
		localStorage.removeItem(LOCAL_STORAGE_KEY);
	} catch {
		// 無視
	}
}

function getMemberId(): string {
	let id = localStorage.getItem("bookMemberId");
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem("bookMemberId", id);
	}
	return id;
}

// ワークシートからビリーフを抽出
function extractBeliefsFromWorksheet(ws: WorksheetAnswers): string[] {
	const result: string[] = [];
	if (ws.name && ws.emotion && ws.reason) {
		result.push(
			`${ws.name}に対して${ws.emotion}。なぜなら${ws.reason}`,
		);
	}
	for (const want of ws.wants) {
		if (want.trim()) result.push(`${ws.name}に${want.trim()}してほしい`);
	}
	for (const adv of ws.advice) {
		if (adv.trim()) result.push(`${ws.name}は${adv.trim()}`);
	}
	for (const need of ws.needs) {
		if (need.trim())
			result.push(
				`幸せになるために、${ws.name}には${need.trim()}が必要だ`,
			);
	}
	for (const trait of ws.traits) {
		if (trait.trim()) result.push(`${ws.name}は${trait.trim()}`);
	}
	for (const exp of ws.neverAgain) {
		if (exp.trim()) result.push(`二度と${exp.trim()}を経験したくない`);
	}
	return result;
}

// --- メインコンポーネント ---

export default function TheWork({ loaderData }: Route.ComponentProps) {
	const fetcher = useFetcher();
	const [memberId, setMemberId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [step, setStep] = useState<Step>("worksheet");
	const [worksheet, setWorksheet] =
		useState<WorksheetAnswers>(initialWorksheet);
	const [beliefs, setBeliefs] = useState<string[]>([]);
	const [selectedBelief, setSelectedBelief] = useState("");
	const [fourQuestions, setFourQuestions] =
		useState<FourQuestionsAnswers>(initialFourQuestions);
	const [turnaround, setTurnaround] =
		useState<TurnaroundAnswers>(initialTurnaround);
	const [completedBeliefWorks, setCompletedBeliefWorks] = useState<
		BeliefWork[]
	>([]);
	const [maxReachedStep, setMaxReachedStep] = useState(0);
	const [currentSessionId, setCurrentSessionId] = useState<number | null>(
		null,
	);
	const [sessions, setSessions] = useState<typeof loaderData.sessions>([]);
	const [showHistory, setShowHistory] = useState(false);
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [saveTitle, setSaveTitle] = useState("");
	const [saveMessage, setSaveMessage] = useState("");
	const [aiReview, setAiReview] = useState<string | null>(null);
	const [memo, setMemo] = useState("");
	const [initialized, setInitialized] = useState(false);

	// 初期化
	useEffect(() => {
		const id = getMemberId();
		setMemberId(id);
		setDisplayName(localStorage.getItem("bookDisplayName") || "");
		const draft = loadDraft();
		if (draft) {
			setStep(draft.step);
			setWorksheet(draft.worksheet);
			setSelectedBelief(draft.selectedBelief);
			setFourQuestions(draft.fourQuestions);
			setTurnaround(draft.turnaround);
			setBeliefs(draft.beliefs);
			setCompletedBeliefWorks(draft.completedBeliefWorks || []);
			setMaxReachedStep(
				draft.maxReachedStep ?? getStepIndex(draft.step),
			);
		}
		setInitialized(true);
	}, []);

	// localStorage 自動保存 (デバウンス)
	const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => {
		if (!initialized) return;
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			saveDraft({
				step,
				worksheet,
				selectedBelief,
				fourQuestions,
				turnaround,
				beliefs,
				completedBeliefWorks,
				maxReachedStep,
			});
		}, 500);
		return () => clearTimeout(saveTimerRef.current);
	}, [
		step,
		worksheet,
		selectedBelief,
		fourQuestions,
		turnaround,
		beliefs,
		completedBeliefWorks,
		maxReachedStep,
		initialized,
	]);

	// fetcher.data の処理（load結果 + action結果）
	useEffect(() => {
		if (!fetcher.data) return;

		// fetcher.load の結果（セッション一覧）
		if ("sessions" in fetcher.data) {
			setSessions(
				fetcher.data.sessions as typeof loaderData.sessions,
			);
			return;
		}

		// AIレビューの結果
		if ("aiReview" in fetcher.data) {
			setAiReview(fetcher.data.aiReview as string);
			return;
		}

		// action の結果（保存・削除）
		if ("success" in fetcher.data && fetcher.data.success) {
			if ("deleted" in fetcher.data) {
				if (memberId) {
					fetcher.load(`/the-work?memberId=${memberId}`);
				}
			} else if ("sessionId" in fetcher.data) {
				setCurrentSessionId(fetcher.data.sessionId as number);
				setSaveMessage("保存しました");
				setShowSaveDialog(false);
				setTimeout(() => setSaveMessage(""), 2000);
				// 保存後もリロードして一覧を更新
				if (memberId) {
					fetcher.load(`/the-work?memberId=${memberId}`);
				}
			}
		}
	}, [fetcher.data, memberId]);

	// ワークシート完了
	const handleWorksheetComplete = useCallback(() => {
		const extracted = extractBeliefsFromWorksheet(worksheet);
		setBeliefs(extracted);
		setStep("select-belief");
		setMaxReachedStep((prev) =>
			Math.max(prev, getStepIndex("select-belief")),
		);
	}, [worksheet]);

	// ビリーフ選択
	const handleSelectBelief = useCallback((belief: string) => {
		setSelectedBelief(belief);
		setFourQuestions(initialFourQuestions);
		setTurnaround(initialTurnaround);
		setStep("four-questions");
		setMaxReachedStep((prev) =>
			Math.max(prev, getStepIndex("four-questions")),
		);
	}, []);

	// 4つの質問完了
	const handleFourQuestionsComplete = useCallback(() => {
		setStep("turnaround");
		setMaxReachedStep((prev) =>
			Math.max(prev, getStepIndex("turnaround")),
		);
	}, []);

	// ターンアラウンド完了 → レビュー画面へ
	const handleCompleteBelief = useCallback(() => {
		const work: BeliefWork = {
			belief: selectedBelief,
			fourQuestions,
			turnaround,
			aiReview: aiReview ?? undefined,
			memo: memo || undefined,
		};
		setCompletedBeliefWorks((prev) => {
			// 同じビリーフが既にあれば上書き（既存の aiReview/memo を保持）
			const existing = prev.findIndex((w) => w.belief === selectedBelief);
			if (existing >= 0) {
				const updated = [...prev];
				updated[existing] = {
					...work,
					aiReview: work.aiReview ?? prev[existing].aiReview,
					memo: work.memo ?? prev[existing].memo,
				};
				return updated;
			}
			return [...prev, work];
		});
		setStep("review");
		setMaxReachedStep((prev) => Math.max(prev, getStepIndex("review")));
	}, [selectedBelief, fourQuestions, turnaround, aiReview, memo]);

	// レビューから次のビリーフへ（現在のワークを保存してから遷移）
	const handleNextBelief = useCallback(() => {
		// 現在のビリーフワークを aiReview・memo 込みで保存
		if (selectedBelief) {
			setCompletedBeliefWorks((prev) => {
				const existing = prev.findIndex(
					(w) => w.belief === selectedBelief,
				);
				if (existing >= 0) {
					const updated = [...prev];
					updated[existing] = {
						...updated[existing],
						aiReview: aiReview ?? updated[existing].aiReview,
						memo: memo || updated[existing].memo,
					};
					return updated;
				}
				return prev;
			});
		}
		setSelectedBelief("");
		setFourQuestions(initialFourQuestions);
		setTurnaround(initialTurnaround);
		setAiReview(null);
		setMemo("");
		setStep("select-belief");
	}, [selectedBelief, aiReview, memo]);

	// ワーク完了（ビリーフ選択に戻る）
	const handleFinishWork = useCallback(() => {
		// 現在のビリーフワークを aiReview・memo 込みで保存
		if (selectedBelief) {
			setCompletedBeliefWorks((prev) => {
				const existing = prev.findIndex(
					(w) => w.belief === selectedBelief,
				);
				if (existing >= 0) {
					const updated = [...prev];
					updated[existing] = {
						...updated[existing],
						aiReview: aiReview ?? updated[existing].aiReview,
						memo: memo || updated[existing].memo,
					};
					return updated;
				}
				return prev;
			});
		}
		setSelectedBelief("");
		setFourQuestions(initialFourQuestions);
		setTurnaround(initialTurnaround);
		setAiReview(null);
		setMemo("");
		setStep("select-belief");
	}, [selectedBelief, aiReview, memo]);

	// AIレビューをリクエスト
	const handleRequestAiReview = useCallback(() => {
		const formData = new FormData();
		formData.set("intent", "ai-review");
		formData.set("belief", selectedBelief);
		formData.set("fourQuestions", JSON.stringify(fourQuestions));
		formData.set("turnaround", JSON.stringify(turnaround));
		fetcher.submit(formData, { method: "POST" });
	}, [selectedBelief, fourQuestions, turnaround, fetcher]);

	// レビュー画面からステップ編集
	const handleReviewEditStep = useCallback((targetStep: Step) => {
		setStep(targetStep);
	}, []);

	// 完了済みビリーフのステップ編集
	const handleCompletedEditStep = useCallback(
		(index: number, targetStep: Step) => {
			const work = completedBeliefWorks[index];
			setSelectedBelief(work.belief);
			setFourQuestions(work.fourQuestions);
			setTurnaround(work.turnaround);
			setAiReview(work.aiReview ?? null);
			setMemo(work.memo ?? "");
			setStep(targetStep);
		},
		[completedBeliefWorks],
	);

	// ステップクリックで戻る
	const handleStepClick = useCallback(
		(targetStep: Step) => {
			const targetIndex = getStepIndex(targetStep);
			if (targetIndex <= maxReachedStep) {
				setStep(targetStep);
			}
		},
		[maxReachedStep],
	);

	// 完了済みビリーフワークを再編集
	const handleEditBeliefWork = useCallback(
		(index: number) => {
			const work = completedBeliefWorks[index];
			setSelectedBelief(work.belief);
			setFourQuestions(work.fourQuestions);
			setTurnaround(work.turnaround);
			setStep("four-questions");
		},
		[completedBeliefWorks],
	);

	// リスト操作
	const addListItem = useCallback(
		(field: keyof WorksheetAnswers) => {
			const current = worksheet[field];
			if (Array.isArray(current)) {
				setWorksheet({ ...worksheet, [field]: [...current, ""] });
			}
		},
		[worksheet],
	);

	const updateListItem = useCallback(
		(field: keyof WorksheetAnswers, index: number, value: string) => {
			const current = worksheet[field];
			if (Array.isArray(current)) {
				const updated = [...current];
				updated[index] = value;
				setWorksheet({ ...worksheet, [field]: updated });
			}
		},
		[worksheet],
	);

	const removeListItem = useCallback(
		(field: keyof WorksheetAnswers, index: number) => {
			const current = worksheet[field];
			if (Array.isArray(current) && current.length > 1) {
				setWorksheet({
					...worksheet,
					[field]: current.filter((_, i) => i !== index),
				});
			}
		},
		[worksheet],
	);

	// 保存ダイアログを開く
	const handleOpenSaveDialog = useCallback(() => {
		setSaveTitle(
			currentSessionId
				? (saveTitle || worksheet.name || "")
				: (worksheet.name || ""),
		);
		setShowSaveDialog(true);
	}, [currentSessionId, saveTitle, worksheet.name]);

	// D1 に保存
	const handleSave = useCallback(() => {
		if (!saveTitle.trim()) return;
		const formData = new FormData();
		formData.set("intent", "save");
		formData.set("memberId", memberId);
		formData.set("title", saveTitle.trim());
		formData.set("worksheet", JSON.stringify(worksheet));
		formData.set("selectedBelief", selectedBelief);
		formData.set("fourQuestions", JSON.stringify(fourQuestions));
		formData.set("turnaround", JSON.stringify(turnaround));
		formData.set("beliefWorks", JSON.stringify(completedBeliefWorks));
		formData.set("step", step);
		if (currentSessionId) {
			formData.set("sessionId", String(currentSessionId));
		}
		fetcher.submit(formData, { method: "POST" });
	}, [
		memberId,
		saveTitle,
		worksheet,
		selectedBelief,
		fourQuestions,
		turnaround,
		completedBeliefWorks,
		step,
		currentSessionId,
		fetcher,
	]);

	// 保存済みセッションを読み込む
	const handleLoadSession = useCallback(
		(session: (typeof sessions)[number]) => {
			try {
				const ws = JSON.parse(session.worksheet) as WorksheetAnswers;
				setWorksheet(ws);
				setSelectedBelief(session.selectedBelief || "");
				setFourQuestions(
					session.fourQuestions
						? (JSON.parse(session.fourQuestions) as FourQuestionsAnswers)
						: initialFourQuestions,
				);
				setTurnaround(
					session.turnaround
						? (JSON.parse(session.turnaround) as TurnaroundAnswers)
						: initialTurnaround,
				);
				setCompletedBeliefWorks(
					session.beliefWorks
						? (JSON.parse(session.beliefWorks) as BeliefWork[])
						: [],
				);
				const loadedStep = session.step as Step;
				setStep(loadedStep);
				setMaxReachedStep(getStepIndex(loadedStep));
				setCurrentSessionId(session.id);
				setSaveTitle(session.title);
				setBeliefs(extractBeliefsFromWorksheet(ws));
				setShowHistory(false);
			} catch {
				// パースエラーは無視
			}
		},
		[],
	);

	// セッション削除
	const handleDeleteSession = useCallback(
		(sessionId: number) => {
			const formData = new FormData();
			formData.set("intent", "delete");
			formData.set("sessionId", String(sessionId));
			fetcher.submit(formData, { method: "POST" });
			if (currentSessionId === sessionId) {
				setCurrentSessionId(null);
			}
		},
		[fetcher, currentSessionId],
	);

	// 新規ワーク
	// 表示名設定
	const handleSetDisplayName = useCallback(
		(name: string) => {
			const trimmed = name.trim();
			if (!trimmed) return;
			localStorage.setItem("bookDisplayName", trimmed);
			setDisplayName(trimmed);
		},
		[],
	);

	const handleReset = useCallback(() => {
		setWorksheet(initialWorksheet);
		setBeliefs([]);
		setSelectedBelief("");
		setFourQuestions(initialFourQuestions);
		setTurnaround(initialTurnaround);
		setCompletedBeliefWorks([]);
		setStep("worksheet");
		setMaxReachedStep(0);
		setCurrentSessionId(null);
		setSaveTitle("");
		clearDraft();
	}, []);

	// 履歴の表示/非表示
	const handleToggleHistory = useCallback(() => {
		if (!showHistory && memberId) {
			fetcher.load(`/the-work?memberId=${memberId}`);
		}
		setShowHistory((prev) => !prev);
	}, [showHistory, memberId, fetcher]);

	const isWorksheetValid =
		worksheet.name.trim() !== "" &&
		worksheet.emotion.trim() !== "" &&
		worksheet.reason.trim() !== "";

	if (!initialized) {
		return (
			<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950" />
		);
	}

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			{/* 装飾 */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-8 max-w-3xl mx-auto">
				{/* 表示名未設定: ログイン画面 */}
				{!displayName && initialized && (
					<NameSetup onSetName={handleSetDisplayName} />
				)}

				{/* ヘッダー */}
				{displayName && (
				<header className="w-full mb-8">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-sm text-purple-300/70 hover:text-purple-200 transition-colors mb-4"
					>
						← ホームに戻る
					</Link>
					<div className="flex items-start justify-between gap-4">
						<div>
							<h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
								ザ・ワーク
							</h1>
							<p className="text-purple-200/70 mt-2">
								バイロン・ケイティの「ザ・ワーク」-
								思い込みを4つの質問で問いかける
							</p>
						</div>
						<div className="flex gap-2 shrink-0 mt-1">
							<button
								type="button"
								onClick={handleOpenSaveDialog}
								disabled={fetcher.state !== "idle"}
								className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
									saveMessage
										? "bg-green-500/20 text-green-300 border border-green-500/30"
										: "bg-white/10 text-purple-200 border border-white/10 hover:bg-white/20"
								} disabled:opacity-50`}
							>
								{saveMessage || "保存"}
							</button>
							<button
								type="button"
								onClick={handleToggleHistory}
								className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
									showHistory
										? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30"
										: "bg-white/10 text-purple-200 border-white/10 hover:bg-white/20"
								}`}
							>
								履歴
							</button>
						</div>
					</div>
				</header>
				)}

				{displayName && (<>
				{/* 保存ダイアログ */}
				{showSaveDialog && (
					<SaveDialog
						title={saveTitle}
						setTitle={setSaveTitle}
						onSave={handleSave}
						onCancel={() => setShowSaveDialog(false)}
						isSubmitting={fetcher.state !== "idle"}
						isUpdate={currentSessionId !== null}
					/>
				)}

				{/* 保存済みセッション一覧 */}
				{showHistory && (
					<SessionHistory
						sessions={sessions}
						currentSessionId={currentSessionId}
						onLoad={handleLoadSession}
						onDelete={handleDeleteSession}
						onNewWork={handleReset}
						isLoading={fetcher.state !== "idle"}
					/>
				)}

				{/* ステッププログレス */}
				<StepProgress
					currentStep={step}
					onStepClick={handleStepClick}
					maxReachedStep={maxReachedStep}
				/>

				{/* 完了済みビリーフワーク一覧 */}
				{completedBeliefWorks.length > 0 &&
					(step === "select-belief" ||
						step === "four-questions" ||
						step === "turnaround" ||
						step === "review") && (
						<CompletedBeliefWorks
							works={completedBeliefWorks}
							onEdit={handleEditBeliefWork}
							onEditStep={handleCompletedEditStep}
						/>
					)}

				{/* メインコンテンツ */}
				{step === "worksheet" && (
					<WorksheetForm
						worksheet={worksheet}
						setWorksheet={setWorksheet}
						addListItem={addListItem}
						updateListItem={updateListItem}
						removeListItem={removeListItem}
						onComplete={handleWorksheetComplete}
						isValid={isWorksheetValid}
					/>
				)}

				{step === "select-belief" && (
					<BeliefSelector
						beliefs={beliefs}
						completedBeliefs={completedBeliefWorks.map((w) => w.belief)}
						onSelect={handleSelectBelief}
						onBack={() => setStep("worksheet")}
					/>
				)}

				{step === "four-questions" && (
					<FourQuestions
						belief={selectedBelief}
						answers={fourQuestions}
						setAnswers={setFourQuestions}
						onComplete={handleFourQuestionsComplete}
						onBack={() => setStep("select-belief")}
					/>
				)}

				{step === "turnaround" && (
					<Turnaround
						belief={selectedBelief}
						name={worksheet.name}
						answers={turnaround}
						setAnswers={setTurnaround}
						onComplete={handleCompleteBelief}
						onBack={() => setStep("four-questions")}
					/>
				)}

				{step === "review" && (
					<BeliefWorkReview
						belief={selectedBelief}
						fourQuestions={fourQuestions}
						turnaround={turnaround}
						onNextBelief={handleNextBelief}
						onFinish={handleFinishWork}
						onEditStep={handleReviewEditStep}
						onRequestAiReview={handleRequestAiReview}
						aiReview={aiReview}
						isReviewLoading={fetcher.state !== "idle"}
						memo={memo}
						onMemoChange={setMemo}
						hasRemainingBeliefs={
							beliefs.filter(
								(b) =>
									!completedBeliefWorks.some(
										(w) => w.belief === b,
									),
							).length > 0
						}
					/>
				)}
				</>)}
			</div>
		</div>
	);
}

// --- 名前設定画面 ---
function NameSetup({ onSetName }: { onSetName: (name: string) => void }) {
	const [name, setName] = useState("");

	return (
		<div className="flex flex-col items-center w-full max-w-md">
			<header className="w-full mb-8 text-center">
				<Link
					to="/"
					className="inline-flex items-center gap-2 text-sm text-purple-300/70 hover:text-purple-200 transition-colors mb-4"
				>
					← ホームに戻る
				</Link>
				<h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					ザ・ワーク
				</h1>
				<p className="text-purple-200/70 mt-2">
					バイロン・ケイティの「ザ・ワーク」-
					思い込みを4つの質問で問いかける
				</p>
			</header>
			<section className="w-full">
				<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-fuchsia-500/30 p-6">
					<h2 className="text-lg font-semibold text-white mb-3">
						はじめに表示名を設定
					</h2>
					<p className="text-sm text-purple-200/60 mb-4">
						ワークの記録に使用される名前です
					</p>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							onSetName(name);
						}}
						className="space-y-4"
					>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							placeholder="例: hidelberq"
							className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30"
						/>
						<button
							type="submit"
							className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
						>
							設定する
						</button>
					</form>
				</div>
			</section>
		</div>
	);
}

// --- 保存ダイアログ ---
function SaveDialog({
	title,
	setTitle,
	onSave,
	onCancel,
	isSubmitting,
	isUpdate,
}: {
	title: string;
	setTitle: (t: string) => void;
	onSave: () => void;
	onCancel: () => void;
	isSubmitting: boolean;
	isUpdate: boolean;
}) {
	return (
		<div className="w-full mb-6">
			<SectionCard>
				<h2 className="text-lg font-bold text-purple-100 mb-3">
					{isUpdate ? "ワークを上書き保存" : "ワークを保存"}
				</h2>
				<div className="space-y-3">
					<div>
						<label
							htmlFor="save-title"
							className="text-xs text-purple-200/60 mb-1 block"
						>
							ワークの名前
						</label>
						<input
							id="save-title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="例：上司に対するワーク、母との関係"
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter" && title.trim()) onSave();
							}}
						/>
					</div>
					<div className="flex gap-2 justify-end">
						<button
							type="button"
							onClick={onCancel}
							className="px-4 py-2 rounded-xl text-sm text-purple-300/60 hover:text-purple-200 transition-colors"
						>
							キャンセル
						</button>
						<button
							type="button"
							onClick={onSave}
							disabled={!title.trim() || isSubmitting}
							className="px-4 py-2 rounded-xl font-medium text-sm text-white bg-fuchsia-500 hover:bg-fuchsia-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							{isSubmitting ? "保存中..." : "保存"}
						</button>
					</div>
				</div>
			</SectionCard>
		</div>
	);
}

// --- 完了済みビリーフワーク一覧 ---
function CompletedBeliefWorks({
	works,
	onEdit,
	onEditStep,
}: {
	works: BeliefWork[];
	onEdit: (index: number) => void;
	onEditStep: (index: number, step: Step) => void;
}) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	return (
		<div className="w-full mb-6">
			<SectionCard>
				<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-3">
					ワーク済みのビリーフ ({works.length})
				</h2>
				<div className="space-y-2">
					{works.map((work, i) => (
						<div
							key={work.belief}
							className="rounded-xl border border-green-500/20 bg-green-500/5 transition-all"
						>
							<button
								type="button"
								onClick={() =>
									setExpandedIndex(
										expandedIndex === i ? null : i,
									)
								}
								className="w-full text-left px-4 py-3 hover:bg-green-500/10 transition-all rounded-xl"
							>
								<div className="flex items-center gap-2 justify-between">
									<div className="flex items-center gap-2 min-w-0">
										<span className="text-green-400 text-xs shrink-0">
											&#10003;
										</span>
										<span className="text-sm text-purple-100 truncate">
											{work.belief}
										</span>
									</div>
									<span className="text-purple-300/40 text-xs shrink-0">
										{expandedIndex === i ? "▲" : "▼"}
									</span>
								</div>
							</button>
							{expandedIndex === i && (
								<div className="px-4 pb-4 space-y-3 border-t border-white/10 mx-4 pt-3">
									<div className="flex items-center justify-between">
										<p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/80">
											4つの質問
										</p>
										<button
											type="button"
											onClick={() =>
												onEditStep(
													i,
													"four-questions",
												)
											}
											className="text-xs text-fuchsia-400/70 hover:text-fuchsia-300 transition-colors"
										>
											編集
										</button>
									</div>
									<div>
										<p className="text-xs font-medium text-fuchsia-300/70">
											1. それは本当ですか？
										</p>
										<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
											{work.fourQuestions.isTrue ||
												"（未回答）"}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-fuchsia-300/70">
											2.
											それが本当だと、絶対に言い切れますか？
										</p>
										<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
											{work.fourQuestions.absolutelyTrue ||
												"（未回答）"}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-fuchsia-300/70">
											3.
											その考えを信じるとき、あなたはどう反応しますか？
										</p>
										<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
											{work.fourQuestions.reaction ||
												"（未回答）"}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-fuchsia-300/70">
											4.
											その考えがなかったら、あなたはどうなりますか？
										</p>
										<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
											{work.fourQuestions.withoutThought ||
												"（未回答）"}
										</p>
									</div>
									<div className="border-t border-white/10 pt-3">
										<div className="flex items-center justify-between mb-3">
											<p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/80">
												置き換え
											</p>
											<button
												type="button"
												onClick={() =>
													onEditStep(
														i,
														"turnaround",
													)
												}
												className="text-xs text-fuchsia-400/70 hover:text-fuchsia-300 transition-colors"
											>
												編集
											</button>
										</div>
										<div className="space-y-3">
											<div>
												<p className="text-xs font-medium text-fuchsia-300/70">
													自分への置き換え
												</p>
												<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
													{work.turnaround.toSelf ||
														"（未回答）"}
												</p>
											</div>
											<div>
												<p className="text-xs font-medium text-fuchsia-300/70">
													相手への置き換え
												</p>
												<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
													{work.turnaround.toOther ||
														"（未回答）"}
												</p>
											</div>
											<div>
												<p className="text-xs font-medium text-fuchsia-300/70">
													反対への置き換え
												</p>
												<p className="text-sm text-purple-100/80 mt-1 whitespace-pre-wrap">
													{work.turnaround
														.toOpposite ||
														"（未回答）"}
												</p>
											</div>
										</div>
									</div>
									{work.aiReview && (
										<div className="border-t border-white/10 pt-3">
											<p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-2">
												AIケイティからのフィードバック
											</p>
											<p className="text-sm text-purple-100/80 whitespace-pre-wrap">
												{work.aiReview}
											</p>
										</div>
									)}
									{work.memo && (
										<div className="border-t border-white/10 pt-3">
											<p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-2">
												メモ・感想
											</p>
											<p className="text-sm text-purple-100/80 whitespace-pre-wrap">
												{work.memo}
											</p>
										</div>
									)}
								</div>
							)}
						</div>
					))}
				</div>
			</SectionCard>
		</div>
	);
}

// --- セッション履歴 ---
function SessionHistory({
	sessions,
	currentSessionId,
	onLoad,
	onDelete,
	onNewWork,
	isLoading,
}: {
	sessions: {
		id: number;
		memberId: string;
		title: string;
		worksheet: string;
		selectedBelief: string | null;
		fourQuestions: string | null;
		turnaround: string | null;
		beliefWorks: string | null;
		step: string;
		createdAt: Date | null;
		updatedAt: Date | null;
	}[];
	currentSessionId: number | null;
	onLoad: (session: (typeof sessions)[number]) => void;
	onDelete: (sessionId: number) => void;
	onNewWork: () => void;
	isLoading: boolean;
}) {
	const stepLabels: Record<string, string> = {
		worksheet: "ワークシート",
		"select-belief": "ビリーフ選択",
		"four-questions": "4つの質問",
		turnaround: "置き換え",
		review: "レビュー",
	};

	// 完了済みビリーフ数を計算
	function getBeliefCount(session: (typeof sessions)[number]): number {
		if (!session.beliefWorks) return 0;
		try {
			const works = JSON.parse(session.beliefWorks) as BeliefWork[];
			return works.length;
		} catch {
			return 0;
		}
	}

	return (
		<div className="w-full mb-6">
			<SectionCard>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-bold text-purple-100">保存済みワーク</h2>
					<button
						type="button"
						onClick={onNewWork}
						className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white hover:from-fuchsia-600 hover:to-cyan-600 transition-all"
					>
						+ 新規ワーク
					</button>
				</div>

				{isLoading ? (
					<p className="text-sm text-purple-200/50 text-center py-4">
						読み込み中...
					</p>
				) : sessions.length === 0 ? (
					<p className="text-sm text-purple-200/50 text-center py-4">
						保存済みのワークはまだありません
					</p>
				) : (
					<div className="space-y-2">
						{sessions.map((session) => {
							const beliefCount = getBeliefCount(session);
							return (
								<div
									key={session.id}
									className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${
										currentSessionId === session.id
											? "border-fuchsia-500/50 bg-fuchsia-500/10"
											: "border-white/10 bg-white/5 hover:bg-white/10"
									}`}
								>
									<button
										type="button"
										onClick={() => onLoad(session)}
										className="flex-1 text-left"
									>
										<p className="text-sm font-medium text-purple-100">
											{session.title}
										</p>
										<p className="text-xs text-purple-200/50 mt-0.5">
											{stepLabels[session.step] || session.step}
											{beliefCount > 0 && ` · ${beliefCount}件のビリーフ`}
											{session.updatedAt &&
												` · ${new Date(session.updatedAt).toLocaleDateString("ja-JP")}`}
										</p>
									</button>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDelete(session.id);
										}}
										className="px-2 py-1 text-xs text-purple-300/40 hover:text-red-400 transition-colors"
										aria-label="削除"
									>
										削除
									</button>
								</div>
							);
						})}
					</div>
				)}
			</SectionCard>
		</div>
	);
}

// --- ステッププログレス ---
function StepProgress({
	currentStep,
	onStepClick,
	maxReachedStep,
}: {
	currentStep: Step;
	onStepClick: (step: Step) => void;
	maxReachedStep: number;
}) {
	const steps: { key: Step; label: string }[] = [
		{ key: "worksheet", label: "ワークシート" },
		{ key: "select-belief", label: "ビリーフ選択" },
		{ key: "four-questions", label: "4つの質問" },
		{ key: "turnaround", label: "置き換え" },
		{ key: "review", label: "レビュー" },
	];
	const currentIndex = steps.findIndex((s) => s.key === currentStep);

	return (
		<div className="w-full mb-8">
			<div className="flex items-center justify-between">
				{steps.map((s, i) => {
					const isReachable = i <= maxReachedStep;
					const isCurrent = i === currentIndex;
					const isCompleted = i <= currentIndex;
					return (
						<div
							key={s.key}
							className="flex items-center flex-1 last:flex-none"
						>
							<div className="flex flex-col items-center">
								<button
									type="button"
									onClick={() => onStepClick(s.key)}
									disabled={!isReachable}
									className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
										isCompleted
											? "bg-fuchsia-500 text-white"
											: isReachable
												? "bg-white/10 text-purple-300/50"
												: "bg-white/10 text-purple-300/50"
									} ${
										isReachable && !isCurrent
											? "cursor-pointer hover:ring-2 hover:ring-fuchsia-400/50"
											: ""
									} ${isCurrent ? "ring-2 ring-fuchsia-300" : ""} ${!isReachable ? "cursor-not-allowed opacity-50" : ""}`}
								>
									{i + 1}
								</button>
								<span
									className={`text-xs mt-1 whitespace-nowrap ${
										isCompleted
											? "text-fuchsia-300"
											: "text-purple-300/40"
									}`}
								>
									{s.label}
								</span>
							</div>
							{i < steps.length - 1 && (
								<div
									className={`flex-1 h-0.5 mx-2 mb-5 ${
										i < currentIndex
											? "bg-fuchsia-500/50"
											: "bg-white/10"
									}`}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// --- ワークシートフォーム ---
function WorksheetForm({
	worksheet,
	setWorksheet,
	addListItem,
	updateListItem,
	removeListItem,
	onComplete,
	isValid,
}: {
	worksheet: WorksheetAnswers;
	setWorksheet: (w: WorksheetAnswers) => void;
	addListItem: (field: keyof WorksheetAnswers) => void;
	updateListItem: (
		field: keyof WorksheetAnswers,
		index: number,
		value: string,
	) => void;
	removeListItem: (field: keyof WorksheetAnswers, index: number) => void;
	onComplete: () => void;
	isValid: boolean;
}) {
	return (
		<div className="w-full space-y-6">
			<SectionCard>
				<h2 className="text-lg font-bold text-purple-100 mb-1">
					ジャッジメント・ワークシート
				</h2>
				<p className="text-sm text-purple-200/60 mb-6">
					誰かに対する不満やジャッジを正直に書き出してください。きれいに書く必要はありません。
				</p>

				<QuestionBlock
					number={1}
					title="誰に対して、なぜ怒り・悲しみ・恐れ・困惑していますか？"
				>
					<p className="text-sm text-purple-200/50 mb-3 italic">
						「（名前）に対して（感情）。なぜなら（理由）」
					</p>
					<div className="space-y-3">
						<InputField
							label="誰に対して？"
							value={worksheet.name}
							onChange={(v) => setWorksheet({ ...worksheet, name: v })}
							placeholder="名前を入力"
						/>
						<InputField
							label="どんな感情？"
							value={worksheet.emotion}
							onChange={(v) => setWorksheet({ ...worksheet, emotion: v })}
							placeholder="例：怒っている、悲しい、困惑している"
						/>
						<InputField
							label="なぜ？"
							value={worksheet.reason}
							onChange={(v) => setWorksheet({ ...worksheet, reason: v })}
							placeholder="理由を書いてください"
							multiline
						/>
					</div>
				</QuestionBlock>

				<QuestionBlock
					number={2}
					title="その人にどう変わってほしいですか？ 何を求めますか？"
				>
					<p className="text-sm text-purple-200/50 mb-3 italic">
						「（名前）に〇〇してほしい」
					</p>
					<ListInput
						items={worksheet.wants}
						field="wants"
						placeholder="例：もっと話を聞いてほしい"
						addListItem={addListItem}
						updateListItem={updateListItem}
						removeListItem={removeListItem}
					/>
				</QuestionBlock>

				<QuestionBlock
					number={3}
					title="その人にどんなアドバイスをしたいですか？"
				>
					<p className="text-sm text-purple-200/50 mb-3 italic">
						「（名前）は〇〇すべきだ / すべきでない」
					</p>
					<ListInput
						items={worksheet.advice}
						field="advice"
						placeholder="例：もっと正直であるべきだ"
						addListItem={addListItem}
						updateListItem={updateListItem}
						removeListItem={removeListItem}
					/>
				</QuestionBlock>

				<QuestionBlock
					number={4}
					title="あなたが幸せになるために、その人に何が必要ですか？"
				>
					<p className="text-sm text-purple-200/50 mb-3 italic">
						「幸せになるために、（名前）には〇〇が必要だ」
					</p>
					<ListInput
						items={worksheet.needs}
						field="needs"
						placeholder="例：私を尊重すること"
						addListItem={addListItem}
						updateListItem={updateListItem}
						removeListItem={removeListItem}
					/>
				</QuestionBlock>

				<QuestionBlock
					number={5}
					title="その人についてどう思いますか？ リストにしてください。"
				>
					<p className="text-sm text-purple-200/50 mb-3 italic">
						「（名前）は〇〇だ」
					</p>
					<ListInput
						items={worksheet.traits}
						field="traits"
						placeholder="例：無責任だ、自己中心的だ"
						addListItem={addListItem}
						updateListItem={updateListItem}
						removeListItem={removeListItem}
					/>
				</QuestionBlock>

				<QuestionBlock
					number={6}
					title="この人について、二度と経験したくないことは何ですか？"
				>
					<p className="text-sm text-purple-200/50 mb-3 italic">
						「二度と〇〇を経験したくない」
					</p>
					<ListInput
						items={worksheet.neverAgain}
						field="neverAgain"
						placeholder="例：無視されること"
						addListItem={addListItem}
						updateListItem={updateListItem}
						removeListItem={removeListItem}
					/>
				</QuestionBlock>

				<button
					type="button"
					onClick={onComplete}
					disabled={!isValid}
					className="w-full mt-6 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
				>
					ビリーフを選ぶ →
				</button>
			</SectionCard>
		</div>
	);
}

// --- ビリーフ選択 ---
function BeliefSelector({
	beliefs,
	completedBeliefs,
	onSelect,
	onBack,
}: {
	beliefs: string[];
	completedBeliefs: string[];
	onSelect: (belief: string) => void;
	onBack: () => void;
}) {
	const [customBelief, setCustomBelief] = useState("");

	return (
		<div className="w-full space-y-6">
			<SectionCard>
				<h2 className="text-lg font-bold text-purple-100 mb-1">
					ビリーフを選んでください
				</h2>
				<p className="text-sm text-purple-200/60 mb-6">
					ワークシートから抽出された考えの中から、一番ストレスを感じるものを選んでください。
				</p>

				<div className="space-y-2 mb-6">
					{beliefs.map((belief) => {
						const isCompleted = completedBeliefs.includes(belief);
						return (
							<button
								key={belief}
								type="button"
								onClick={() => onSelect(belief)}
								className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
									isCompleted
										? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10"
										: "border-white/10 bg-white/5 hover:border-fuchsia-500/40 hover:bg-white/10"
								}`}
							>
								<div className="flex items-center gap-2">
									{isCompleted && (
										<span className="text-green-400 text-xs">&#10003;</span>
									)}
									<span className="text-purple-100">{belief}</span>
								</div>
							</button>
						);
					})}
				</div>

				<div className="border-t border-white/10 pt-4">
					<p className="text-sm text-purple-200/60 mb-2">
						または自分でビリーフを入力：
					</p>
					<div className="flex gap-2">
						<input
							type="text"
							value={customBelief}
							onChange={(e) => setCustomBelief(e.target.value)}
							placeholder="自由に入力..."
							className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50"
						/>
						<button
							type="button"
							onClick={() => {
								if (customBelief.trim()) onSelect(customBelief.trim());
							}}
							disabled={!customBelief.trim()}
							className="px-4 py-2 rounded-xl font-medium text-sm text-white bg-fuchsia-500 hover:bg-fuchsia-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							選択
						</button>
					</div>
				</div>

				<button
					type="button"
					onClick={onBack}
					className="mt-4 text-sm text-purple-300/60 hover:text-purple-200 transition-colors"
				>
					← ワークシートに戻る
				</button>
			</SectionCard>
		</div>
	);
}

// --- 4つの質問 ---
function FourQuestions({
	belief,
	answers,
	setAnswers,
	onComplete,
	onBack,
}: {
	belief: string;
	answers: FourQuestionsAnswers;
	setAnswers: (a: FourQuestionsAnswers) => void;
	onComplete: () => void;
	onBack: () => void;
}) {
	return (
		<div className="w-full space-y-6">
			<SectionCard>
				<h2 className="text-lg font-bold text-purple-100 mb-1">4つの質問</h2>
				<div className="rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 px-4 py-3 mb-6">
					<p className="text-sm text-fuchsia-200/80 font-medium">
						選んだビリーフ：
					</p>
					<p className="text-purple-100 mt-1">「{belief}」</p>
				</div>

				<div className="space-y-6">
					<QuestionBlock number={1} title="それは本当ですか？">
						<p className="text-sm text-purple-200/50 mb-3">
							はい か いいえ
							で答えてください。「はい」の場合は質問2へ。「いいえ」の場合は質問3へ進んでください。
						</p>
						<textarea
							value={answers.isTrue}
							onChange={(e) =>
								setAnswers({ ...answers, isTrue: e.target.value })
							}
							placeholder="はい / いいえ"
							rows={2}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>

					<QuestionBlock
						number={2}
						title="それが本当だと、絶対に言い切れますか？"
					>
						<p className="text-sm text-purple-200/50 mb-3">
							自分の内側に静かに問いかけてください。
						</p>
						<textarea
							value={answers.absolutelyTrue}
							onChange={(e) =>
								setAnswers({ ...answers, absolutelyTrue: e.target.value })
							}
							placeholder="はい / いいえ"
							rows={2}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>

					<QuestionBlock
						number={3}
						title="その考えを信じるとき、あなたはどう反応しますか？ 何が起こりますか？"
					>
						<p className="text-sm text-purple-200/50 mb-3">
							体の感覚、感情、行動、他の人への態度などを観察してください。
						</p>
						<textarea
							value={answers.reaction}
							onChange={(e) =>
								setAnswers({ ...answers, reaction: e.target.value })
							}
							placeholder="その考えを持っているときのあなた自身を描写してください..."
							rows={4}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>

					<QuestionBlock
						number={4}
						title="その考えがなかったら、あなたはどうなりますか？"
					>
						<p className="text-sm text-purple-200/50 mb-3">
							その考えを持てなかったとしたら、同じ状況であなたはどのような人になりますか？
						</p>
						<textarea
							value={answers.withoutThought}
							onChange={(e) =>
								setAnswers({ ...answers, withoutThought: e.target.value })
							}
							placeholder="その考えなしの自分を想像してください..."
							rows={4}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>
				</div>

				<button
					type="button"
					onClick={onComplete}
					className="w-full mt-6 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 transition-all"
				>
					置き換えへ進む →
				</button>

				<button
					type="button"
					onClick={onBack}
					className="mt-3 text-sm text-purple-300/60 hover:text-purple-200 transition-colors"
				>
					← ビリーフ選択に戻る
				</button>
			</SectionCard>
		</div>
	);
}

// --- ターンアラウンド ---
function Turnaround({
	belief,
	name,
	answers,
	setAnswers,
	onComplete,
	onBack,
}: {
	belief: string;
	name: string;
	answers: TurnaroundAnswers;
	setAnswers: (a: TurnaroundAnswers) => void;
	onComplete: () => void;
	onBack: () => void;
}) {
	return (
		<div className="w-full space-y-6">
			<SectionCard>
				<h2 className="text-lg font-bold text-purple-100 mb-1">
					置き換え（ターンアラウンド）
				</h2>
				<div className="rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 px-4 py-3 mb-4">
					<p className="text-sm text-fuchsia-200/80 font-medium">
						元のビリーフ：
					</p>
					<p className="text-purple-100 mt-1">「{belief}」</p>
				</div>
				<p className="text-sm text-purple-200/60 mb-6">
					元の考えを置き換えてみましょう。各置き換えについて、少なくとも3つの具体例を見つけてみてください。
				</p>

				<div className="space-y-6">
					<QuestionBlock title="自分への置き換え">
						<p className="text-sm text-purple-200/50 mb-3">
							主語を相手から自分に変えてみてください。
							{name && `「${name}は〇〇」→「私は〇〇」`}
						</p>
						<textarea
							value={answers.toSelf}
							onChange={(e) =>
								setAnswers({ ...answers, toSelf: e.target.value })
							}
							placeholder="自分に置き換えた文と、それが当てはまる具体例を書いてください..."
							rows={4}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>

					<QuestionBlock title="相手への置き換え">
						<p className="text-sm text-purple-200/50 mb-3">
							立場を入れ替えてみてください。
							{name &&
								`「私は${name}に〇〇」→「${name}は私に〇〇」`}
						</p>
						<textarea
							value={answers.toOther}
							onChange={(e) =>
								setAnswers({ ...answers, toOther: e.target.value })
							}
							placeholder="相手に置き換えた文と、それが当てはまる具体例を書いてください..."
							rows={4}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>

					<QuestionBlock title="反対への置き換え">
						<p className="text-sm text-purple-200/50 mb-3">
							元の考えの正反対を書いてみてください。
						</p>
						<textarea
							value={answers.toOpposite}
							onChange={(e) =>
								setAnswers({ ...answers, toOpposite: e.target.value })
							}
							placeholder="反対に置き換えた文と、それが当てはまる具体例を書いてください..."
							rows={4}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
						/>
					</QuestionBlock>
				</div>

				<div className="mt-6 flex flex-col gap-3">
					<button
						type="button"
						onClick={onComplete}
						className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 transition-all"
					>
						このビリーフのワークを確認する
					</button>
					<button
						type="button"
						onClick={onBack}
						className="w-full px-6 py-3 rounded-xl font-semibold text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/10 transition-all"
					>
						4つの質問に戻る
					</button>
				</div>
			</SectionCard>
		</div>
	);
}

// --- レビュー画面 ---
function BeliefWorkReview({
	belief,
	fourQuestions,
	turnaround,
	onNextBelief,
	onFinish,
	onEditStep,
	onRequestAiReview,
	aiReview,
	isReviewLoading,
	memo,
	onMemoChange,
	hasRemainingBeliefs,
}: {
	belief: string;
	fourQuestions: FourQuestionsAnswers;
	turnaround: TurnaroundAnswers;
	onNextBelief: () => void;
	onFinish: () => void;
	onEditStep: (step: Step) => void;
	onRequestAiReview: () => void;
	aiReview: string | null;
	isReviewLoading: boolean;
	memo: string;
	onMemoChange: (memo: string) => void;
	hasRemainingBeliefs: boolean;
}) {
	const questions = [
		{ label: "それは本当ですか？", value: fourQuestions.isTrue },
		{
			label: "それが本当だと、絶対に言い切れますか？",
			value: fourQuestions.absolutelyTrue,
		},
		{
			label: "その考えを信じるとき、あなたはどう反応しますか？",
			value: fourQuestions.reaction,
		},
		{
			label: "その考えがなかったら、あなたはどうなりますか？",
			value: fourQuestions.withoutThought,
		},
	];

	const turnarounds = [
		{ label: "自分への置き換え", value: turnaround.toSelf },
		{ label: "相手への置き換え", value: turnaround.toOther },
		{ label: "反対への置き換え", value: turnaround.toOpposite },
	];

	return (
		<div className="w-full space-y-6">
			<SectionCard>
				<h2 className="text-lg font-bold text-purple-100 mb-1">
					ワークのレビュー
				</h2>
				<p className="text-sm text-purple-200/60 mb-6">
					このビリーフに対するワーク全体を確認しましょう。
				</p>

				{/* ビリーフ */}
				<div className="rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 px-4 py-3 mb-6">
					<p className="text-xs text-fuchsia-200/80 font-medium">
						ビリーフ
					</p>
					<p className="text-purple-100 mt-1">「{belief}」</p>
				</div>

				{/* 4つの質問 */}
				<div className="mb-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80">
							4つの質問
						</h3>
						<button
							type="button"
							onClick={() => onEditStep("four-questions")}
							className="text-xs text-fuchsia-400/70 hover:text-fuchsia-300 transition-colors"
						>
							編集
						</button>
					</div>
					<div className="space-y-4">
						{questions.map((q, i) => (
							<div key={q.label}>
								<p className="text-xs font-medium text-fuchsia-300/70 mb-1">
									{i + 1}. {q.label}
								</p>
								<div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
									<p className="text-sm text-purple-100/80 whitespace-pre-wrap">
										{q.value || "（未回答）"}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* ターンアラウンド */}
				<div className="mb-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80">
							置き換え（ターンアラウンド）
						</h3>
						<button
							type="button"
							onClick={() => onEditStep("turnaround")}
							className="text-xs text-fuchsia-400/70 hover:text-fuchsia-300 transition-colors"
						>
							編集
						</button>
					</div>
					<div className="space-y-4">
						{turnarounds.map((t) => (
							<div key={t.label}>
								<p className="text-xs font-medium text-fuchsia-300/70 mb-1">
									{t.label}
								</p>
								<div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
									<p className="text-sm text-purple-100/80 whitespace-pre-wrap">
										{t.value || "（未回答）"}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* AIレビュー */}
				<div className="mb-6 border-t border-white/10 pt-6">
					{aiReview ? (
						<div>
							<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-3">
								AIケイティからのフィードバック
							</h3>
							<div className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20 px-4 py-4">
								<p className="text-sm text-purple-100/90 whitespace-pre-wrap leading-relaxed">
									{aiReview}
								</p>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={onRequestAiReview}
							disabled={isReviewLoading}
							className="w-full px-6 py-3 rounded-xl font-semibold text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/10 transition-all disabled:opacity-50"
						>
							{isReviewLoading ? (
								<span className="flex items-center justify-center gap-2">
									<span className="inline-block w-4 h-4 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
									AIケイティが考えています...
								</span>
							) : (
								"AIケイティに聞いてみる"
							)}
						</button>
					)}
				</div>

				{/* メモ */}
				<div className="mb-6 border-t border-white/10 pt-6">
					<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-3">
						メモ・感想
					</h3>
					<textarea
						value={memo}
						onChange={(e) => onMemoChange(e.target.value)}
						placeholder="ワークを終えた感想や気づきをメモ..."
						className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40 resize-y min-h-[80px]"
						rows={3}
					/>
				</div>

				{/* アクションボタン */}
				<div className="flex flex-col gap-3">
					{hasRemainingBeliefs && (
						<button
							type="button"
							onClick={onNextBelief}
							className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 transition-all"
						>
							次のビリーフへ
						</button>
					)}
					<button
						type="button"
						onClick={onFinish}
						className={`w-full px-6 py-3 rounded-xl font-semibold transition-all ${
							hasRemainingBeliefs
								? "text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/10"
								: "text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600"
						}`}
					>
						ビリーフ選択に戻る
					</button>
				</div>
			</SectionCard>
		</div>
	);
}

// --- 共通コンポーネント ---

function SectionCard({ children }: { children: React.ReactNode }) {
	return (
		<div className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
			{children}
		</div>
	);
}

function QuestionBlock({
	number,
	title,
	children,
}: {
	number?: number;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-6 last:mb-0">
			<h3 className="text-sm font-bold text-fuchsia-300/90 mb-2">
				{number !== undefined && (
					<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs mr-2">
						{number}
					</span>
				)}
				{title}
			</h3>
			{children}
		</div>
	);
}

function InputField({
	label,
	value,
	onChange,
	placeholder,
	multiline,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
}) {
	return (
		<div>
			<label className="text-xs text-purple-200/60 mb-1 block">{label}</label>
			{multiline ? (
				<textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					rows={3}
					className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 resize-none"
				/>
			) : (
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50"
				/>
			)}
		</div>
	);
}

function ListInput({
	items,
	field,
	placeholder,
	addListItem,
	updateListItem,
	removeListItem,
}: {
	items: string[];
	field: keyof WorksheetAnswers;
	placeholder: string;
	addListItem: (field: keyof WorksheetAnswers) => void;
	updateListItem: (
		field: keyof WorksheetAnswers,
		index: number,
		value: string,
	) => void;
	removeListItem: (field: keyof WorksheetAnswers, index: number) => void;
}) {
	return (
		<div className="space-y-2">
			{items.map((item, i) => (
				<div key={`${field}-${i}`} className="flex gap-2">
					<input
						type="text"
						value={item}
						onChange={(e) => updateListItem(field, i, e.target.value)}
						placeholder={placeholder}
						className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50"
					/>
					{items.length > 1 && (
						<button
							type="button"
							onClick={() => removeListItem(field, i)}
							className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-purple-300/50 hover:text-red-400 hover:border-red-400/30 transition-colors text-sm"
							aria-label="削除"
						>
							×
						</button>
					)}
				</div>
			))}
			<button
				type="button"
				onClick={() => addListItem(field)}
				className="text-sm text-fuchsia-400/70 hover:text-fuchsia-300 transition-colors"
			>
				+ 追加
			</button>
		</div>
	);
}
