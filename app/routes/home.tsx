import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { desc, sql } from "drizzle-orm";
import { heroImages, activityLog, hiphopTracks } from "../db/schema";
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

export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);

	// 最新のヒーローイメージを取得
	const latest = await db
		.select()
		.from(heroImages)
		.orderBy(desc(heroImages.createdAt))
		.limit(1);

	const heroImage = latest.length > 0 ? latest[0] : null;

	// 最新のHiphopトラックを取得
	const latestTrack = await db
		.select()
		.from(hiphopTracks)
		.orderBy(desc(hiphopTracks.date))
		.limit(1);

	const track = latestTrack.length > 0 ? latestTrack[0] : null;

	// アクティビティログを取得（直近20件）
	const activities = await db
		.select({
			id: activityLog.id,
			type: activityLog.type,
			message: activityLog.message,
			metadata: activityLog.metadata,
			createdAt: activityLog.createdAt,
		})
		.from(activityLog)
		.orderBy(desc(activityLog.createdAt))
		.limit(20);

	// 古いアクティビティを削除（30日以上前）
	const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
	await db
		.delete(activityLog)
		.where(sql`${activityLog.createdAt} < ${thirtyDaysAgo}`);

	return {
		heroImage: heroImage
			? { date: heroImage.date, source: heroImage.source }
			: null,
		latestTrack: track
			? {
					date: track.date,
					title: track.title,
					style: track.style,
					duration: track.duration,
					source: track.source,
					hasRap: !!track.rapTrackKey,
				}
			: null,
		activities: activities.map((a) => ({
			id: a.id,
			type: a.type,
			message: a.message,
			metadata: a.metadata,
			createdAt: a.createdAt?.getTime() ?? Date.now(),
		})),
	};
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
	{ year: "2025", event: "NWU に参加。楽曲制作・Vlog・HP制作を開始" },
	{ year: "2024", event: "宮台真司 荒野塾・界隈塾に参加" },
	{ year: "2020", event: "Go を書き始める。クラウドインフラ (AWS/GCP) にも注力" },
	{ year: "2015", event: "ITベンチャーに就職。Java / Node.js をメインにエンジニアキャリアをスタート" },
	{ year: "2013", event: "大学卒業後、情報系の研究室に進学。ラップ活動を開始" },
	{ year: "2009", event: "大学入学。放送研究部・映画研究部に所属し、映画制作やラジオ番組の制作に打ち込む" },
];

const activityIcons: Record<string, string> = {
	deploy: "rocket",
	cron_aitter: "bot",
	cron_hero_image: "palette",
	cron_news_scrape: "newspaper",
};

const activityLabels: Record<string, string> = {
	deploy: "Deploy",
	cron_aitter: "AItter",
	cron_hero_image: "Hero Image",
	cron_news_scrape: "Scrape",
};

function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return "たった今";
	if (minutes < 60) return `${minutes}分前`;
	if (hours < 24) return `${hours}時間前`;
	if (days < 30) return `${days}日前`;
	return `${Math.floor(days / 30)}ヶ月前`;
}

function ActivityIcon({ type }: { type: string }) {
	const icon = activityIcons[type] ?? "activity";
	switch (icon) {
		case "rocket":
			return (
				<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
					<path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
					<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
					<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
				</svg>
			);
		case "bot":
			return (
				<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M12 8V4H8" />
					<rect width="16" height="12" x="4" y="8" rx="2" />
					<path d="M2 14h2" />
					<path d="M20 14h2" />
					<path d="M15 13v2" />
					<path d="M9 13v2" />
				</svg>
			);
		case "palette":
			return (
				<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
					<circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
					<circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
					<circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
					<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
				</svg>
			);
		case "newspaper":
			return (
				<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
					<path d="M18 14h-8" />
					<path d="M15 18h-5" />
					<path d="M10 6h8v4h-8V6Z" />
				</svg>
			);
		default:
			return (
				<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10" />
					<path d="M12 6v6l4 2" />
				</svg>
			);
	}
}

