import {BaseInput} from './index'
import type Community from '../index'
import type {Generic, ObjectIndex, OptionSets, ResourceField} from '../../types'
import {keymap} from '../static_refs'
import {loader, options_filter, set_current_options} from '../common_methods'
import {patterns} from '../patterns'

export type ComboboxSpec = {
  strict?: boolean
  numeric?: boolean
  search?: boolean
  multi?: boolean
  accordion?: boolean
  group?: string
  filters?: Generic
}

export class InputCombobox extends BaseInput {
  type: 'combobox' = 'combobox'
  hover_index = -1
  cleared_selection = ''
  default: string | number
  expanded = false
  listbox: HTMLElement
  groups: {e: HTMLElement[]; by_name: {[index: string]: HTMLElement}}
  container = document.createElement('div')
  selection: HTMLElement
  input_element: HTMLInputElement
  filter_index: number[]
  current_filter: {[index: string]: string} = {}
  onchange: Function
  value_type: string
  values: ObjectIndex = {}
  display: ObjectIndex = {}
  options: HTMLDivElement[] = []
  option_sets: OptionSets = {}
  current_set = ''
  sensitive = false
  loader?: (...args: any) => void
  filter = options_filter
  reformat_label = false
  constructor(e: HTMLElement, site: Community) {
    super(e, site)
    this.set = this.set.bind(this)
    this.reset = this.reset.bind(this)
    this.resize = this.resize.bind(this)
    this.toggle = this.toggle.bind(this)
    this.highlight = this.highlight.bind(this)
    this.filterer = this.filterer.bind(this)
    this.close = this.close.bind(this)
    this.set_selected = this.set_selected.bind(this)
    this.settings.use_display = this.settings.search || this.settings.multi
    this.listbox = this.e.parentElement.children[1] as HTMLElement
    this.options = [...this.listbox.querySelectorAll('.combobox-option')] as HTMLDivElement[]
    if (this.optionSource && this.site.patterns.ids.test(this.optionSource)) {
      this.loader = loader.bind(this)
      e.addEventListener('click', this.loader)
      this.deferred = true
    }
    if (this.options.length) {
      this.reformat_label = true
      this.options.forEach((e, i) => {
        this.values[e.dataset.value] = i
        if (this.reformat_label) this.reformat_label = e.dataset.value === e.innerText
      })
      const group: NodeListOf<HTMLElement> = this.listbox.querySelectorAll('.combobox-group')
      if (group.length) {
        this.groups = {e: [], by_name: {}}
        group.forEach(e => {
          const name = e.dataset.group
          this.groups.e.push(e)
          this.groups.by_name[name] = e
        })
      }
    }
    this.container.className = 'combobox-options-container combobox-component hidden'
    this.site.page.overlay.appendChild(this.container)
    this.container.appendChild(this.listbox)
    this.selection = this.e.firstElementChild.firstElementChild as HTMLElement
    this.input_element = this.e.firstElementChild.lastElementChild as HTMLInputElement
    if (2 === this.e.childElementCount) {
      this.e.lastElementChild.addEventListener(
        'click',
        function (this: InputCombobox) {
          if (!this.e.classList.contains('locked')) {
            this.cleared_selection = ''
            this.set([])
            this.input_element.focus()
          }
        }.bind(this)
      )
    }
    this.input_element.addEventListener(
      'focus',
      function (this: HTMLElement) {
        this.classList.add('focused')
      }.bind(this.e)
    )
    this.input_element.addEventListener(
      'blur',
      function (this: HTMLElement) {
        this.classList.remove('focused')
      }.bind(this.e)
    )
    this.listbox.addEventListener('click', this.set)
    window.addEventListener('resize', this.resize)
    this.e.addEventListener('mousedown', this.toggle)
    this.listbox.addEventListener('mouseover', this.highlight)
    if (this.settings.accordion) {
      this.listbox.addEventListener('show.bs.collapse', e => {
        const group = this.hover_index === -1 ? '' : this.options[this.hover_index].dataset.group
        const et = e.target as HTMLElement
        if (group !== et.dataset.group) {
          et.firstElementChild.firstElementChild.dispatchEvent(new MouseEvent('mouseover'))
          this.input_element.focus()
        }
      })
    }
    if (this.settings.search) {
      this.input_element.addEventListener('keyup', this.filterer)
    }
    this.input_element.addEventListener(
      'keydown',
      function (this: InputCombobox, e: KeyboardEvent) {
        const action = keymap[e.code as keyof typeof keymap]
        if (action) {
          if ('close' === action) {
            this.close()
          } else if ('select' === action) {
            if (!this.expanded) return this.toggle(void 0, this.input_element)
            this.set(e)
          } else if ('move' === action) {
            const value = this.input_element.value
            if (this.settings.strict || (this.expanded && '' === value)) {
              e.preventDefault()
              if ('ArrowUp' === e.code) {
                if (this.filter_index && this.filter_index.length) {
                  this.hover_index = this.filter_index.indexOf(this.hover_index) - 1
                  this.hover_index = this.filter_index[0 > this.hover_index ? 0 : this.hover_index]
                } else {
                  this.hover_index = Math.max(0, this.hover_index - 1)
                }
              } else if ('ArrowDown' === e.code) {
                if (this.filter_index && this.filter_index.length) {
                  this.hover_index = this.filter_index.indexOf(this.hover_index) + 1
                  this.hover_index =
                    this.filter_index[
                      this.filter_index.length - 1 < this.hover_index ? this.filter_index.length - 1 : this.hover_index
                    ]
                } else {
                  this.hover_index = Math.min(this.options.length - 1, this.hover_index + 1)
                }
              } else if ('Home' === e.code) {
                this.hover_index = 0
              } else if ('End' === e.code) {
                this.hover_index = this.options.length - 1
              }
              if (this.expanded) {
                this.highlight()
              } else {
                this.set(this.hover_index)
              }
            } else if (this.site.patterns.number.test(value)) {
              this.set(+value + ('ArrowUp' === e.code ? 1 : -1))
            }
          }
        } else if (!this.expanded) {
          this.toggle(void 0, this.input_element)
        } else {
          this.clear_highlight()
        }
      }.bind(this)
    )
  }
  init() {
    this.options.forEach((e, i) => {
      if (this.reformat_label) e.innerText = this.site.data.format_label(e.dataset.value)
      this.display[e.innerText] = i
    })
  }
  set_current = set_current_options
  filterer() {
    const q = this.input_element.value.toLowerCase()
    if ('' === q) {
      this.filter_reset()
    } else {
      this.filter_index = []
      if (this.groups) {
        this.groups.e.forEach(g => g.firstElementChild.firstElementChild.classList.add('hidden'))
      }
      this.options.forEach((o, i) => {
        if (!o.classList.contains('hidden') && o.innerText.toLowerCase().includes(q)) {
          o.classList.remove('filter-hidden')
          this.filter_index.push(i)
          const group = o.dataset.group
          if (group) {
            this.groups.by_name[group].firstElementChild.firstElementChild.classList.remove('hidden')
            if (this.settings.accordion) {
              const g = this.groups.by_name[group]
              g.firstElementChild.nextElementSibling.classList.add('show')
              g.firstElementChild.firstElementChild.classList.remove('collapsed')
              g.firstElementChild.firstElementChild.setAttribute('aria-expanded', 'true')
            }
          }
        } else {
          o.classList.add('filter-hidden')
        }
      })
    }
  }
  highlight(e?: MouseEvent, target?: HTMLElement) {
    if (e && !target) target = e.target as HTMLElement
    if (!target || target.dataset.value in this.values) {
      if (!this.groups) this.settings.accordion = false
      if (target && target.dataset.value) {
        this.hover_index = this.values[target.dataset.value]
      } else if (-1 === this.hover_index && Array.isArray(this.source)) {
        this.hover_index = this.values[this.source[0]]
      }
      if ('undefined' === typeof this.hover_index) this.hover_index = -1
      const o = this.options[this.hover_index]
      if (o) {
        const previous = this.listbox.querySelector('.highlighted')
        if (previous) previous.classList.remove('highlighted')
        if (e && 'mouseover' === e.type) {
          target.classList.add('highlighted')
        } else {
          o.classList.add('highlighted')
          if (this.settings.accordion) {
            const c = o.parentElement.parentElement
            if (!c.classList.contains('show')) {
              c.classList.add('show')
              c.previousElementSibling.firstElementChild.classList.remove('collapsed')
              c.previousElementSibling.firstElementChild.setAttribute('aria-expanded', 'true')
            }
          }
          this.input_element.setAttribute('aria-activedescendant', o.id)
          const port = this.container.getBoundingClientRect(),
            item = o.getBoundingClientRect()
          let top = port.top
          if (this.groups && o.dataset.group)
            top += this.groups.by_name[o.dataset.group].firstElementChild.getBoundingClientRect().height
          if (top > item.top) {
            this.container.scrollTo(0, this.container.scrollTop + item.top - top)
          } else if (port.bottom < item.bottom) {
            this.container.scrollTo(0, this.container.scrollTop + item.bottom - port.bottom)
          }
        }
      }
    }
  }
  toggle(e?: MouseEvent, target?: HTMLElement) {
    if (e && !target) target = e.target as HTMLElement
    if (target && (!e || !e.button) && !this.e.classList.contains('disabled') && 'BUTTON' !== target.tagName) {
      if (this.expanded) {
        if (target !== this.input_element) this.close()
      } else {
        if (this.site.spec.combobox)
          Object.keys(this.site.spec.combobox).forEach(id => {
            if (id !== this.id) {
              const ou = this.site.inputs[id] as InputCombobox
              ou.expanded && ou.close()
            }
          })
        this.container.classList.remove('hidden')
        if ('' !== this.selection.innerText) this.cleared_selection = this.selection.innerText
        if (this.cleared_selection in this.display)
          this.highlight(void 0, this.options[this.display[this.cleared_selection]])
        if (this.settings.use_display) this.selection.innerText = ''
        window.addEventListener('click', this.close)
        this.e.setAttribute('aria-expanded', 'true')
        if (!e || e.target !== this.input_element) setTimeout(() => this.input_element.focus(), 0)
        this.resize()
        this.expanded = true
      }
    }
  }
  value() {
    return this.source
      ? this.settings.multi
        ? this.source
        : Array.isArray(this.source) && this.source.length
        ? this.source[0]
        : ''
      : this.site.valueOf(this.default)
  }
  close(e?: MouseEvent) {
    if (
      this.expanded &&
      (!e ||
        !(e.target as HTMLElement).classList ||
        !(e.target as HTMLElement).classList.contains('combobox-component'))
    ) {
      if (
        this.settings.use_display &&
        '' === this.selection.innerText &&
        Array.isArray(this.source) &&
        this.source.length
      )
        this.selection.innerText = this.cleared_selection
      if ('' !== this.input_element.value) setTimeout(this.set, 0)
      this.e.setAttribute('aria-expanded', 'false')
      this.expanded = false
      this.container.classList.add('hidden')
      window.removeEventListener('click', this.close)
    }
  }
  resize() {
    const s = this.e.getBoundingClientRect()
    this.container.style.left = s.x + 'px'
    this.container.style.width = s.width + 'px'
    if (window.screen.height / 2 > s.y) {
      this.container.style.top = s.y + s.height + 'px'
      this.container.style.bottom = ''
    } else {
      this.container.style.top = ''
      this.container.style.bottom = -s.y + 'px'
    }
  }
  clear_highlight() {
    if (-1 !== this.hover_index) {
      this.options[this.hover_index].classList.remove('highlighted')
      this.hover_index = -1
    }
  }
  filter_reset() {
    if (this.groups)
      this.groups.e.forEach(g => {
        ;(this.settings.accordion ? g.firstElementChild.firstElementChild : g).classList.remove('hidden')
      })
    this.input_element.value = ''
    this.filter_index = []
    this.options.forEach((o, i) => {
      if (!o.classList.contains('hidden')) this.filter_index.push(i)
    })
    this.listbox.querySelectorAll('.filter-hidden').forEach(o => o.classList.remove('filter-hidden'))
  }
  set_selected(value: string | number) {
    if (value in this.values) {
      const option = this.options[this.values[value] as number]
      option.classList.add('selected')
      option.setAttribute('aria-selected', 'true')
    }
  }
  static create(
    site: Community,
    label: string,
    options?: string[] | {[index: string]: string[]},
    settings?: Generic,
    id?: string
  ) {
    id = id || 'created_combobox_' + ++site.page.elementCount
    const main = document.createElement('div')
    let e = document.createElement('div'),
      div = document.createElement('div'),
      input = document.createElement('input'),
      lab = document.createElement('label')
    if (settings) {
      if (!site.spec.combobox) site.spec.combobox = {}
      site.spec.combobox[id] = settings
    }
    e.className = 'wrapper combobox-wrapper'
    if (settings && settings.floating) {
      e.appendChild(div)
      div.className = 'form-floating'
      div.dataset.of = id
      e = div
    }
    e.appendChild(main)
    main.id = id
    main.dataset.autotype = 'combobox'
    main.className = 'auto-input form-select combobox combobox-component'
    main.role = 'combobox'
    main.appendChild((div = document.createElement('div')))
    div.className = 'combobox-selection combobox-component'
    div.appendChild(document.createElement('span'))
    div.lastElementChild.className = 'combobox-component'
    div.lastElementChild.setAttribute('aria-live', 'assertive')
    div.lastElementChild.setAttribute('aria-atomic', 'true')
    div.lastElementChild.role = 'log'
    div.appendChild(input)
    input.setAttribute('aria-haspopup', 'listbox')
    input.setAttribute('aria-expanded', 'false')
    input.setAttribute('aria-controls', id + '-listbox')
    input.className = 'combobox-input combobox-component'
    input.type = 'text'
    input.role = 'combobox'
    input.id = id + '-input'
    input.autocomplete = 'off'
    if (settings && settings.clearable) {
      const button = document.createElement('button')
      e.firstElementChild.appendChild(button)
      button.type = 'button'
      button.className = 'btn-close'
      button.title = 'clear selection'
    }
    e.appendChild((div = document.createElement('div')))
    div.className = 'combobox-options combobox-component'
    div.setAttribute('aria-labelledby', id + '-label')
    div.role = 'listbox'
    div.tabIndex = -1
    div.id = id + '-listbox'
    e.appendChild(lab)
    lab.id = id + '-label'
    lab.innerText = label
    lab.setAttribute('for', id + '-input')
    const u = new InputCombobox(main, site)
    site.inputs[id] = u
    let n = 0
    if (options)
      if (Array.isArray(options)) {
        options.forEach(o => {
          const l = site.data.format_label(o)
          u.display[l] = n
          u.values[o] = n++
          u.add(o, l)
        })
      } else {
        u.groups = {e: [], by_name: {}}
        Object.keys(options).forEach(k => {
          const g = options[k]
          const e = document.createElement('div'),
            id = u.id + '_group_' + k.replace(patterns.seps, '-')
          e.dataset.group = k
          e.className = 'combobox-group combobox-component'
          e.setAttribute('aria-labelledby', id)
          e.appendChild((lab = document.createElement('label')))
          lab.dataset.for = id
          lab.innerText = k
          lab.id = id
          lab.className = 'combobox-group-label combobox-component'
          u.groups.by_name[k] = e
          u.groups.e.push(e)
          g.forEach(o => e.appendChild(u.add(o, o, true)))
          u.listbox.appendChild(e)
        })
        Object.keys(u.groups.by_name).forEach(g => {
          u.groups.by_name[g].querySelectorAll('.combobox-option').forEach((c: HTMLElement) => {
            ;(u.options as HTMLElement[]).push(c)
            c.dataset.group = g
            u.values[c.dataset.value] = n
            u.display[c.innerText] = n++
          })
        })
      }
    return u
  }
  get() {
    const s: string[] = []
    this.listbox.querySelectorAll('.selected').forEach((o: HTMLElement) => s.push(o.dataset.value))
    this.source = s
    this.site.request_queue(false, this.id)
  }
  set(v?: MouseEvent | KeyboardEvent | string | number | (string | number)[], toggle?: boolean): void {
    if ('number' !== typeof v && !v) v = this.input_element.value
    let update = false,
      i = -1
    if (!Array.isArray(v) && 'object' === typeof v) {
      const t = v.target as HTMLElement
      if ((this.settings.accordion ? 'BUTTON' : 'LABEL') === t.tagName) return void 0
      i = this.hover_index
      if (
        -1 !== i &&
        (this.options[i].classList.contains('hidden') || this.options[i].classList.contains('filter-hidden'))
      )
        i = -1
      v =
        -1 === i
          ? 'INPUT' === t.tagName
            ? this.input_element.value
            : t.dataset.value || t.innerText
          : this.options[i].dataset.value || this.options[i].innerText
      toggle = this.settings.multi
    }
    this.filter_reset()
    if (Array.isArray(v)) {
      if (this.settings.multi) {
        this.listbox.querySelectorAll('.selected').forEach(e => {
          e.classList.remove('selected')
          e.setAttribute('aria-selected', 'false')
        })
        this.source = -1 === v[0] ? [] : v
        v.forEach(this.set_selected)
        update = true
      } else v = v[0]
    }
    if (!Array.isArray(this.source)) this.source = []
    if (!Array.isArray(v)) {
      const inValues = v in this.values
      if (inValues) v += ''
      if (this.settings.strict && !inValues && this.site.patterns.number.test('' + v)) v = +v
      if ('number' !== this.value_type && 'number' === typeof v && this.options[v]) {
        v = this.options[v].dataset.value
      }
      if ('string' === typeof v && v in this.display) v = this.options[this.display[v]].dataset.value
      if (this.settings.strict && !inValues) v = this.default
      i = this.source.indexOf(v)
      if (-1 === i) {
        update = true
        if (-1 === v || '' === v) {
          this.source = []
        } else {
          if (this.settings.multi) {
            this.source.push(v)
          } else this.source[0] = v
        }
        if (inValues) {
          if (!this.settings.multi) {
            const selected = this.listbox.querySelector('.selected')
            if (selected) {
              selected.classList.remove('selected')
              selected.setAttribute('aria-selected', 'false')
            }
          }
          this.set_selected(v)
        }
      } else if (toggle) {
        update = true
        this.source.splice(i, 1)
        if (inValues) {
          const selection = this.options[this.values[v]]
          selection.classList.remove('selected')
          selection.setAttribute('aria-selected', 'false')
        }
      }
    }
    if (!this.settings.multi && this.expanded) {
      this.input_element.focus()
      this.close()
      this.filter_reset()
    }
    let display: string | HTMLElement = this.source.length
      ? this.settings.multi
        ? this.source.length + ' of ' + this.options.length + ' selected'
        : this.source[0] in this.values
        ? this.options[this.values[this.source[0]]]
        : this.settings.strict || -1 === this.source[0]
        ? ''
        : this.source[0] + ''
      : ''
    if ('string' !== typeof display) {
      display = display.firstChild ? display.firstChild.textContent : display.innerText
    }
    if (this.settings.use_display) {
      this.selection.innerText = display
    } else {
      this.input_element.value = display
    }
    if (this.onchange) this.onchange()
    if (update) this.site.request_queue(false, this.id)
  }
  add(value: string, display?: string, noadd?: boolean, meta?: ResourceField) {
    const e = document.createElement('div')
    e.id = this.id + '_' + value
    e.role = 'option'
    e.setAttribute('aria-selected', 'false')
    e.tabIndex = 0
    e.className = 'combobox-option combobox-component'
    e.dataset.value = value
    e.innerText = display || this.site.data.format_label(value)
    if (meta && meta.info) {
      e.appendChild(document.createElement('p'))
      e.lastElementChild.className = 'combobox-option-description combobox-component'
      ;(e.lastElementChild as HTMLElement).innerText = meta.info.description || meta.info.short_description || ''
    }
    if (!noadd) {
      this.listbox.appendChild(e)
      this.options.push(e)
    }
    return e
  }
}
