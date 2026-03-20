"use client"

import { useEffect, useMemo, useRef } from "react"
import { Droplets, Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useAppearance } from "@/components/appearance-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateSystemAppearanceSettings } from "@/lib/tauri"

type ThemeMode = "system" | "light" | "dark"

export function AppearanceSettings() {
  const t = useTranslations("AppearanceSettings")
  const { theme, resolvedTheme, setTheme } = useTheme()
  const {
    appearanceSettings,
    appearanceSettingsLoaded,
    setAppearanceSettings,
  } = useAppearance()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const resolvedThemeLabel =
    resolvedTheme === "dark"
      ? t("resolvedTheme.dark")
      : resolvedTheme === "light"
        ? t("resolvedTheme.light")
        : t("resolvedTheme.unknown")
  const opacityPercentLabel = useMemo(
    () => `${appearanceSettings.window_opacity}%`,
    [appearanceSettings.window_opacity]
  )

  const handleWindowOpacityChange = (nextValue: number) => {
    setAppearanceSettings({ window_opacity: nextValue })

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateSystemAppearanceSettings({ window_opacity: nextValue }).catch(
        (err) => {
          console.error("[AppearanceSettings] save appearance failed:", err)
        }
      )
    }, 120)
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full space-y-4">
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("sectionTitle")}</h2>
          </div>

          <p className="text-xs text-muted-foreground leading-5">
            {t("sectionDescription")}
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("themeMode")}
            </label>
            <Select
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value as ThemeMode)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t("placeholder")} />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="system">
                  <span className="inline-flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5" />
                    {t("system")}
                  </span>
                </SelectItem>
                <SelectItem value="light">
                  <span className="inline-flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5" />
                    {t("light")}
                  </span>
                </SelectItem>
                <SelectItem value="dark">
                  <span className="inline-flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5" />
                    {t("dark")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              className="text-[11px] text-muted-foreground"
              suppressHydrationWarning
            >
              {t("currentTheme", { theme: resolvedThemeLabel })}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("windowOpacityTitle")}</h2>
          </div>

          <p className="text-xs text-muted-foreground leading-5">
            {t("windowOpacityDescription")}
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-muted-foreground">
                {t("windowOpacity")}
              </label>
              <span className="text-xs font-medium text-foreground/80">
                {opacityPercentLabel}
              </span>
            </div>

            <input
              type="range"
              min={20}
              max={100}
              step={1}
              value={appearanceSettings.window_opacity}
              onChange={(event) =>
                handleWindowOpacityChange(Number(event.target.value))
              }
              className="h-2 w-full cursor-pointer accent-primary"
              aria-label={t("windowOpacity")}
              disabled={!appearanceSettingsLoaded}
            />

            <p className="text-[11px] text-muted-foreground">
              {t("windowOpacityHint", {
                min: 20,
                max: 100,
              })}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
