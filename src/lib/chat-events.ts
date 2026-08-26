/** Lets any component (navbar CTA, page buttons) open the floating assistant
 *  without threading state through the whole tree. */
export const OPEN_CHAT_EVENT = "dxb-schools:open-chat";

export function openChat() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
  }
}
