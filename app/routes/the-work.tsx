import { useState, useCallback } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/the-work";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "ザ・ワーク | hidelberq" },
		{
			name: "description",
			content:
				"バイロン・ケイティのザ・ワーク。思い込みを4つの質問とターンアラウンドで問い直すセルフワークツール",
		},
	];
}

// ステップ定義
type Step = "worksheet" | "select-belief" | "four-questions" | "turnaround" | "summary";

// ジャッジメントシートの質問
const worksheetPrompts = [
	{
		id: "anger",
		label: "1",
		prefix: "に対して、怒り・悲しみ・失望しています。なぜなら",
		placeholder: "例: 私の話を全く聞いてくれないから",
	},
	{
		id: "want",
		label: "2",
		prefix: "に、こうしてほしい：",
		placeholder: "例: もっと私の気持ちを理解してほしい",
	},
	{
		id: "should",
		label: "3",
		prefix: "は、こうすべきだ（すべきでない）：",
		placeholder: "例: 人の話を最後まで聞くべきだ",
	},
	{
		id: "need",
		label: "4",
		prefix: "には、これが必要だ：",
		placeholder: "例: もっと思いやりが必要だ",
	},
	{
		id: "think",
		label: "5",
		prefix: "について私が考えることは：",
		placeholder: "例: 自分勝手で、いつも自分のことしか考えていない",
	},
	{
		id: "never",
		label: "6",
		prefix: "のような人は二度と経験したくない：",
		placeholder: "例: 無視されること、軽く扱われること",
	},
] as const;

// 4つの質問
const fourQuestions = [
	{
		number: 1,
		question: "それは本当ですか？",
		description: "「はい」か「いいえ」で答えてください。",
		type: "yesno" as const,
	},
	{
		number: 2,
		question: "それが本当であると、絶対に言い切れますか？",
		description: "もう一度、心の奥深くに問いかけてください。「はい」か「いいえ」で。",
		type: "yesno" as const,
	},
	{
		number: 3,
		question: "その考えを信じるとき、あなたはどう反応しますか？何が起こりますか？",
		description:
			"その考えを持っているとき、自分の中で何が起きるか観察してください。感情、身体の感覚、行動の変化などを書いてください。",
		type: "text" as const,
	},
	{
		number: 4,
		question: "その考えがなければ、あなたはどうなりますか？",
		description:
			"その考えを持つことが不可能だとしたら、同じ状況にいるあなたはどんな人になりますか？",
		type: "text" as const,
	},
] as const;

// ターンアラウンドの種類
const turnaroundTypes = [
	{
		id: "to-self",
		label: "自分自身への置き換え",
		description: "主語を自分に変えて、文を書き直してみましょう",
	},
	{
		id: "to-other",
		label: "相手への置き換え",
		description: "主語と目的語を入れ替えて、文を書き直してみましょう",
	},
	{
		id: "to-opposite",
		label: "反対への置き換え",
		description: "元の文の反対の意味になるように書き直してみましょう",
	},
] as const;

type WorksheetData = Record<string, string>;
type FourQuestionsData = {
	q1: "yes" | "no" | null;
	q2: "yes" | "no" | null;
	q3: string;
	q4: string;
};
type TurnaroundData = Record<string, { statement: string; examples: string }>;

