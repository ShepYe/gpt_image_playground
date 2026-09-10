import { useEffect, useRef, useState } from 'react'
import { DEFAULT_DROPDOWN_MAX_HEIGHT, getDropdownLayout } from '../../lib/dropdown'
import { ChevronDownIcon, RefreshIcon } from '../icons'

interface ModelSelectProps {
  value: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  /** 传入时在输入框右侧显示「查询」按钮，用于拉取模型列表 */
  onQuery?: () => void
}

export default function ModelSelect({ value, onChange, onCommit, options, placeholder, disabled, loading, onQuery }: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuMaxHeight, setMenuMaxHeight] = useState(DEFAULT_DROPDOWN_MAX_HEIGHT)
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const keyword = value.trim().toLowerCase()
  // 输入内容与某个模型完全一致时不再过滤，方便直接浏览完整列表
  const isExactMatch = options.some((id) => id.toLowerCase() === keyword)
  const visibleOptions = keyword && !isExactMatch
    ? options.filter((id) => id.toLowerCase().includes(keyword))
    : options
  const highlightedIndex = Math.min(highlighted, Math.max(0, visibleOptions.length - 1))

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const updateMenuLayout = () => {
      if (!containerRef.current) return
      const layout = getDropdownLayout(containerRef.current)
      setPlacement(layout.placement)
      setMenuMaxHeight(layout.maxHeight)
    }

    updateMenuLayout()
    window.addEventListener('resize', updateMenuLayout)
    window.addEventListener('scroll', updateMenuLayout, true)
    return () => {
      window.removeEventListener('resize', updateMenuLayout)
      window.removeEventListener('scroll', updateMenuLayout, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, highlightedIndex, visibleOptions.length])

  const openList = () => {
    if (disabled || !options.length) return
    // 打开时默认高亮当前值，便于直接确认
    setHighlighted(Math.max(0, visibleOptions.indexOf(value)))
    setIsOpen(true)
  }

  const selectModel = (id: string) => {
    onChange(id)
    onCommit(id)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && visibleOptions.length) {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const offset = e.key === 'ArrowDown' ? 1 : -1
      setHighlighted((prev) => (prev + offset + visibleOptions.length) % visibleOptions.length)
      return
    }

    if (e.key === 'Enter' && isOpen && visibleOptions[highlightedIndex]) {
      e.preventDefault()
      selectModel(visibleOptions[highlightedIndex])
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div ref={containerRef} className="relative min-w-0 flex-1">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (options.length) setIsOpen(true)
          }}
          onBlur={(e) => onCommit(e.target.value)}
          onFocus={openList}
          onClick={openList}
          onKeyDown={handleKeyDown}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-200/70 bg-white/60 py-2.5 pl-3 pr-9 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : openList())}
          disabled={disabled}
          tabIndex={-1}
          aria-label="展开模型列表"
          aria-expanded={isOpen}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            ref={listRef}
            role="listbox"
            className={`absolute z-50 w-full overflow-hidden overflow-y-auto rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl custom-scrollbar dark:border-white/[0.08] dark:bg-gray-900/95 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] dark:ring-white/10 ${
              placement === 'top' ? 'bottom-full mb-1.5 animate-dropdown-up' : 'top-full mt-1.5 animate-dropdown-down'
            }`}
            style={{ maxHeight: menuMaxHeight }}
          >
            {visibleOptions.length ? (
              visibleOptions.map((id, index) => (
                <div
                  key={id}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  data-highlighted={index === highlightedIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => selectModel(id)}
                  className={`flex min-h-9 cursor-pointer items-center px-3 py-2 text-xs transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="min-w-0 truncate">{id}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                {loading ? '正在查询模型列表…' : options.length ? '没有匹配的模型。' : '点击「查询」获取模型列表，也可直接输入模型 ID。'}
              </div>
            )}
          </div>
        )}
      </div>

      {onQuery && (
        <button
          type="button"
          onClick={onQuery}
          disabled={disabled || loading}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition hover:bg-gray-100/80 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.08]"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          查询
        </button>
      )}
    </div>
  )
}
