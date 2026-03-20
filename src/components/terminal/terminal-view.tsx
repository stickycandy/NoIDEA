"use client"

import { useEffect, useRef } from "react"
import { listen } from "@tauri-apps/api/event"
import { terminalWrite, terminalResize } from "@/lib/tauri"
import { disposeTauriListener } from "@/lib/tauri-listener"
import type { TerminalEvent } from "@/lib/types"
import type { ITheme } from "@xterm/xterm"

const DARK_THEME: ITheme = {
  background: "rgba(44, 49, 60, 0.72)",
  foreground: "#abb2bf",
  cursor: "#528bff",
  cursorAccent: "rgba(44, 49, 60, 0.72)",
  selectionBackground: "rgba(82, 139, 255, 0.22)",
  black: "#282c34",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#abb2bf",
  brightBlack: "#5c6370",
  brightRed: "#ef596f",
  brightGreen: "#89ca78",
  brightYellow: "#e5c07b",
  brightBlue: "#61afef",
  brightMagenta: "#d55fde",
  brightCyan: "#2bbac5",
  brightWhite: "#ffffff",
}

const LIGHT_THEME: ITheme = {
  background: "rgba(255, 255, 255, 0.7)",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  cursorAccent: "rgba(255, 255, 255, 0.7)",
  selectionBackground: "#b4d5fe",
  black: "#1a1a1a",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#e5e5e5",
  brightBlack: "#a3a3a3",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#ffffff",
}

function isDarkMode() {
  return document.documentElement.classList.contains("dark")
}

function readThemeColorVariable(name: string): string | null {
  if (typeof document === "undefined") return null

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || null
}

function resolveCssColor(value: string | null): string | null {
  if (typeof document === "undefined" || !value) return null

  const probe = document.createElement("div")
  probe.style.position = "absolute"
  probe.style.pointerEvents = "none"
  probe.style.opacity = "0"
  probe.style.backgroundColor = value
  document.body.appendChild(probe)

  const resolved = getComputedStyle(probe).backgroundColor.trim()
  probe.remove()

  return resolved || null
}

function getTerminalTheme(): ITheme {
  const baseTheme = isDarkMode() ? DARK_THEME : LIGHT_THEME
  const background = resolveCssColor(
    readThemeColorVariable("--card") ??
      readThemeColorVariable("--background") ??
      readThemeColorVariable("--terminal-background")
  )
  const foreground = resolveCssColor(
    readThemeColorVariable("--card-foreground") ??
      readThemeColorVariable("--foreground") ??
      readThemeColorVariable("--terminal-foreground")
  )
  if (!background) return baseTheme

  return {
    ...baseTheme,
    background,
    cursorAccent: background,
    ...(foreground ? { foreground } : {}),
  }
}

interface TerminalViewProps {
  terminalId: string
  isActive: boolean
  isVisible: boolean
}

export function TerminalView({
  terminalId,
  isActive,
  isVisible,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<{ fit: () => void } | null>(null)
  const termRef = useRef<{ focus: () => void } | null>(null)
  const lastResizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const isActiveRef = useRef(isActive)
  const isVisibleRef = useRef(isVisible)

  useEffect(() => {
    isActiveRef.current = isActive
    isVisibleRef.current = isVisible
  }, [isActive, isVisible])

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    async function init() {
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")
      const { WebLinksAddon } = await import("@xterm/addon-web-links")

      if (cancelled || !containerRef.current) return

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: getTerminalTheme(),
        allowTransparency: true,
        allowProposedApi: true,
      })

      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)
      term.open(containerRef.current)

      fitAddonRef.current = fitAddon
      termRef.current = term

      // Watch <html> class changes for theme switching
      const themeObserver = new MutationObserver(() => {
        term.options.theme = getTerminalTheme()
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"],
      })

      // Send input to PTY
      const onDataDisposable = term.onData((data: string) => {
        // Some apps toggle focus reporting; don't leak focus in/out sequences
        // into the shell prompt when tabs are switched.
        if (data === "\x1b[I" || data === "\x1b[O") return
        terminalWrite(terminalId, data).catch(() => {})
      })

      // Debounced resize — avoid flooding IPC during drag
      let resizeTimer: ReturnType<typeof setTimeout> | null = null
      const onResizeDisposable = term.onResize(
        ({ cols, rows }: { cols: number; rows: number }) => {
          const last = lastResizeRef.current
          if (last && last.cols === cols && last.rows === rows) return
          lastResizeRef.current = { cols, rows }
          if (resizeTimer) clearTimeout(resizeTimer)
          resizeTimer = setTimeout(() => {
            terminalResize(terminalId, cols, rows).catch(() => {})
          }, 50)
        }
      )

      // Set up event listeners BEFORE fit so initial output is captured
      const unlisten = await listen<TerminalEvent>(
        `terminal://output/${terminalId}`,
        (event) => {
          term.write(event.payload.data)
        }
      )

      const unlistenExit = await listen<TerminalEvent>(
        `terminal://exit/${terminalId}`,
        () => {
          term.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n")
        }
      )

      if (cancelled) {
        themeObserver.disconnect()
        onDataDisposable.dispose()
        onResizeDisposable.dispose()
        disposeTauriListener(unlisten, "TerminalView.output")
        disposeTauriListener(unlistenExit, "TerminalView.exit")
        term.dispose()
        return
      }

      const fitIfReady = () => {
        const el = containerRef.current
        if (!el) return
        if (!isActiveRef.current || !isVisibleRef.current) return
        if (el.clientWidth <= 0 || el.clientHeight <= 0) return
        fitAddon.fit()
      }

      // Only fit when terminal is actually visible/active.
      requestAnimationFrame(() => {
        if (!cancelled) fitIfReady()
      })

      // Debounced fit on container resize while active
      let fitTimer: ReturnType<typeof setTimeout> | null = null
      const resizeObserver = new ResizeObserver(() => {
        if (fitTimer) clearTimeout(fitTimer)
        fitTimer = setTimeout(() => {
          fitIfReady()
        }, 30)
      })
      resizeObserver.observe(containerRef.current)

      cleanup = () => {
        if (resizeTimer) clearTimeout(resizeTimer)
        if (fitTimer) clearTimeout(fitTimer)
        themeObserver.disconnect()
        onDataDisposable.dispose()
        onResizeDisposable.dispose()
        disposeTauriListener(unlisten, "TerminalView.output")
        disposeTauriListener(unlistenExit, "TerminalView.exit")
        resizeObserver.disconnect()
        term.dispose()
        fitAddonRef.current = null
        termRef.current = null
        lastResizeRef.current = null
      }
    }

    init()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [terminalId])

  // Refit and focus when becoming active or panel becomes visible
  useEffect(() => {
    if (isActive && isVisible) {
      requestAnimationFrame(() => {
        const el = containerRef.current
        if (el && el.clientWidth > 0 && el.clientHeight > 0) {
          fitAddonRef.current?.fit()
        }
        termRef.current?.focus()
      })
    }
  }, [isActive, isVisible])

  return (
    <div
      className="absolute inset-0 h-full w-full p-2"
      style={{
        visibility: isActive ? "visible" : "hidden",
        pointerEvents: isActive ? "auto" : "none",
      }}
      aria-hidden={!isActive}
    >
      <div
        ref={containerRef}
        className="h-full w-full rounded-xl bg-transparent"
      />
    </div>
  )
}