export default function TheWork() {
	const [step, setStep] = useState<Step>("worksheet");
	const [targetName, setTargetName] = useState("");
	const [worksheet, setWorksheet] = useState<WorksheetData>({});
	const [selectedBelief, setSelectedBelief] = useState("");
	const [selectedBeliefIndex, setSelectedBeliefIndex] = useState(-1);
	const [fourQData, setFourQData] = useState<FourQuestionsData>({
		q1: null,
		q2: null,
		q3: "",
		q4: "",
	});
	const [turnarounds, setTurnarounds] = useState<TurnaroundData>({});

	// 全ワークの履歴（複数ビリーフを処理可能に）
	const [completedWorks, setCompletedWorks] = useState<
		Array<{
			belief: string;
			fourQuestions: FourQuestionsData;
			turnarounds: TurnaroundData;
		}>
	>([]);

	const beliefs = Object.entries(worksheet)
		.filter(([, v]) => v.trim() !== "")
		.map(([key, value]) => {
			const prompt = worksheetPrompts.find((p) => p.id === key);
			return {
				id: key,
				text: `${targetName}${prompt?.prefix ?? ""} ${value}`,
				raw: value,
			};
		});

	const handleWorksheetNext = useCallback(() => {
		if (!targetName.trim()) return;
		const filledCount = Object.values(worksheet).filter(
			(v) => v.trim() !== "",
		).length;
		if (filledCount === 0) return;
		setStep("select-belief");
	}, [targetName, worksheet]);

	const handleSelectBelief = useCallback(
		(belief: string, index: number) => {
			setSelectedBelief(belief);
			setSelectedBeliefIndex(index);
			setFourQData({ q1: null, q2: null, q3: "", q4: "" });
			setTurnarounds({});
			setStep("four-questions");
		},
		[],
	);

	const handleFourQuestionsNext = useCallback(() => {
		setStep("turnaround");
	}, []);

	const handleTurnaroundNext = useCallback(() => {
		setCompletedWorks((prev) => [
			...prev,
			{
				belief: selectedBelief,
				fourQuestions: fourQData,
				turnarounds,
			},
		]);
		setStep("summary");
	}, [selectedBelief, fourQData, turnarounds]);

	const handleWorkAnother = useCallback(() => {
		setSelectedBelief("");
		setSelectedBeliefIndex(-1);
		setFourQData({ q1: null, q2: null, q3: "", q4: "" });
		setTurnarounds({});
		setStep("select-belief");
	}, []);

	const handleStartOver = useCallback(() => {
		setStep("worksheet");
		setTargetName("");
		setWorksheet({});
		setSelectedBelief("");
		setSelectedBeliefIndex(-1);
		setFourQData({ q1: null, q2: null, q3: "", q4: "" });
		setTurnarounds({});
		setCompletedWorks([]);
	}, []);

	const stepLabels: Record<Step, string> = {
		worksheet: "ジャッジメントシート",
		"select-belief": "ビリーフを選択",
		"four-questions": "4つの質問",
		turnaround: "ターンアラウンド",
		summary: "まとめ",
	};

	const stepOrder: Step[] = [
		"worksheet",
		"select-belief",
		"four-questions",
		"turnaround",
		"summary",
	];

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			{/* Decorative blobs */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-8 max-w-3xl mx-auto">
				{/* Header */}
				<header className="w-full mb-8">
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
						バイロン・ケイティの「ザ・ワーク」で思い込みを問い直す
					</p>
				</header>

				{/* Progress */}
				<div className="w-full mb-8">
					<div className="flex items-center gap-1">
						{stepOrder.map((s, i) => {
							const currentIndex = stepOrder.indexOf(step);
							const isCompleted = i < currentIndex;
							const isCurrent = s === step;
							return (
								<div key={s} className="flex-1 flex flex-col items-center gap-1">
									<div
										className={`h-1.5 w-full rounded-full transition-all duration-300 ${
											isCompleted
												? "bg-fuchsia-500"
												: isCurrent
													? "bg-fuchsia-500/50"
													: "bg-white/10"
										}`}
									/>
									<span
										className={`text-[10px] hidden sm:block ${
											isCurrent
												? "text-fuchsia-300"
												: isCompleted
													? "text-fuchsia-400/60"
													: "text-purple-300/30"
										}`}
									>
										{stepLabels[s]}
									</span>
								</div>
							);
						})}
					</div>
				</div>

				{/* Step Content */}
				{step === "worksheet" && (
					<WorksheetStep
						targetName={targetName}
						setTargetName={setTargetName}
						worksheet={worksheet}
						setWorksheet={setWorksheet}
						onNext={handleWorksheetNext}
					/>
				)}

				{step === "select-belief" && (
					<SelectBeliefStep
						beliefs={beliefs}
						completedBeliefs={completedWorks.map((w) => w.belief)}
						onSelect={handleSelectBelief}
						onBack={() => setStep("worksheet")}
					/>
				)}

				{step === "four-questions" && (
					<FourQuestionsStep
						belief={selectedBelief}
						beliefIndex={selectedBeliefIndex}
						data={fourQData}
						setData={setFourQData}
						onNext={handleFourQuestionsNext}
						onBack={() => setStep("select-belief")}
					/>
				)}

				{step === "turnaround" && (
					<TurnaroundStep
						belief={selectedBelief}
						beliefIndex={selectedBeliefIndex}
						turnarounds={turnarounds}
						setTurnarounds={setTurnarounds}
						onNext={handleTurnaroundNext}
						onBack={() => setStep("four-questions")}
					/>
				)}

				{step === "summary" && (
					<SummaryStep
						completedWorks={completedWorks}
						beliefs={beliefs}
						completedBeliefs={completedWorks.map((w) => w.belief)}
						onWorkAnother={handleWorkAnother}
						onStartOver={handleStartOver}
					/>
				)}
			</div>
		</div>
	);
}

