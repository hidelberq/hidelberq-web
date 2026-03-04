import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useFetcher } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
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

// --- loader: 保存済みセッション一覧を取得 ---
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

// --- action: セッションの保存・削除 ---
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
		const step = formData.get("step") as string;

		if (sessionId) {
			// 既存セッションを更新
			await db
				.update(theWorkSessions)
				.set({
					title,
					worksheet,
					selectedBelief: selectedBelief || null,
					fourQuestions: fourQuestions || null,
					turnaround: turnaround || null,
					step,
					updatedAt: new Date(),
				})
				.where(eq(theWorkSessions.id, Number(sessionId)));
			return { success: true, sessionId: Number(sessionId) };
		}
		// 新規セッションを作成
		const result = await db
			.insert(theWorkSessions)
			.values({
				memberId,
				title,
				worksheet,
				selectedBelief: selectedBelief || null,
				fourQuestions: fourQuestions || null,
				turnaround: turnaround || null,
				step,
			})
			.returning({ id: theWorkSessions.id });
		return { success: true, sessionId: result[0].id };
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

// ステップの定義
type Step = "worksheet" | "select-belief" | "four-questions" | "turnaround";

// ワークシートの回答
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

// 4つの質問の回答
type FourQuestionsAnswers = {
	isTrue: string;
	absolutelyTrue: string;
	reaction: string;
	withoutThought: string;
};

// ターンアラウンドの回答
type TurnaroundAnswers = {
	toSelf: string;
	toOther: string;
	toOpposite: string;
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
};

function saveDraft(state: DraftState) {
	try {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// localStorage が使えない環境では無視
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
	let id = localStorage.getItem("theWorkMemberId");
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem("theWorkMemberId", id);
	}
	return id;
}

export default function TheWork({
	loaderData,
}: Route.ComponentProps) {
	const fetcher = useFetcher();
	const [memberId, setMemberId] = useState("");
	const [step, setStep] = useState<Step>("worksheet");
	const [worksheet, setWorksheet] =
		useState<WorksheetAnswers>(initialWorksheet);
	const [beliefs, setBeliefs] = useState<string[]>([]);
	const [selectedBelief, setSelectedBelief] = useState("");
	const [fourQuestions, setFourQuestions] =
		useState<FourQuestionsAnswers>(initialFourQuestions);
	const [turnaround, setTurnaround] =
		useState<TurnaroundAnswers>(initialTurnaround);
	const [currentSessionId, setCurrentSessionId] = useState<number | null>(
		null,
	);
	const [showHistory, setShowHistory] = useState(false);
	const [saveMessage, setSaveMessage] = useState("");
	const [initialized, setInitialized] = useState(false);

	// 初期化: localStorage からドラフトを復元、memberId を取得
	useEffect(() => {
		const id = getMemberId();
		setMemberId(id);

		const draft = loadDraft();
		if (draft) {
			setStep(draft.step);
			setWorksheet(draft.worksheet);
			setSelectedBelief(draft.selectedBelief);
			setFourQuestions(draft.fourQuestions);
			setTurnaround(draft.turnaround);
			setBeliefs(draft.beliefs);
		}
		setInitialized(true);
	}, []);

	// 状態変更時に localStorage に自動保存 (デバウンス)
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
			});
		}, 500);
		return () => clearTimeout(saveTimerRef.current);
	}, [step, worksheet, selectedBelief, fourQuestions, turnaround, beliefs, initialized]);

	// action の結果を処理
	useEffect(() => {
		if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
			if ("deleted" in fetcher.data) {
				// 削除後にセッション一覧を再読み込み
				if (memberId) {
					fetcher.load(`/the-work?memberId=${memberId}`);
				}
			} else if ("sessionId" in fetcher.data) {
				setCurrentSessionId(fetcher.data.sessionId as number);
				setSaveMessage("保存しました");
				setTimeout(() => setSaveMessage(""), 2000);
			}
		}
	}, [fetcher.data, memberId]);

	// ワークシートからビリーフを抽出
	const extractBeliefs = useCallback(() => {
		const result: string[] = [];
		if (worksheet.name && worksheet.emotion && worksheet.reason) {
			result.push(
				`${worksheet.name}に対して${worksheet.emotion}。なぜなら${worksheet.reason}`,
			);
		}
		for (const want of worksheet.wants) {
			if (want.trim())
				result.push(`${worksheet.name}に${want.trim()}してほしい`);
		}
		for (const adv of worksheet.advice) {
			if (adv.trim()) result.push(`${worksheet.name}は${adv.trim()}`);
		}
		for (const need of worksheet.needs) {
			if (need.trim())
				result.push(
					`幸せになるために、${worksheet.name}には${need.trim()}が必要だ`,
				);
		}
		for (const trait of worksheet.traits) {
			if (trait.trim()) result.push(`${worksheet.name}は${trait.trim()}`);
		}
		for (const exp of worksheet.neverAgain) {
			if (exp.trim()) result.push(`二度と${exp.trim()}を経験したくない`);
		}
		return result;
	}, [worksheet]);

	const handleWorksheetComplete = useCallback(() => {
		const extracted = extractBeliefs();
		setBeliefs(extracted);
		setStep("select-belief");
	}, [extractBeliefs]);

	const handleSelectBelief = useCallback((belief: string) => {
		setSelectedBelief(belief);
		setFourQuestions(initialFourQuestions);
		setTurnaround(initialTurnaround);
		setStep("four-questions");
	}, []);

	const handleFourQuestionsComplete = useCallback(() => {
		setStep("turnaround");
	}, []);

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

	// D1 に保存
	const handleSave = useCallback(() => {
		const title = worksheet.name
			? `${worksheet.name}に対するワーク`
			: "無題のワーク";
		const formData = new FormData();
		formData.set("intent", "save");
		formData.set("memberId", memberId);
		formData.set("title", title);
		formData.set("worksheet", JSON.stringify(worksheet));
		formData.set("selectedBelief", selectedBelief);
		formData.set("fourQuestions", JSON.stringify(fourQuestions));
		formData.set("turnaround", JSON.stringify(turnaround));
		formData.set("step", step);
		if (currentSessionId) {
			formData.set("sessionId", String(currentSessionId));
		}
		fetcher.submit(formData, { method: "POST" });
	}, [
		memberId,
		worksheet,
		selectedBelief,
		fourQuestions,
		turnaround,
		step,
		currentSessionId,
		fetcher,
	]);

	// 保存済みセッションを読み込む
	const handleLoadSession = useCallback(
		(session: (typeof loaderData.sessions)[number]) => {
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
				setStep(session.step as Step);
				setCurrentSessionId(session.id);
				// ビリーフも再抽出
				const result: string[] = [];
				if (ws.name && ws.emotion && ws.reason) {
					result.push(
						`${ws.name}に対して${ws.emotion}。なぜなら${ws.reason}`,
					);
				}
				for (const w of ws.wants) {
					if (w.trim()) result.push(`${ws.name}に${w.trim()}してほしい`);
				}
				for (const a of ws.advice) {
					if (a.trim()) result.push(`${ws.name}は${a.trim()}`);
				}
				for (const n of ws.needs) {
					if (n.trim())
						result.push(
							`幸せになるために、${ws.name}には${n.trim()}が必要だ`,
						);
				}
				for (const t of ws.traits) {
					if (t.trim()) result.push(`${ws.name}は${t.trim()}`);
				}
				for (const e of ws.neverAgain) {
					if (e.trim()) result.push(`二度と${e.trim()}を経験したくない`);
				}
				setBeliefs(result);
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
	const handleReset = useCallback(() => {
		setWorksheet(initialWorksheet);
		setBeliefs([]);
		setSelectedBelief("");
		setFourQuestions(initialFourQuestions);
		setTurnaround(initialTurnaround);
		setStep("worksheet");
		setCurrentSessionId(null);
		clearDraft();
	}, []);

	// 履歴の表示/非表示切り替え
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

	// SSR 中は何も表示しない (localStorage に依存するため)
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
				{/* ヘッダー */}
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
								onClick={handleSave}
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

				{/* 保存済みセッション一覧 */}
				{showHistory && (
					<SessionHistory
						sessions={loaderData.sessions}
						currentSessionId={currentSessionId}
						onLoad={handleLoadSession}
						onDelete={handleDeleteSession}
						onNewWork={handleReset}
						isLoading={fetcher.state !== "idle"}
					/>
				)}

				{/* ステッププログレス */}
				<StepProgress currentStep={step} />

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
						onBackToBeliefs={() => setStep("select-belief")}
						onReset={handleReset}
					/>
				)}
			</div>
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
	};

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
						{sessions.map((session) => (
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
						))}
					</div>
				)}
			</SectionCard>
		</div>
	);
}

