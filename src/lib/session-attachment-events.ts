export const ATTACH_FILE_TO_SESSION_EVENT = "noidea:attach-file-to-session"

export interface AttachFileToSessionDetail {
  tabId: string
  path: string
}

export function emitAttachFileToSession(
  detail: AttachFileToSessionDetail
): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<AttachFileToSessionDetail>(ATTACH_FILE_TO_SESSION_EVENT, {
      detail,
    })
  )
}