// ==========================================
// ステップ 1: ジャッジメントシート
// ==========================================
function WorksheetStep({
	targetName,
	setTargetName,
	worksheet,
	setWorksheet,
	onNext,
}: {
	targetName: string;
	setTargetName: (v: string) => void;
	worksheet: WorksheetData;
	setWorksheet: (v: WorksheetData) => void;
	onNext: () => void;
}) {
	const filledCount = Object.values(worksheet).filter(
		(v) => v.trim() !== "",
	).length;
	const canProceed = targetName.trim() !== "" && filledCount > 0;

	return (
		<div className="w-full space-y-6">
			<Card>
				<p className="text-purple-100/90 leading-relaxed text-sm mb-4">
					あなたを悩ませている人について、正直に書いてください。
					礼儀正しくある必要はありません。思ったままに書きましょう。
				</p>

				{/* 対象者の名前 */}
				<div className="mb-6">
					<label
						htmlFor="target-name"
						className="block text-sm font-medium text-fuchsia-300 mb-2"
					>
						誰について書きますか？
					</label>
					<input
						id="target-name"
						type="text"
						value={targetName}
						onChange={(e) => setTargetName(e.target.value)}
						placeholder="名前を入力してください"
						className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30"
					/>
				</div>

				{/* 6つの質問 */}
				<div className="space-y-5">
					{worksheetPrompts.map((prompt) => (
						<div key={prompt.id}>
							<label
								htmlFor={`ws-${prompt.id}`}
								className="block text-sm text-purple-100 mb-1.5"
							>
								<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs font-bold mr-2">
									{prompt.label}
								</span>
								<span className="text-fuchsia-200/80 font-medium">
									{targetName || "___"}
								</span>
								<span className="text-purple-200/70">{prompt.prefix}</span>
							</label>
							<textarea
								id={`ws-${prompt.id}`}
								value={worksheet[prompt.id] ?? ""}
								onChange={(e) =>
									setWorksheet({
										...worksheet,
										[prompt.id]: e.target.value,
									})
								}
								placeholder={prompt.placeholder}
								rows={2}
								className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 resize-none text-sm"
							/>
						</div>
					))}
				</div>
			</Card>

			<div className="flex justify-end">
				<button
					type="button"
					onClick={onNext}
					disabled={!canProceed}
					className="px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium transition-all duration-200 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed"
				>
					ビリーフを選んで質問に進む →
				</button>
			</div>
		</div>
	);
}