// --- ステッププログレス ---
function StepProgress({ currentStep }: { currentStep: Step }) {
	const steps: { key: Step; label: string }[] = [
		{ key: "worksheet", label: "ワークシート" },
		{ key: "select-belief", label: "ビリーフ選択" },
		{ key: "four-questions", label: "4つの質問" },
		{ key: "turnaround", label: "置き換え" },
	];
	const currentIndex = steps.findIndex((s) => s.key === currentStep);

	return (
		<div className="w-full mb-8">
			<div className="flex items-center justify-between">
				{steps.map((s, i) => (
					<div key={s.key} className="flex items-center flex-1 last:flex-none">
						<div className="flex flex-col items-center">
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
									i <= currentIndex
										? "bg-fuchsia-500 text-white"
										: "bg-white/10 text-purple-300/50"
								}`}
							>
								{i + 1}
							</div>
							<span
								className={`text-xs mt-1 whitespace-nowrap ${
									i <= currentIndex
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
									i < currentIndex ? "bg-fuchsia-500/50" : "bg-white/10"
								}`}
							/>
						)}
					</div>
				))}
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
	onSelect,
	onBack,
}: {
	beliefs: string[];
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
					{beliefs.map((belief) => (
						<button
							key={belief}
							type="button"
							onClick={() => onSelect(belief)}
							className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:border-fuchsia-500/40 hover:bg-white/10 transition-all text-purple-100 text-sm"
						>
							{belief}
						</button>
					))}
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
	onBackToBeliefs,
	onReset,
}: {
	belief: string;
	name: string;
	answers: TurnaroundAnswers;
	setAnswers: (a: TurnaroundAnswers) => void;
	onBackToBeliefs: () => void;
	onReset: () => void;
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
						onClick={onBackToBeliefs}
						className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-600 hover:to-cyan-600 transition-all"
					>
						別のビリーフでワークする
					</button>
					<button
						type="button"
						onClick={onReset}
						className="w-full px-6 py-3 rounded-xl font-semibold text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/10 transition-all"
					>
						最初からやり直す
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
