import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "hidelberq" },
		{
			name: "description",
			content:
				"hidelberq - ITエンジニア / ラッパー / 社会学",
		},
	];
}

const skills = [
	{ name: "TypeScript", level: 90, color: "from-blue-400 to-cyan-400" },
	{ name: "React", level: 85, color: "from-cyan-400 to-teal-400" },
	{ name: "Cloudflare Workers", level: 80, color: "from-orange-400 to-amber-400" },
	{ name: "Node.js", level: 85, color: "from-green-400 to-emerald-400" },
	{ name: "Python", level: 70, color: "from-yellow-400 to-orange-400" },
	{ name: "Rap / Lyric Writing", level: 95, color: "from-pink-400 to-rose-400" },
];

const projects = [
	{
		title: "AItter",
		description: "AIが最新ニュースを読み、つぶやくタイムライン。LLMを活用したニュースキュレーション。",
		tags: ["React", "Cloudflare Workers", "AI/LLM", "D1"],
		emoji: "🤖",
		link: "/aitter",
		internal: true,
	},
	{
		title: "将棋オンライン",
		description: "ブラウザで遊べるオンライン・ローカル対戦将棋。5x5ミニ将棋モードも搭載。",
		tags: ["React", "TypeScript", "Game Logic"],
		emoji: "♟️",
		link: "/shogi",
		internal: true,
	},
	{
		title: "Beat Machine",
		description: "ブラウザ上で動作するビートメイキングツール。サンプラーとシーケンサーを搭載。",
		tags: ["Web Audio API", "React", "TypeScript"],
		emoji: "🥁",
		link: null,
		internal: false,
	},
	{
		title: "Lyric Flow",
		description: "ラッパー向けの作詞支援アプリ。韻検索とフロー分析機能付き。",
		tags: ["NLP", "Python", "FastAPI", "React"],
		emoji: "🎤",
		link: null,
		internal: false,
	},
];

const timeline = [
	{ year: "2024", event: "Cloudflare Workers でのフルスタック開発に注力" },
	{ year: "2023", event: "NWU に参加、楽曲制作・ラップ活動開始" },
	{ year: "2022", event: "宮台真司 荒野塾・界隈塾に参加" },
	{ year: "2021", event: "React / TypeScript を中心にフロントエンド開発" },
	{ year: "2020", event: "Web 開発のキャリアをスタート" },
];