// ==========================================
// ステップ 2: ビリーフ選択
// ==========================================
function SelectBeliefStep({
	beliefs,
	completedBeliefs,
	onSelect,
	onBack,
}: {
	beliefs: Array<{ id: string; text: string; raw: string }>;
	completedBeliefs: string[];
	onSelect: (belief: string, index: number) => void;
	onBack: () => void;
}) {
	return (
		<div className="w-full space-y-6">
			<Card>
				<p className="text-purple-100/90 leading-relaxed text-sm mb-4">
					ワークシートから、今もっとも心に引っかかるビリーフ（思い込み）を1つ選んでください。
				</p>

				<div className="space-y-3">
					{beliefs.map((belief, index) => {
						const isCompleted = completedBeliefs.includes(belief.text);
						return (
							<button
								key={belief.id}
								type="button"
								onClick={() => !isCompleted && onSelect(belief.text, index)}
								disabled={isCompleted}
								className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
									isCompleted
										? "border-green-500/30 bg-green-500/5 opacity-60"
										: "border-white/10 bg-white/5 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5"
								}`}
							>
								<div className="flex items-start gap-3">
									<span
										className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 ${
											isCompleted
												? "bg-green-500/20 text-green-300"
												: "bg-fuchsia-500/20 text-fuchsia-300"
										}`}
									>
										{isCompleted ? "✓" : index + 1}
									</span>
									<span
										className={`text-sm ${isCompleted ? "text-green-200/60" : "text-purple-100"}`}
									>
										{belief.text}
									</span>
								</div>
							</button>
						);
					})}
				</div>
			</Card>

			<div className="flex justify-between">
				<button
					type="button"
					onClick={onBack}
					className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-purple-200 font-medium transition-all duration-200 hover:bg-white/10"
				>
					← 戻る
				</button>
			</div>
		</div>
	);
}

// ==========================================
// ステップ 3: 4つの質問
// ==========================================
function FourQuestionsStep({
	belief,
	beliefIndex,
	data,
	setData,
	onNext,
	onBack,
}: {
	belief: string;
	beliefIndex: number;
	data: FourQuestionsData;
	setData: (v: FourQuestionsData) => void;
	onNext: () => void;
	onBack: () => void;
}) {
	const [currentQ, setCurrentQ] = useState(0);
	const q = fourQuestions[currentQ];

	const canProceed =
		currentQ === fourQuestions.length - 1 &&
		data.q1 !== null &&
		data.q2 !== null;

	const handleYesNo = (value: "yes" | "no") => {
		const key = `q${q.number}` as "q1" | "q2";
		setData({ ...data, [key]: value });
	};

	const handleText = (value: string) => {
		const key = `q${q.number}` as "q3" | "q4";
		setData({ ...data, [key]: value });
	};

	const currentYesNo =
		q.type === "yesno"
			? (data[`q${q.number}` as "q1" | "q2"] as "yes" | "no" | null)
			: null;
	const currentText =
		q.type === "text"
			? (data[`q${q.number}` as "q3" | "q4"] as string)
			: "";

	return (
		<div className="w-full space-y-6">
			{/* 選択されたビリーフ */}
			<div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 px-4 py-3">
				<p className="text-xs text-fuchsia-400/70 mb-1">
					選択したビリーフ #{beliefIndex + 1}
				</p>
				<p className="text-sm text-purple-100 font-medium">
					「{belief}」
				</p>
			</div>

			{/* 質問インジケーター */}
			<div className="flex gap-2">
				{fourQuestions.map((fq, i) => (
					<button
						key={fq.number}
						type="button"
						onClick={() => setCurrentQ(i)}
						className={`flex-1 h-2 rounded-full transition-all duration-300 ${
							i === currentQ
								? "bg-fuchsia-500"
								: i < currentQ
									? "bg-fuchsia-500/50"
									: "bg-white/10"
						}`}
					/>
				))}
			</div>

			<Card>
				<div className="space-y-4">
					<div>
						<span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-300 font-bold mb-3">
							{q.number}
						</span>
						<h3 className="text-lg font-semibold text-purple-100">
							{q.question}
						</h3>
						<p className="text-sm text-purple-200/60 mt-1">
							{q.description}
						</p>
					</div>

					{q.type === "yesno" ? (
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => handleYesNo("yes")}
								className={`flex-1 py-3 rounded-xl border font-medium transition-all duration-200 ${
									currentYesNo === "yes"
										? "border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200"
										: "border-white/10 bg-white/5 text-purple-200 hover:bg-white/10"
								}`}
							>
								はい
							</button>
							<button
								type="button"
								onClick={() => handleYesNo("no")}
								className={`flex-1 py-3 rounded-xl border font-medium transition-all duration-200 ${
									currentYesNo === "no"
										? "border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200"
										: "border-white/10 bg-white/5 text-purple-200 hover:bg-white/10"
								}`}
							>
								いいえ
							</button>
						</div>
					) : (
						<textarea
							value={currentText}
							onChange={(e) => handleText(e.target.value)}
							placeholder="ゆっくりと、感じるままに書いてください..."
							rows={5}
							className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 resize-none text-sm"
						/>
					)}
				</div>
			</Card>

			<div className="flex justify-between">
				<button
					type="button"
					onClick={() => {
						if (currentQ > 0) {
							setCurrentQ(currentQ - 1);
						} else {
							onBack();
						}
					}}
					className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-purple-200 font-medium transition-all duration-200 hover:bg-white/10"
				>
					← 戻る
				</button>
				{currentQ < fourQuestions.length - 1 ? (
					<button
						type="button"
						onClick={() => setCurrentQ(currentQ + 1)}
						className="px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium transition-all duration-200 hover:from-fuchsia-500 hover:to-purple-500"
					>
						次の質問 →
					</button>
				) : (
					<button
						type="button"
						onClick={onNext}
						disabled={!canProceed}
						className="px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium transition-all duration-200 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed"
					>
						ターンアラウンドへ →
					</button>
				)}
			</div>
		</div>
	);
}

