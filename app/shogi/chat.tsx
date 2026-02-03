import { useState, useCallback, useEffect, useRef } from "react";
import type { Player } from "./types";

// =====================
// チャットメッセージ型
// =====================

export interface ChatMessage {
	id: string;
	player: Player;
	content: string;
	isEmote: boolean;
	timestamp: number;
}

// =====================
// プリセットエモート
// =====================

export const EMOTES = [
	{ label: "よろしく", icon: "🤝" },
	{ label: "好手！", icon: "👏" },
	{ label: "なるほど", icon: "🤔" },
	{ label: "すごい！", icon: "✨" },
	{ label: "考え中…", icon: "💭" },
	{ label: "参りました", icon: "🙇" },
	{ label: "ありがとう", icon: "🙏" },
	{ label: "おっと", icon: "😲" },
] as const;

// =====================
// チャットパネル
// =====================

export function GameChatPanel({
	messages,
	currentPlayer,
	onSendMessage,
	onSendEmote,
}: {
	messages: ChatMessage[];
	currentPlayer: Player;
	onSendMessage: (text: string, player: Player) => void;
	onSendEmote: (emote: string, player: Player) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	const handleSend = useCallback(() => {
		const text = inputValue.trim();
		if (!text) return;
		onSendMessage(text, currentPlayer);
		setInputValue("");
	}, [inputValue, currentPlayer, onSendMessage]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	return (
		<div className="w-full max-w-lg">
			{/* チャットトグルボタン */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between px-3 py-2 bg-gray-900/60 border border-gray-800 rounded-lg text-xs text-gray-400 hover:bg-gray-800/60 transition-colors"
			>
				<span className="flex items-center gap-1.5">
					<span>💬</span>
					<span>チャット</span>
					{messages.length > 0 && (
						<span className="bg-gray-700 text-gray-300 rounded-full px-1.5 py-0.5 text-[10px] min-w-[1.25rem] text-center">
							{messages.length}
						</span>
					)}
				</span>
				<span
					className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
				>
					▾
				</span>
			</button>

			{isOpen && (
				<div className="mt-1 border border-gray-800 rounded-lg bg-gray-900/80 overflow-hidden">
					{/* エモートバー */}
					<div className="flex gap-1 p-2 border-b border-gray-800 overflow-x-auto">
						{EMOTES.map((emote) => (
							<button
								key={emote.label}
								type="button"
								onClick={() => onSendEmote(emote.label, currentPlayer)}
								className="flex-shrink-0 px-2 py-1 bg-gray-800/80 hover:bg-gray-700/80 rounded text-xs transition-colors flex items-center gap-1"
								title={emote.label}
							>
								<span>{emote.icon}</span>
								<span className="text-gray-300">{emote.label}</span>
							</button>
						))}
					</div>

					{/* メッセージ一覧 */}
					<div className="h-32 overflow-y-auto p-2 space-y-1">
						{messages.length === 0 && (
							<p className="text-xs text-gray-600 text-center py-4">
								メッセージはまだありません
							</p>
						)}
						{messages.map((msg) => (
							<ChatBubble key={msg.id} message={msg} />
						))}
						<div ref={messagesEndRef} />
					</div>

					{/* 入力欄 */}
					<div className="flex gap-1 p-2 border-t border-gray-800">
						<input
							type="text"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="メッセージを入力..."
							maxLength={100}
							className="flex-1 bg-gray-800/60 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-600 transition-colors"
						/>
						<button
							type="button"
							onClick={handleSend}
							disabled={!inputValue.trim()}
							className="px-3 py-1.5 bg-amber-900/40 hover:bg-amber-900/60 disabled:opacity-30 disabled:hover:bg-amber-900/40 border border-amber-800/50 rounded text-xs transition-colors"
						>
							送信
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// =====================
// チャットバブル
// =====================

function ChatBubble({ message }: { message: ChatMessage }) {
	const playerName = message.player === "sente" ? "先手" : "後手";
	const playerColor =
		message.player === "sente" ? "text-orange-400" : "text-sky-400";

	const emote = message.isEmote
		? EMOTES.find((e) => e.label === message.content)
		: null;

	return (
		<div className="flex items-start gap-1.5 text-xs">
			<span className={`font-bold ${playerColor} flex-shrink-0`}>
				{playerName}
			</span>
			{message.isEmote ? (
				<span className="text-gray-200">
					{emote ? `${emote.icon} ${emote.label}` : message.content}
				</span>
			) : (
				<span className="text-gray-300 break-all">{message.content}</span>
			)}
		</div>
	);
}

// =====================
// フローティングエモート
// =====================

export function EmoteToast({ messages }: { messages: ChatMessage[] }) {
	const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
	const prevLengthRef = useRef(messages.length);

	useEffect(() => {
		if (messages.length > prevLengthRef.current) {
			const newMessages = messages.slice(prevLengthRef.current);
			setVisibleMessages((prev) => [...prev, ...newMessages]);

			// 3秒後に消す
			for (const msg of newMessages) {
				setTimeout(() => {
					setVisibleMessages((prev) =>
						prev.filter((m) => m.id !== msg.id),
					);
				}, 3000);
			}
		}
		prevLengthRef.current = messages.length;
	}, [messages]);

	if (visibleMessages.length === 0) return null;

	return (
		<div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
			{visibleMessages.map((msg) => {
				const playerColor =
					msg.player === "sente" ? "border-orange-800/50" : "border-sky-800/50";
				const bgColor =
					msg.player === "sente"
						? "bg-orange-950/80"
						: "bg-sky-950/80";
				const textColor =
					msg.player === "sente" ? "text-orange-200" : "text-sky-200";
				const emote = msg.isEmote
					? EMOTES.find((e) => e.label === msg.content)
					: null;

				return (
					<div
						key={msg.id}
						className={`${bgColor} ${playerColor} border backdrop-blur-sm rounded-full px-3 py-1 text-sm animate-bounce-in`}
					>
						<span className={textColor}>
							{msg.isEmote && emote
								? `${emote.icon} ${emote.label}`
								: msg.content}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// =====================
// ヘルパー関数
// =====================

export function createChatMessage(
	player: Player,
	content: string,
	isEmote: boolean,
): ChatMessage {
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		player,
		content,
		isEmote,
		timestamp: Date.now(),
	};
}
