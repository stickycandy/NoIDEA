"use client"

import { useTerminalContext } from "@/contexts/terminal-context"
import { TerminalTabBar } from "./terminal-tab-bar"
import { TerminalView } from "./terminal-view"

export function TerminalPanel() {
  const { isOpen, tabs, activeTabId } = useTerminalContext()

  return (
    <section
      data-terminal-panel-region="true"
      className="flex h-full min-h-0 flex-col bg-card/35 backdrop-blur-xl"
    >
      <TerminalTabBar />
      <div className="relative min-h-0 flex-1 overflow-hidden bg-transparent">
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            terminalId={tab.id}
            isActive={tab.id === activeTabId}
            isVisible={isOpen}
          />
        ))}
      </div>
    </section>
  )
}