// ==========================================
// ステップ 4: ターンアラウンド
// ==========================================
function TurnaroundStep({
	belief,
	beliefIndex,
	turnarounds,
	setTurnarounds,
	onNext,
	onBack,
}: {
	belief: string;
	beliefIndex: number;
	turnarounds: TurnaroundData;
	setTurnarounds: (v: TurnaroundData) => void;
	onNext: () => void;
	onBack: () => void;
}) {
	return (
		<div className="w-full space-y-6">
			{/* 選択されたビリーフ */}
			<div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 px-4 py-3">
				<p className="text-xs text-fuchsia-400/70 mb-1">
					選択したビリーフ #{beliefIndex + 1}
				</p>
				<p className="text-sm text-purple-100 font-medium">
					「{belief}」
				</p>
			</div>

			<Card>
				<p className="text-purple-100/90 leading-relaxed text-sm mb-6">
					元のビリーフを「置き換え」てみましょう。置き換えた文が、元の文と同じかそれ以上に本当だと感じられる具体例を見つけてください。
				</p>

				<div className="space-y-6">
					{turnaroundTypes.map((ta) => (
						<div
							key={ta.id}
							className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
						>
							<div>
								<h4 className="text-sm font-semibold text-fuchsia-300">
									{ta.label}
								</h4>
								<p className="text-xs text-purple-200/50 mt-0.5">
									{ta.description}
								</p>
							</div>
							<div>
								<label
									htmlFor={`ta-statement-${ta.id}`}
									className="block text-xs text-purple-200/60 mb-1"
								>
									置き換えた文
								</label>
								<input
									id={`ta-statement-${ta.id}`}
									type="text"
									value={turnarounds[ta.id]?.statement ?? ""}
									onChange={(e) =>
										setTurnarounds({
											...turnarounds,
											[ta.id]: {
												...turnarounds[ta.id],
												statement: e.target.value,
												examples:
													turnarounds[ta.id]?.examples ?? "",
											},
										})
									}
									placeholder="置き換えた文を書いてください"
									className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 text-sm"
								/>
							</div>
							<div>
								<label
									htmlFor={`ta-examples-${ta.id}`}
									className="block text-xs text-purple-200/60 mb-1"
								>
									それが本当である具体例（少なくとも3つ）
								</label>
								<textarea
									id={`ta-examples-${ta.id}`}
									value={turnarounds[ta.id]?.examples ?? ""}
									onChange={(e) =>
										setTurnarounds({
											...turnarounds,
											[ta.id]: {
												...turnarounds[ta.id],
												statement:
													turnarounds[ta.id]?.statement ?? "",
												examples: e.target.value,
											},
										})
									}
									placeholder="1. &#10;2. &#10;3. "
									rows={3}
									className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 resize-none text-sm"
								/>
							</div>
						</div>
					))}
				</div>
			</Card>

			<div className="flex justify-between">
				<button
					type="button"
					onClick={onBack}
					className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-purple-200 font-medium transition-all duration-200 hover:bg-white/10"
				>
					← 戻る
				</button>
				<button
					type="button"
					onClick={onNext}
					className="px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium transition-all duration-200 hover:from-fuchsia-500 hover:to-purple-500"
				>
					まとめを見る →
				</button>
			</div>
		</div>
	);
}

