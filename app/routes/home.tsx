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
	{ name: "Java", level: 90, color: "from-red-400 to-orange-400" },
	{ name: "Go", level: 90, color: "from-cyan-400 to-sky-400" },
	{ name: "Node.js", level: 70, color: "from-green-400 to-emerald-400" },
	{ name: "Python", level: 65, color: "from-yellow-400 to-orange-400" },
	{ name: "Terraform", level: 65, color: "from-violet-400 to-purple-400" },
	{ name: "AWS / GCP", level: 80, color: "from-amber-400 to-yellow-400" },
	{ name: "React / TypeScript", level: 50, color: "from-blue-400 to-cyan-400" },
	{ name: "AI / LLM", level: 45, color: "from-pink-400 to-rose-400" },
	{ name: "Rap / Lyric Writing", level: 95, color: "from-fuchsia-400 to-pink-400" },
];

const timeline = [
	{ year: "2024", event: "宮台真司 荒野塾・高野塾に参加" },
	{ year: "2023", event: "NWU に参加、楽曲制作活動開始" },
	{ year: "2020", event: "Go を書き始める。クラウドインフラ (AWS/GCP) にも注力" },
	{ year: "2015", event: "ITベンチャーに就職。Java / Node.js をメインにエンジニアキャリアをスタート" },
	{ year: "2013", event: "大学卒業後、情報系の研究室に進学。ラップ活動を開始" },
	{ year: "2009", event: "大学入学。放送研究部・映画研究部に所属し、映画制作やラジオ番組の制作に打ち込む" },
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
						Server-side Engineer / Rapper / Sociology
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
							サーバーサイドをメインとするITエンジニア。2015年からのキャリアで、Java
							/ Go を中心にバックエンド開発を行っています。Node.js、Python、Terraform
							も実務経験があり、AWS・GCP
							等のクラウドインフラの設計・構築・運用も対応できます。
						</p>
						<p>
							フロントエンドは React / TypeScript
							を触った経験があり、このサイト自体も React Router + Cloudflare Workers
							で構築しています。最近は AI / LLM
							の活用にも取り組んでおり、LLMを使ったアプリケーション開発も行っています。
						</p>
						<p>
							大学時代は放送研究部・映画研究部で映画制作やラジオ番組の制作に没頭。卒業後は情報系の研究室に進み、そこからラッパーとしての作詞・パフォーマンス活動も始めました。社会学、特に宮台真司氏の理論に関心があり、2024年から荒野塾・高野塾に参加しています。
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
					<div className="space-y-6">
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

						{/* YouTube Embeds */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
								<div className="aspect-video">
									<iframe
										src="https://www.youtube.com/embed/4t5oGnl8Peg"
										title="NWU 楽曲"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
										className="w-full h-full"
									/>
								</div>
								<div className="px-4 py-3">
									<p className="text-sm font-semibold">NWU 楽曲</p>
									<p className="text-xs text-purple-200/60">YouTube</p>
								</div>
							</div>
							<div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
								<div className="aspect-video">
									<iframe
										src="https://www.youtube.com/embed/Tm4OiXDAarM"
										title="NWU CM"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
										className="w-full h-full"
									/>
								</div>
								<div className="px-4 py-3">
									<p className="text-sm font-semibold">NWU CM</p>
									<p className="text-xs text-purple-200/60">YouTube</p>
								</div>
							</div>
						</div>

						{/* Spotify Embed */}
						<div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
							<iframe
								src="https://open.spotify.com/embed/show/3c3lDQN4RjCMgiPW0UM10G?utm_source=generator&theme=0"
								title="デモクラジオ"
								allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
								loading="lazy"
								className="w-full h-40 sm:h-52"
							/>
						</div>
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