export default function Home() {
	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			{/* Decorative blobs */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
				<div className="absolute -bottom-20 right-1/3 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				{/* Hero */}
				<section className="text-center mb-20 pt-8">
					<div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30 text-sm text-fuchsia-300">
						IT Engineer / Rapper / Sociology
					</div>
					<h1 className="text-6xl sm:text-7xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
						hidelberq
					</h1>
					<p className="text-lg text-purple-200/80 max-w-md mx-auto leading-relaxed">
						ITエンジニア。ラッパー。社会学(宮台真司氏など)に興味あります
					</p>
				</section>

				{/* About */}
				<section className="w-full max-w-2xl mb-16">
					<SectionHeading>About</SectionHeading>
					<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-3 text-purple-100/90 leading-relaxed">
						<p>
							Web開発を中心に活動するITエンジニア。React / TypeScript / Cloudflare
							を軸としたモダンなフルスタック開発が得意です。
						</p>
						<p>
							音楽活動ではラッパーとして作詞・パフォーマンスを行い、テクノロジーとカルチャーの交差点を探求しています。
						</p>
						<p>
							社会学、特に宮台真司氏の理論に関心があり、荒野塾・界隈塾に通っていました。社会システム理論やサブカルチャー分析の視点を大切にしています。
						</p>
						<p>
							<a
								href="https://nw-union.net/"
								target="_blank"
								rel="noopener noreferrer"
								className="font-semibold text-fuchsia-300 hover:text-fuchsia-200 transition-colors underline underline-offset-2"
							>
								NWU (nw-union.net)
							</a>{" "}
							所属。
						</p>
					</div>
				</section>

				{/* Skills */}
				<section className="w-full max-w-2xl mb-16">
					<SectionHeading>Skills</SectionHeading>
					<div className="grid gap-4">
						{skills.map((skill) => (
							<div key={skill.name} className="group">
								<div className="flex justify-between mb-1.5">
									<span className="text-sm font-medium text-purple-100">
										{skill.name}
									</span>
									<span className="text-sm text-purple-300/70">
										{skill.level}%
									</span>
								</div>
								<div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
									<div
										className={`h-full rounded-full bg-gradient-to-r ${skill.color} transition-all duration-500`}
										style={{ width: `${skill.level}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Projects */}
				<section className="w-full max-w-2xl mb-16">
					<SectionHeading>Projects</SectionHeading>
					<div className="grid gap-4 sm:grid-cols-2">
						{projects.map((project) => {
							const content = (
								<>
									<span className="text-3xl mb-3 block">
										{project.emoji}
									</span>
									<h3 className="text-lg font-semibold mb-2 text-white">
										{project.title}
									</h3>
									<p className="text-sm text-purple-200/70 mb-4 leading-relaxed">
										{project.description}
									</p>
									<div className="flex flex-wrap gap-1.5 mt-auto">
										{project.tags.map((tag) => (
											<span
												key={tag}
												className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-purple-200/80 border border-white/5"
											>
												{tag}
											</span>
										))}
									</div>
								</>
							);
							const className =
								"flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10";

							return project.internal && project.link ? (
								<Link
									key={project.title}
									to={project.link}
									className={className}
								>
									{content}
								</Link>
							) : (
								<div key={project.title} className={className}>
									{content}
								</div>
							);
						})}
					</div>
				</section>

				{/* Timeline */}
				<section className="w-full max-w-2xl mb-16">
					<SectionHeading>Timeline</SectionHeading>
					<div className="relative pl-6 border-l-2 border-fuchsia-500/30 space-y-6">
						{timeline.map((item) => (
							<div key={item.year} className="relative">
								<div className="absolute -left-[1.6rem] top-1 w-3 h-3 rounded-full bg-fuchsia-500 border-2 border-fuchsia-300" />
								<span className="text-sm font-bold text-fuchsia-300">
									{item.year}
								</span>
								<p className="text-purple-100/80 mt-0.5">
									{item.event}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* Apps */}
				<section className="w-full max-w-2xl mb-16">
					<SectionHeading>Apps</SectionHeading>
					<div className="grid gap-3">
						<Link
							to="/aitter"
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10"
						>
							<span className="text-2xl leading-none">🤖</span>
							<div>
								<span className="text-lg font-semibold">AItter</span>
								<p className="text-sm text-purple-200/60">
									AIが最新ニュースを読み、つぶやくタイムライン
								</p>
							</div>
						</Link>
						<Link
							to="/shogi"
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10"
						>
							<span className="text-2xl leading-none">♟️</span>
							<div>
								<span className="text-lg font-semibold">将棋</span>
								<p className="text-sm text-purple-200/60">
									オンライン・ローカル対戦
								</p>
							</div>
						</Link>
					</div>
				</section>

				{/* NWU */}
				<section className="w-full max-w-2xl mb-16">
					<SectionHeading>NWU</SectionHeading>
					<div className="grid gap-3 sm:grid-cols-2">
						<ExternalCard
							href="https://nw-union.net/"
							icon={
								<span className="text-2xl font-bold leading-none">
									NWU
								</span>
							}
							title="nw-union.net"
							description="NWU 公式サイト"
						/>
						<ExternalCard
							href="https://youtu.be/4t5oGnl8Peg"
							icon={<span className="text-2xl leading-none">🎵</span>}
							title="NWU 楽曲"
							description="YouTube"
						/>
						<ExternalCard
							href="https://youtu.be/Tm4OiXDAarM"
							icon={<span className="text-2xl leading-none">📺</span>}
							title="NWU CM"
							description="YouTube"
						/>
						<ExternalCard
							href="https://open.spotify.com/show/3c3lDQN4RjCMgiPW0UM10G?si=b73a7ba0ef2a496d"
							icon={<span className="text-2xl leading-none">🎙️</span>}
							title="デモクラジオ"
							description="Spotify Podcast"
						/>
					</div>
				</section>

				{/* Footer */}
				<footer className="text-center text-sm text-purple-300/40 mt-8">
					&copy; {new Date().getFullYear()} hidelberq
				</footer>
			</div>
		</div>
	);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-5">
			{children}
		</h2>
	);
}

function ExternalCard({
	href,
	icon,
	title,
	description,
}: {
	href: string;
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-pink-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-pink-500/10"
		>
			{icon}
			<div>
				<span className="text-lg font-semibold">{title}</span>
				<p className="text-sm text-purple-200/60">{description}</p>
			</div>
		</a>
	);
}
