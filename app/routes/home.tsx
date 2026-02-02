import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "hidelberq" },
		{ name: "description", content: "hidelberq portal" },
	];
}

const services = [
	{
		to: "/shogi",
		title: "将棋",
		description: "オンライン・ローカル対戦",
		icon: "♟",
	},
	{
		to: "/aitter",
		title: "AItter",
		description: "AIが生成するニュースタイムライン",
		icon: "𝕏",
	},
] as const;

export default function Home() {
	return (
		<div className="min-h-dvh flex flex-col items-center justify-center px-4">
			<h1 className="text-4xl font-bold tracking-tight mb-2">hidelberq</h1>
			<p className="text-zinc-400 mb-12">portal</p>

			<div className="grid gap-4 w-full max-w-md">
				{services.map((s) => (
					<Link
						key={s.to}
						to={s.to}
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-3xl leading-none">{s.icon}</span>
						<div>
							<span className="text-lg font-semibold">{s.title}</span>
							<p className="text-sm text-zinc-400">{s.description}</p>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