function FixedBottomPlayer({
	track,
}: {
	track: {
		date: string;
		title: string | null;
		style: string | null;
		duration: number | null;
		source: string;
		hasRap: boolean;
	};
}) {
	const audioSrc = track.hasRap
		? `/daily-track/audio/${track.date}/rap`
		: `/daily-track/audio/${track.date}/instrumental`;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/10">
			<div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
				{/* トラック情報 */}
				<Link
					to="/daily-track"
					className="flex-1 min-w-0 flex items-center gap-3 group"
				>
					<div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-fuchsia-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M9 18V5l12-3v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="15" r="3" />
						</svg>
					</div>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-white truncate group-hover:text-fuchsia-200 transition-colors">
							{track.title || "Untitled Track"}
						</p>
						<div className="flex items-center gap-1.5">
							<span className="text-[10px] text-purple-300/50">{track.date}</span>
							{track.hasRap && (
								<span className="text-[10px] text-cyan-400/60">Rap</span>
							)}
						</div>
					</div>
				</Link>
				{/* オーディオプレイヤー */}
				<div className="flex-shrink-0 w-48 sm:w-72">
					<audio
						controls
						preload="none"
						src={audioSrc}
						className="w-full h-8"
					/>
				</div>
			</div>
		</div>
	);
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { heroImage, latestTrack, activities } = loaderData;

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
				<section className="text-center mb-20 pt-8 w-full max-w-4xl">
					<div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30 text-sm text-fuchsia-300">
						Software Engineer / Rapper / Sociology
					</div>
					<h1 className="text-6xl sm:text-7xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
						hidelberq
					</h1>
					<p className="text-lg text-purple-200/80 max-w-md mx-auto leading-relaxed mb-8">
						ソフトウェアエンジニア。ラッパー。社会学(宮台真司氏など)に興味あります
					</p>
					{heroImage ? (
						<div className="w-full mx-auto">
							<div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-fuchsia-500/10">
								<img
									src={`/hero-image/${heroImage.date}`}
									alt={`Daily hero image - ${heroImage.date}`}
									className="w-full aspect-video object-cover"
								/>
								<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
									<span className="text-xs text-white/60">
										{heroImage.source === "diary" ? "from diary" : "from weather"} - {heroImage.date}
									</span>
								</div>
							</div>
						</div>
					) : null}
				</section>

				{/* Activity Feed */}
				{activities.length > 0 && (
					<section className="w-full max-w-2xl mb-16">
						<SectionHeading>Activity</SectionHeading>
						<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
							<div className="divide-y divide-white/5">
								{activities.map((activity) => (
									<div
										key={activity.id}
										className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
									>
										<div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-fuchsia-300">
											<ActivityIcon type={activity.type} />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<span className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-400/70 bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
													{activityLabels[activity.type] ?? activity.type}
												</span>
												<span className="text-[11px] text-purple-300/40">
													{formatRelativeTime(activity.createdAt)}
												</span>
											</div>
											<p className="text-sm text-purple-100/80 truncate">
												{activity.message}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
				)}

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
							大学時代は放送研究部・映画研究部で映画制作やラジオ番組の制作に没頭。卒業後は情報系の研究室に進み、そこからラッパーとしての作詞・パフォーマンス活動も始めました。社会学、特に宮台真司氏の理論に関心があり、2024年から荒野塾・界隈塾に参加しています。
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
							to="/daily-track"
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10"
						>
							<span className="text-2xl leading-none">🎤</span>
							<div>
								<span className="text-lg font-semibold">Daily Hiphop Track</span>
								<p className="text-sm text-purple-200/60">
									日記からAIが毎日生成するHiphopビート
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
						<Link
							to="/whitespace-remover"
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10"
						>
							<span className="text-2xl leading-none">✂️</span>
							<div>
								<span className="text-lg font-semibold">空白除去</span>
								<p className="text-sm text-purple-200/60">
									AIの文字起こしの余計な空白を除去
								</p>
							</div>
						</Link>
						<Link
							to="/tsundoku_2_0"
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10"
						>
							<span className="text-2xl leading-none">📚</span>
							<div>
								<span className="text-lg font-semibold">積読 2.0</span>
								<p className="text-sm text-purple-200/60">
									写真を撮るだけ。AIが本を自動認識してリスト化
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
				<footer className={`text-center text-sm text-purple-300/40 mt-8 ${latestTrack ? "pb-16" : ""}`}>
					&copy; {new Date().getFullYear()} hidelberq
				</footer>
			</div>

			{/* 画面下部固定プレイヤー */}
			{latestTrack && <FixedBottomPlayer track={latestTrack} />}
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
