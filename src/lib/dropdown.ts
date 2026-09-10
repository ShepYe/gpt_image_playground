const DROPDOWN_GAP_PX = 8
const OVERFLOW_BOUNDARY_RE = /(auto|scroll|hidden|clip)/
const MIN_DROPDOWN_HEIGHT_PX = 120

export const DEFAULT_DROPDOWN_MAX_HEIGHT = 240

// 触发器上下方的可用展开空间，遇到滚动容器时按容器边界收缩
function getAvailableHeights(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect()
  let below = window.innerHeight - rect.bottom - DROPDOWN_GAP_PX
  let above = rect.top - DROPDOWN_GAP_PX
  let parent = trigger.parentElement

  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent)
    if (OVERFLOW_BOUNDARY_RE.test(`${style.overflow} ${style.overflowY}`)) {
      const parentRect = parent.getBoundingClientRect()
      below = Math.min(below, parentRect.bottom - rect.bottom - DROPDOWN_GAP_PX)
      above = Math.min(above, rect.top - parentRect.top - DROPDOWN_GAP_PX)
    }
    parent = parent.parentElement
  }

  return { below, above }
}

export function getDropdownMaxHeight(trigger: HTMLElement, maxHeight = DEFAULT_DROPDOWN_MAX_HEIGHT) {
  return Math.max(0, Math.min(maxHeight, Math.floor(getAvailableHeights(trigger).below)))
}

/** 下方空间不足且上方更宽裕时向上弹出 */
export function getDropdownLayout(trigger: HTMLElement, maxHeight = DEFAULT_DROPDOWN_MAX_HEIGHT) {
  const { below, above } = getAvailableHeights(trigger)
  const placement: 'top' | 'bottom' = below < MIN_DROPDOWN_HEIGHT_PX && above > below ? 'top' : 'bottom'
  const available = placement === 'top' ? above : below

  return { placement, maxHeight: Math.max(0, Math.min(maxHeight, Math.floor(available))) }
}
