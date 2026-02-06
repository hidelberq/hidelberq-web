import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("aitter", "routes/aitter.tsx"),
	route("debug", "routes/debug.tsx"),
	route("hero-image/:date", "routes/hero-image.ts"),
	route("whitespace-remover", "routes/whitespace-remover.tsx"),
	route("shogi", "routes/shogi.tsx"),
	route("shogi/local", "routes/shogi.local.tsx"),
	route("shogi/minishogi/local", "routes/shogi.minishogi-local.tsx"),
	route("shogi/minishogi/game/:gameId", "routes/shogi.minishogi-game.tsx"),
	route("shogi/game/:gameId", "routes/shogi.game.tsx"),
] satisfies RouteConfig;
