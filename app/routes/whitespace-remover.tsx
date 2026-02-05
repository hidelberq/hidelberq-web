import { useState, useCallback } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/whitespace-remover";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "空白除去ツール | hidelberq" },
		{
			name: "description",
			content: "AIの文字起こしなどに含まれる余計な空白を除去するツール",
		},
	];
}

type CleanOption = {
	id: string;
	label: string;
	description: string;
	enabled: boolean;
	transform: (text: string) => string;
};

const defaultOptions: CleanOption[] = [
	{
		id: "multipleSpaces",
		label: "連続スペースをまとめる",
		description: "2つ以上の連続したスペースを1つにまとめます",
		enabled: true,
		transform: (text) => text.replace(/ {2,}/g, " "),
	},
	{
		id: "fullWidthSpace",
		label: "全角スペースを半角に",
		description: "全角スペース（　）を半角スペース（ ）に変換します",
		enabled: true,
		transform: (text) => text.replace(/\u3000/g, " "),
	},
	{
		id: "trimLines",
		label: "各行の前後の空白を削除",
		description: "各行の先頭と末尾にある空白を削除します",
		enabled: true,
		transform: (text) =>
			text
				.split("\n")
				.map((line) => line.trim())
				.join("\n"),
	},
	{
		id: "multipleNewlines",
		label: "連続した空行をまとめる",
		description: "3行以上の連続した空行を2行にまとめます",
		enabled: true,
		transform: (text) => text.replace(/\n{3,}/g, "\n\n"),
	},
	{
		id: "removeAllSpaces",
		label: "すべてのスペースを削除",
		description: "テキスト内のすべてのスペースを削除します（日本語向け）",
		enabled: false,
		transform: (text) => text.replace(/[ \u3000]/g, ""),
	},
];

export default function WhitespaceRemover() {
	const [input, setInput] = useState("");
	const [options, setOptions] = useState<CleanOption[]>(defaultOptions);
	const [copied, setCopied] = useState(false);

	const toggleOption = useCallback((id: string) => {
		setOptions((prev) =>
			prev.map((opt) =>
				opt.id === id ? { ...opt, enabled: !opt.enabled } : opt,
			),
		);
	}, []);

	const cleanText = useCallback(
		(text: string) => {
			return options
				.filter((opt) => opt.enabled)
				.reduce((acc, opt) => opt.transform(acc), text);
		},
		[options],
	);

	const output = cleanText(input);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(output);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement("textarea");
			textarea.value = output;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [output]);

	const stats = {
		inputLength: input.length,
		outputLength: output.length,
		removed: input.length - output.length,
	};

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			{/* Decorative blobs */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-8 max-w-4xl mx-auto">
				{/* Header */}
				<header className="w-full mb-8">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-sm text-purple-300/70 hover:text-purple-200 transition-colors mb-4"
					>
						← ホームに戻る
					</Link>
					<h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
						空白除去ツール
					</h1>
					<p className="text-purple-200/70 mt-2">
						AIの文字起こしなどに含まれる余計な空白を除去します
					</p>
				</header>

				{/* Options */}
				<section className="w-full mb-6">
					<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-3">
						オプション
					</h2>
					<div className="grid gap-2 sm:grid-cols-2">
						{options.map((option) => (
							<button
								key={option.id}
								type="button"
								onClick={() => toggleOption(option.id)}
								className={`text-left rounded-xl border p-3 transition-all duration-200 ${
									option.enabled
										? "border-fuchsia-500/50 bg-fuchsia-500/10"
										: "border-white/10 bg-white/5 opacity-60"
								}`}
							>
								<div className="flex items-center gap-2">
									<div
										className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
											option.enabled
												? "border-fuchsia-400 bg-fuchsia-500"
												: "border-white/30"
										}`}
									>
										{option.enabled && (
											<svg
												className="w-3 h-3 text-white"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<title>チェック</title>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={3}
													d="M5 13l4 4L19 7"
												/>
											</svg>
										)}
									</div>
									<span className="font-medium text-sm text-purple-100">
										{option.label}
									</span>
								</div>
								<p className="text-xs text-purple-200/50 mt-1 ml-6">
									{option.description}
								</p>
							</button>
						))}
					</div>
				</section>

				{/* Input/Output */}
				<div className="w-full grid gap-4 lg:grid-cols-2">
					{/* Input */}
					<div>
						<label
							htmlFor="input-text"
							className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-3 block"
						>
							入力
						</label>
						<textarea
							id="input-text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="ここにテキストを貼り付けてください..."
							className="w-full h-64 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-purple-100 placeholder:text-purple-300/30 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 resize-none font-mono text-sm"
						/>
					</div>

					{/* Output */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<label
								htmlFor="output-text"
								className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80"
							>
								出力
							</label>
							<button
								type="button"
								onClick={handleCopy}
								disabled={!output}
								className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
									copied
										? "bg-green-500/20 text-green-300 border border-green-500/30"
										: "bg-white/10 text-purple-200 border border-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
								}`}
							>
								{copied ? "コピーしました!" : "コピー"}
							</button>
						</div>
						<textarea
							id="output-text"
							value={output}
							readOnly
							className="w-full h-64 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-purple-100 focus:outline-none resize-none font-mono text-sm"
						/>
					</div>
				</div>

				{/* Stats */}
				{input.length > 0 && (
					<div className="w-full mt-4 flex flex-wrap gap-4 justify-center text-sm text-purple-200/60">
						<span>入力: {stats.inputLength.toLocaleString()}文字</span>
						<span>出力: {stats.outputLength.toLocaleString()}文字</span>
						<span
							className={
								stats.removed > 0 ? "text-fuchsia-300" : "text-purple-200/60"
							}
						>
							削除: {stats.removed.toLocaleString()}文字
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
