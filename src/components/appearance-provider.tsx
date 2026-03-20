"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { getSystemAppearanceSettings } from "@/lib/tauri"
import { disposeTauriListener } from "@/lib/tauri-listener"
import type { SystemAppearanceSettings } from "@/lib/types"

interface AppearanceContextValue {
  appearanceSettings: SystemAppearanceSettings
  appearanceSettingsLoaded: boolean
  setAppearanceSettings: (settings: SystemAppearanceSettings) => void
}

const APPEARANCE_SETTINGS_UPDATED_EVENT = "app://appearance-settings-updated"
const APPEARANCE_SETTINGS_STORAGE_KEY = "noidea:appearance-settings"
const DEFAULT_APPEARANCE_SETTINGS: SystemAppearanceSettings = {
  window_opacity: 78,
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function normalizeAppearanceSettings(
  settings: Partial<SystemAppearanceSettings> | null | undefined
): SystemAppearanceSettings {
  const rawOpacity = settings?.window_opacity
  const opacity =
    typeof rawOpacity === "number" && Number.isFinite(rawOpacity)
      ? Math.round(rawOpacity)
      : DEFAULT_APPEARANCE_SETTINGS.window_opacity

  return {
    window_opacity: Math.max(20, Math.min(100, opacity)),
  }
}

function persistAppearanceSettings(settings: SystemAppearanceSettings) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      APPEARANCE_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    )
  } catch {
    // Ignore storage write failures.
  }
}

function applyAppearanceSettingsToDocument(settings: SystemAppearanceSettings) {
  if (typeof document === "undefined") return

  document.documentElement.style.setProperty(
    "--window-opacity",
    `${settings.window_opacity / 100}`
  )
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) {
    throw new Error("useAppearance must be used within AppearanceProvider")
  }
  return context
}

interface AppearanceProviderProps {
  children: React.ReactNode
}

export function AppearanceProvider({ children }: AppearanceProviderProps) {
  const [appearanceSettings, setAppearanceSettingsState] =
    useState<SystemAppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS)
  const [appearanceSettingsLoaded, setAppearanceSettingsLoaded] =
    useState(false)
  const lastAppliedRef = useRef<string>("")

  const setAppearanceSettings = useCallback(
    (settings: SystemAppearanceSettings) => {
      const normalized = normalizeAppearanceSettings(settings)
      setAppearanceSettingsState(normalized)
      persistAppearanceSettings(normalized)
    },
    []
  )

  useEffect(() => {
    const serialized = JSON.stringify(appearanceSettings)
    if (lastAppliedRef.current === serialized) return
    lastAppliedRef.current = serialized
    applyAppearanceSettingsToDocument(appearanceSettings)
  }, [appearanceSettings])

  useEffect(() => {
    if (typeof window === "undefined") return

    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== APPEARANCE_SETTINGS_STORAGE_KEY ||
        event.newValue == null
      ) {
        return
      }

      try {
        setAppearanceSettingsState(
          normalizeAppearanceSettings(
            JSON.parse(event.newValue) as SystemAppearanceSettings
          )
        )
      } catch {
        // Ignore malformed storage payloads.
      }
    }

    window.addEventListener("storage", onStorage)

    let unlisten: (() => void) | null = null
    let cancelled = false

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<SystemAppearanceSettings>(
          APPEARANCE_SETTINGS_UPDATED_EVENT,
          (event) => {
            if (cancelled) return
            setAppearanceSettings(event.payload)
          }
        )
      )
      .then((dispose) => {
        if (cancelled) {
          disposeTauriListener(dispose, "AppearanceProvider.settings")
          return
        }
        unlisten = dispose
      })
      .catch(() => {
        // Ignore when running in non-tauri environment.
      })

    return () => {
      cancelled = true
      window.removeEventListener("storage", onStorage)
      disposeTauriListener(unlisten, "AppearanceProvider.settings")
    }
  }, [setAppearanceSettings])

  useEffect(() => {
    let cancelled = false

    getSystemAppearanceSettings()
      .then((settings) => {
        if (cancelled) return
        setAppearanceSettings(settings)
      })
      .catch((err) => {
        console.error("[appearance] load appearance settings failed:", err)
      })
      .finally(() => {
        if (!cancelled) {
          setAppearanceSettingsLoaded(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [setAppearanceSettings])

  const value = useMemo(
    () => ({
      appearanceSettings,
      appearanceSettingsLoaded,
      setAppearanceSettings,
    }),
    [appearanceSettings, appearanceSettingsLoaded, setAppearanceSettings]
  )

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}
