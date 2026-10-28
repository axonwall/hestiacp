"use client";

import { useEffect, useRef } from "react";

/**
 * Web terminal (web/js/src/webTerminal.js, ported): xterm opens
 * on the container and talks to the standalone terminal service
 * over wss://<host>/_shell/ (the cutover vhost proxies that path
 * to localhost:8085). The service authenticates the browser's
 * HESTIASID cookie — the same cookie this panel sets — and
 * validates the session through its PHP helper, so no token
 * passing is needed here. Error/close handling mirrors PHP's.
 *
 * xterm is imported dynamically: it touches the DOM and has
 * no place in the server render. The fit addon sizes the
 * terminal to the container; PHP instead picks the WebGL or
 * canvas renderer addon, while xterm's default canvas
 * renderer is used here.
 */
export default function Terminal() {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let terminal: import("@xterm/xterm").Terminal | null = null;
		let socket: WebSocket | null = null;
		let fit: import("@xterm/addon-fit").FitAddon | null = null;
		let cancelled = false;
		let dead = false;

		async function start() {
			if (!ref.current) return;
			const { Terminal: XTerm } = await import("@xterm/xterm");
			await import("@xterm/xterm/css/xterm.css");
			const { FitAddon } = await import("@xterm/addon-fit");
			if (cancelled || !ref.current) return;
			terminal = new XTerm();
			fit = new FitAddon();
			terminal.loadAddon(fit);
			terminal.open(ref.current);
			fit.fit();
			const onResize = () => fit?.fit();
			window.addEventListener("resize", onResize);
			socket = new WebSocket(`wss://${window.location.host}/_shell/`);
			socket.addEventListener("open", () => {
				if (dead) {
					socket?.close();
					return;
				}
				terminal?.onData((data) => socket?.send(data));
				socket?.addEventListener("message", (evt) => {
					if (!dead) terminal?.write(evt.data);
				});
			});
			socket.addEventListener("error", () => {
				if (dead) return;
				terminal?.reset();
				terminal?.writeln("Connection error.");
			});
			socket.addEventListener("close", (evt) => {
				if (dead) return;
				if (evt.wasClean) {
					terminal?.reset();
					terminal?.writeln(evt.reason || "Connection closed.");
				}
			});
			return () => window.removeEventListener("resize", onResize);
		}

		const cleanup = start();
		return () => {
			cancelled = true;
			dead = true;
			void cleanup.then((fn) => fn?.());
			socket?.close();
			fit?.dispose();
			terminal?.dispose();
		};
	}, []);

	return <div ref={ref} className="js-web-terminal web-terminal" />;
}