// ==========================================
// ステップ 5: まとめ
// ==========================================
function SummaryStep({
	completedWorks,
	beliefs,
	completedBeliefs,
	onWorkAnother,
	onStartOver,
}: {
	completedWorks: Array<{
		belief: string;
		fourQuestions: FourQuestionsData;
		turnarounds: TurnaroundData;
	}>;
	beliefs: Array<{ id: string; text: string; raw: string }>;
	completedBeliefs: string[];
	onWorkAnother: () => void;
	onStartOver: () => void;
}) {
	const hasMore = beliefs.some((b) => !completedBeliefs.includes(b.text));

	return (
		<div className="w-full space-y-6">
			{completedWorks.map((work, wi) => (
				<Card key={wi}>
					<h3 className="text-sm font-semibold text-fuchsia-300 mb-4">
						ワーク #{wi + 1}
					</h3>

					{/* ビリーフ */}
					<div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2 mb-4">
						<p className="text-xs text-fuchsia-400/70 mb-0.5">ビリーフ</p>
						<p className="text-sm text-purple-100">
							「{work.belief}」
						</p>
					</div>

					{/* 4つの質問の回答 */}
					<div className="space-y-3 mb-4">
						<h4 className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/60">
							4つの質問
						</h4>
						{fourQuestions.map((fq) => {
							const key = `q${fq.number}` as keyof FourQuestionsData;
							const answer = work.fourQuestions[key];
							return (
								<div key={fq.number} className="text-sm">
									<p className="text-purple-200/60 text-xs">
										Q{fq.number}. {fq.question}
									</p>
									<p className="text-purple-100 mt-0.5">
										{answer === "yes"
											? "はい"
											: answer === "no"
												? "いいえ"
												: answer || "（未記入）"}
									</p>
								</div>
							);
						})}
					</div>

					{/* ターンアラウンド */}
					{Object.keys(work.turnarounds).length > 0 && (
						<div className="space-y-3">
							<h4 className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/60">
								ターンアラウンド
							</h4>
							{turnaroundTypes.map((ta) => {
								const data = work.turnarounds[ta.id];
								if (!data?.statement) return null;
								return (
									<div key={ta.id} className="text-sm">
										<p className="text-purple-200/60 text-xs">
											{ta.label}
										</p>
										<p className="text-purple-100 mt-0.5 font-medium">
											{data.statement}
										</p>
										{data.examples && (
											<p className="text-purple-200/50 text-xs mt-1 whitespace-pre-line">
												{data.examples}
											</p>
										)}
									</div>
								);
							})}
						</div>
					)}
				</Card>
			))}

			<div className="flex flex-col sm:flex-row gap-3">
				{hasMore && (
					<button
						type="button"
						onClick={onWorkAnother}
						className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium transition-all duration-200 hover:from-fuchsia-500 hover:to-purple-500"
					>
						別のビリーフでワークする
					</button>
				)}
				<button
					type="button"
					onClick={onStartOver}
					className="flex-1 px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-purple-200 font-medium transition-all duration-200 hover:bg-white/10"
				>
					最初からやり直す
				</button>
			</div>
		</div>
	);
}

// ==========================================
// 共通コンポーネント
// ==========================================
function Card({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
			{children}
		</div>
	);
}
