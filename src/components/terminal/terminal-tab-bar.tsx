"use client"

import { useRef, useState } from "react"
import { Minus, Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTerminalContext } from "@/contexts/terminal-context"
import { useShortcutSettings } from "@/hooks/use-shortcut-settings"
import { useIsMac } from "@/hooks/use-is-mac"
import { formatShortcutLabel } from "@/lib/keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export function TerminalTabBar() {
  const t = useTranslations("Folder.terminal")
  const { shortcuts } = useShortcutSettings()
  const isMac = useIsMac()
  const {
    tabs,
    activeTabId,
    switchTerminal,
    closeTerminal,
    closeOtherTerminals,
    closeAllTerminals,
    renameTerminal,
    createTerminal,
    toggle,
  } = useTerminalContext()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startRename = (id: string, title: string) => {
    setEditingId(id)
    setEditValue(title)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renameTerminal(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 bg-card/28 px-2 backdrop-blur-xl">
      {tabs.map((tab) => (
        <ContextMenu key={tab.id}>
          <ContextMenuTrigger asChild>
            <div
              className={`flex h-6 items-center gap-1 rounded-md px-2 text-xs cursor-pointer select-none transition-colors ${
                tab.id === activeTabId
                  ? "bg-card/62 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]"
                  : "text-muted-foreground hover:bg-card/32 hover:text-foreground"
              }`}
              onClick={() => switchTerminal(tab.id)}
            >
              {editingId === tab.id ? (
                <input
                  ref={inputRef}
                  className="bg-transparent outline-none border border-primary/50 rounded px-0.5 w-20 text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename()
                    if (e.key === "Escape") setEditingId(null)
                  }}
                />
              ) : (
                <span className="truncate max-w-[120px]">{tab.title}</span>
              )}
              <button
                className="ml-1 rounded-sm p-0.5 hover:bg-foreground/10"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(tab.id)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => startRename(tab.id, tab.title)}>
              {t("rename")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => closeTerminal(tab.id)}>
              {t("close")}
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => closeOtherTerminals(tab.id)}
              disabled={tabs.length <= 1}
            >
              {t("closeOthers")}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => closeAllTerminals()}>
              {t("closeAll")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => createTerminal()}
      >
        <Plus className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 ml-auto"
        onClick={toggle}
        title={t("hideTerminal", {
          shortcut: formatShortcutLabel(shortcuts.toggle_terminal, isMac),
        })}
      >
        <Minus className="h-3 w-3" />
      </Button>
    </div>
  )
}
