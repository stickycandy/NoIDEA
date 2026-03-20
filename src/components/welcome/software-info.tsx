"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { getCurrentAppVersion } from "@/lib/updater"

export function SoftwareInfo() {
  const t = useTranslations("WelcomePage")
  const [version, setVersion] = useState<string>("")

  useEffect(() => {
    getCurrentAppVersion()
      .then(setVersion)
      .catch((err) => {
        console.error("[Welcome] get app version failed:", err)
      })
  }, [])

  return (
    <div className="w-full flex gap-4 px-6 py-8">
      <Image
        src="/noidea-mark.svg"
        alt="NoIDEA"
        width={56}
        height={56}
        className="size-14 shrink-0 rounded-2xl"
      />
      <div className="flex flex-col">
        <span className="text-base">NoIDEA</span>
        <span className="text-sm text-muted-foreground">
          {version
            ? t("softwareVersion", { version })
            : t("softwareVersion", { version: "..." })}
        </span>
      </div>
    </div>
  )
}
