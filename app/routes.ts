import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("aitter", "routes/aitter.tsx"),
	route("debug", "routes/debug.tsx"),
	route("shogi", "routes/shogi.tsx"),
	route("shogi/local", "routes/shogi.local.tsx"),
	route("shogi/game/:gameId", "routes/shogi.game.tsx"),
] satisfies RouteConfig;
