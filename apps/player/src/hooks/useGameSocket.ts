import { useEffect, useRef, useCallback, useState } from "react";
import type { WsMessage } from "@slyquiz/shared";

const BACKOFF_DELAYS = [500, 1000, 2000, 4000, 8000, 15000];
const MAX_ATTEMPTS = 10;

interface UseGameSocketOptions {
  pin: string;
  sessionToken: string;
  onMessage: (msg: WsMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useGameSocket({
  pin,
  sessionToken,
  onMessage,
  onConnect,
  onDisconnect,
}: UseGameSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const apiHost = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host;
    const url = `${protocol}://${apiHost}/api/games/${pin}/ws?sessionToken=${encodeURIComponent(sessionToken)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      attemptsRef.current = 0;
      setConnected(true);
      setReconnecting(false);
      onConnect?.();

      // Heartbeat ping every 25s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING", ts: Date.now() } satisfies WsMessage));
        }
      }, 25_000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        onMessage(msg);
      } catch {
        console.error("Failed to parse WS message");
      }
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;

      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);

      // Don't reconnect on intentional close (code 4001, 4002)
      if (event.code === 4001 || event.code === 4002) {
        onDisconnect?.();
        return;
      }

      // Exponential backoff reconnect
      if (attemptsRef.current < MAX_ATTEMPTS) {
        setReconnecting(true);
        const delay = BACKOFF_DELAYS[Math.min(attemptsRef.current, BACKOFF_DELAYS.length - 1)] ?? 15000;
        attemptsRef.current += 1;
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      } else {
        setReconnecting(false);
        onDisconnect?.();
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, so let onclose handle reconnect
    };
  }, [pin, sessionToken, onMessage, onConnect, onDisconnect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect]);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, reconnecting, send };
}
