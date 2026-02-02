import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "hidelberq" },
		{ name: "description", content: "hidelberq - engineer / sociology" },
	];
}

export default function Home() {
	return (
		<div className="min-h-dvh flex flex-col items-center px-4 py-16">
			{/* Hero */}
			<section className="text-center mb-16">
				<h1 className="text-5xl font-bold tracking-tight mb-3">hidelberq</h1>
				<p className="text-zinc-400 text-lg">Engineer / Sociology</p>
			</section>

			{/* About */}
			<section className="w-full max-w-xl mb-14">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
					About
				</h2>
				<div className="space-y-3 text-zinc-300 leading-relaxed">
					<p>エンジニア。社会学に関心があり、宮台真司の荒野塾・界隈塾に通っていました。</p>
					<p>
						<a
							href="https://nw-union.net/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-white font-semibold hover:underline"
						>
							NWU (nw-union.net)
						</a>
						{" "}所属。
					</p>
				</div>
			</section>

			{/* Apps */}
			<section className="w-full max-w-xl mb-14">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
					Apps
				</h2>
				<div className="grid gap-3">
					<Link
						to="/aitter"
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-2xl leading-none">🤖</span>
						<div>
							<span className="text-lg font-semibold">AItter</span>
							<p className="text-sm text-zinc-400">
								AIが最新ニュースを読み、つぶやくタイムライン
							</p>
						</div>
					</Link>
					<Link
						to="/shogi"
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-2xl leading-none">♟️</span>
						<div>
							<span className="text-lg font-semibold">将棋</span>
							<p className="text-sm text-zinc-400">
								オンライン・ローカル対戦
							</p>
						</div>
					</Link>
				</div>
			</section>

			{/* NWU */}
			<section className="w-full max-w-xl mb-14">
				<h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-4">
					NWU
				</h2>
				<div className="grid gap-3">
					<a
						href="https://nw-union.net/"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-2xl font-bold leading-none">NWU</span>
						<div>
							<span className="text-lg font-semibold">nw-union.net</span>
							<p className="text-sm text-zinc-400">NWU 公式サイト</p>
						</div>
					</a>
					<a
						href="https://youtu.be/4t5oGnl8Peg"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-2xl leading-none">🎵</span>
						<div>
							<span className="text-lg font-semibold">NWU 楽曲</span>
							<p className="text-sm text-zinc-400">YouTube</p>
						</div>
					</a>
					<a
						href="https://youtu.be/Tm4OiXDAarM"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-2xl leading-none">📺</span>
						<div>
							<span className="text-lg font-semibold">NWU CM</span>
							<p className="text-sm text-zinc-400">YouTube</p>
						</div>
					</a>
					<a
						href="https://open.spotify.com/show/3c3lDQN4RjCMgiPW0UM10G?si=b73a7ba0ef2a496d"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition hover:border-zinc-600 hover:bg-zinc-800/80"
					>
						<span className="text-2xl leading-none">🎙️</span>
						<div>
							<span className="text-lg font-semibold">デモクラジオ</span>
							<p className="text-sm text-zinc-400">Spotify Podcast</p>
						</div>
					</a>
				</div>
			</section>
		</div>
	);
}
