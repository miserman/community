import type {RegisteredInputs, SiteInputs} from './inputs/index'
import {patterns} from './patterns'

type Actions = string[] | {[index: string]: string}
type TutorialStep = {
  focus: string
  description?: string
  option?: string | string[]
  before?: Actions
  after?: Actions
  wait?: number
  time?: number
  disable_continue?: boolean
}
type Tutorial = {
  name: string
  title: string
  description: string
  steps: TutorialStep[]
  reset?: boolean
  manager?: TutorialManager
  n_steps?: number
  current_step?: number
  run?: Function
}
export type Tutorials = {[index: string]: Tutorial}

export class TutorialManager {
  tutorials: Tutorials
  site_elements: RegisteredInputs
  container = document.createElement('div')
  backdrop = document.createElement('div')
  highlight = document.createElement('div')
  menu = document.createElement('div')
  frame = document.createElement('div')
  header = document.createElement('p')
  dialog = document.createElement('p')
  timer = document.createElement('div')
  running_timer: number | NodeJS.Timeout
  focuser: number | NodeJS.Timeout
  progress = document.createElement('div')
  continue = document.createElement('button')
  in_progress = ''
  waiting = false
  current_step = 0
  current_time = 0
  current_element: HTMLElement
  current_site_element: SiteInputs
  site_reset: Function
  constructor(tutorials: Tutorials, elements?: RegisteredInputs, resetter?: Function) {
    this.tutorials = tutorials
    this.site_elements = elements || {}
    this.site_reset = resetter || (() => {})
    this.start_tutorial = this.start_tutorial.bind(this)
    this.progress_tutorial = this.progress_tutorial.bind(this)
    this.execute_step = this.execute_step.bind(this)
    this.end_tutorial = this.end_tutorial.bind(this)

    // prepare menu
    document.body.appendChild(this.menu)
    this.menu.id = 'community_tutorials_menu'
    this.menu.className = 'modal fade'
    this.menu.tabIndex = -1
    let e = document.createElement('div')
    this.menu.appendChild(e)
    e.className = 'modal-dialog modal-dialog-scrollable'
    e.appendChild((e = document.createElement('div')))
    e.className = 'modal-content'
    e.appendChild((e = document.createElement('div')))
    e.className = 'modal-header'
    e.appendChild((e = document.createElement('p')))
    e.className = 'modal-title h5'
    e.innerText = 'Tutorials'
    let close = document.createElement('button')
    e.insertAdjacentElement('afterend', close)
    close.type = 'button'
    close.className = 'btn-close'
    close.setAttribute('data-bs-dismiss', 'modal')
    close.setAttribute('aria-label', 'Close')
    const l = document.createElement('div')
    this.menu.lastElementChild.lastElementChild.appendChild(l)
    l.className = 'modal-body'
    Object.keys(tutorials).forEach(name => {
      const t = tutorials[name],
        e = document.createElement('div'),
        description = document.createElement('div'),
        start = document.createElement('button')
      t.manager = this
      t.n_steps = t.steps.length
      let p = document.createElement('div')
      l.appendChild(e)
      e.className = 'tutorial-listing card'
      e.appendChild(p)
      p.className = 'card-header'
      p.innerText = t.title || name
      e.appendChild((p = document.createElement('div')))
      p.className = 'card-body'
      p.appendChild(description)
      description.appendChild(document.createElement('p'))
      ;(description.firstElementChild as HTMLParagraphElement).innerText = t.description || ''
      if (t.steps.length && t.steps[0].before && !Array.isArray(t.steps[0].before)) {
        const before = t.steps[0].before,
          setting_display = document.createElement('div'),
          header = document.createElement('span')
        setting_display.className = 'tutorial-initial-settings'
        setting_display.appendChild(header)
        header.innerText = 'Initial Settings'
        header.className = 'h6'
        Object.keys(t.steps[0].before).forEach((k, i) => {
          const row = document.createElement('p')
          let part = document.createElement('span')
          part.className = 'syntax-variable'
          part.innerText = k.replace(patterns.settings, '')
          row.appendChild(part)
          part = document.createElement('span')
          part.className = 'syntax-operator'
          part.innerText = ' = '
          row.appendChild(part)
          part = document.createElement('span')
          part.className = 'syntax-value'
          part.innerText = before[k]
          row.appendChild(part)
          setting_display.appendChild(row)
        })
        description.appendChild(setting_display)
      }
      p.appendChild(start)
      start.type = 'button'
      start.className = 'btn'
      start.innerText = 'Start'
      start.dataset.name = name
      start.addEventListener('click', this.start_tutorial)
    })

    // prepare step display
    document.body.appendChild(this.container)
    this.container.appendChild(this.backdrop)
    this.container.className = 'tutorial-container hidden'
    this.container.addEventListener('keyup', this.progress_tutorial)
    this.backdrop.addEventListener('click', this.progress_tutorial)
    this.backdrop.className = 'tutorial-backdrop'
    this.container.appendChild(this.highlight)
    this.highlight.className = 'tutorial-highlight'
    this.highlight.addEventListener('click', this.progress_tutorial)
    this.container.appendChild(this.frame)
    this.frame.className = 'tutorial-frame'
    this.frame.style.left = '50%'
    this.frame.tabIndex = -1
    this.frame.appendChild((e = document.createElement('div')))
    this.frame.id = 'community_tutorial_frame'
    this.frame.role = 'dialog'
    this.frame.setAttribute('aria-labelledby', 'community_tutorial_description')
    e.className = 'tutorial-step card'
    e.appendChild((e = document.createElement('div')))
    e.className = 'card-header'
    e.appendChild(this.header)
    this.header.className = 'card-title'
    this.header.id = 'community_tutorial_title'
    close = document.createElement('button')
    e.appendChild(close)
    close.type = 'button'
    close.className = 'btn-close'
    close.setAttribute('aria-label', 'Close Tutorial')
    close.addEventListener('click', this.end_tutorial)
    this.frame.firstElementChild.appendChild((e = document.createElement('div')))
    e.className = 'card-body'
    e.appendChild(this.dialog)
    this.dialog.role = 'status'
    this.dialog.id = 'community_tutorial_description'
    this.dialog.setAttribute('aria-labelledby', 'community_tutorial_progress')
    this.dialog.setAttribute('aria-live', 'polite')
    e.lastElementChild.className = 'card-text'
    this.frame.firstElementChild.appendChild((e = document.createElement('div')))
    e.className = 'tutorial-footer card-footer'
    e.appendChild(this.progress)
    this.progress.role = 'progressbar'
    this.progress.id = 'community_tutorial_progress'
    e.appendChild(this.timer)
    this.timer.role = 'timer'
    e.appendChild(this.continue)
    this.continue.addEventListener('click', this.progress_tutorial)
    this.continue.type = 'button'
    this.continue.className = 'btn'
    this.continue.innerText = 'Next'
    this.continue.setAttribute('aria-controls', 'community_tutorial_frame')
  }
  retrieve_element(this: TutorialManager, name: string): HTMLElement {
    let e: HTMLElement
    if (name in this.site_elements) {
      this.current_site_element = this.site_elements[name]
      e = this.current_site_element.e
    } else if ('nav:' === name.substring(0, 4).toLowerCase()) {
      const text = name.replace(patterns.pre_colon, '')
      document.querySelectorAll('.nav-item button').forEach((item: HTMLButtonElement) => {
        if (text === item.innerText) e = item
      })
    } else {
      try {
        e = document.querySelector(name.replace(patterns.id_escapes, '\\$1'))
      } catch (error) {}
    }
    return e
  }
  start_tutorial(this: TutorialManager, event?: MouseEvent, name?: string): void {
    this.end_tutorial()
    document.querySelectorAll('[data-bs-dismiss]').forEach((close: HTMLButtonElement) => close.click())
    this.in_progress = name ? name : (event.target as HTMLButtonElement).dataset.name
    if (!(this.in_progress in this.tutorials)) {
      console.error('tutorial does not exist:', this.in_progress)
      this.in_progress = ''
      return
    }
    this.container.classList.remove('hidden')
    this.header.innerText = this.tutorials[this.in_progress].title || this.in_progress
    this.current_step = 0
    this.current_time = 0
    this.dialog.innerText = 'Starting tutorial ' + this.header.innerText
    this.timer.innerText = ''
    this.continue.innerText = 'Next'
    if (this.tutorials[this.in_progress].reset) this.site_reset()
    this.progress_tutorial()
  }
  progress_tutorial(this: TutorialManager, event?: KeyboardEvent): void {
    const isClick = !event || !event.code
    if (!isClick && 'Escape' === event.code) this.end_tutorial()
    if (this.in_progress && !this.waiting && (isClick || 'Enter' === event.code || 'ArrowRight' === event.code)) {
      this.waiting = true
      clearTimeout(this.focuser as number)
      clearInterval(this.running_timer as number)
      const t = this.tutorials[this.in_progress]
      let step: TutorialStep
      const handle_object = (obj: {[index: string]: string}) => {
        Object.keys(obj).forEach(k => {
          if (patterns.number.test(k)) {
            do_action(obj[k])
          } else {
            if (k in this.site_elements && this.site_elements[k].set) {
              this.site_elements[k].set(obj[k])
            }
          }
        })
      }
      const set_value = (value: string | string[]) => {
        if (this.current_site_element && this.current_site_element.set) {
          this.current_site_element.set(value as string)
        } else {
          const input =
            'value' in this.current_element ? this.current_element : this.current_element.querySelector('input')
          if (input) {
            input.value = value
            input.dispatchEvent(new Event('change'))
            input.dispatchEvent(new KeyboardEvent('keydown', {code: 'Enter'}))
          }
        }
      }
      const do_action = (action: string) => {
        if ('set' === action) {
          if ('option' in step) set_value(step.option)
        } else if ('click' === action) {
          const u = this.current_site_element
          if (u) {
            if (action === u.id && 'toggle' in u) {
              if (!u.expanded) u.toggle(void 0, u.e)
            } else {
              u.e.click()
            }
          } else {
            this.current_element && this.current_element.click()
          }
        } else if ('close' === action) {
          document.querySelectorAll('[data-bs-dismiss]').forEach((close: HTMLButtonElement) => close.click())
        } else if ('value' === action.substring(0, 5)) {
          set_value(action.replace(patterns.pre_colon, '').trimStart())
        } else {
          const e = this.retrieve_element(action)
          if (e) e.click()
        }
      }
      // handle previous step's after action
      if (this.current_step > 0) {
        step = t.steps[this.current_step - 1]
        if ('after' in step) {
          if (Array.isArray(step.after)) {
            step.after.forEach(do_action)
          } else {
            handle_object(step.after)
          }
        }
      }
      if (this.current_step >= t.n_steps) {
        this.end_tutorial()
      } else {
        this.current_site_element = void 0
        // handle current step's before action
        step = t.steps[this.current_step]
        this.current_element = this.retrieve_element(step.focus)
        if ('before' in step) {
          if (Array.isArray(step.before)) {
            step.before.forEach(do_action)
          } else {
            handle_object(step.before)
          }
        }
        if (this.current_step === t.n_steps - 1) this.continue.innerText = 'Finish'
        if (this.current_element && this.current_element.scrollIntoView) this.current_element.scrollIntoView()
        // execute current step after actions have resolved
        setTimeout(this.execute_step, 'wait' in step ? step.wait : 400)
      }
    }
  }
  execute_step(this: TutorialManager): void {
    if (this.in_progress) {
      const t = this.tutorials[this.in_progress]
      const step = t.steps[this.current_step]
      if (!this.current_element) {
        const e = this.retrieve_element(step.focus)
        if (!e) {
          console.error('failed to retrieve element', step.focus)
          return this.end_tutorial()
        }
        this.current_element = e
        if (e.scrollIntoView) e.scrollIntoView()
        setTimeout(this.execute_step, 0)
        return
      }
      this.continue.disabled = !!step.disable_continue
      const b = this.current_element.getBoundingClientRect(),
        f = this.frame.getBoundingClientRect()
      this.highlight.style.top = b.top + 'px'
      this.highlight.style.left = b.left + 'px'
      this.highlight.style.width = b.width + 'px'
      this.highlight.style.height = b.height + 'px'
      this.frame.style.top = (b.y < screen.availHeight / 2 ? b.y + b.height + 10 : b.y - f.height - 10) + 'px'
      this.frame.style.marginLeft = -f.width / 2 + 'px'
      if (step.time) {
        this.current_time = step.time
        this.timer.innerText = step.time + ''
        this.running_timer = setInterval(() => {
          this.current_time--
          this.timer.innerText = this.current_time + ''
          if (this.current_time <= 0) {
            clearInterval(this.running_timer as number)
            this.progress_tutorial()
          }
        }, 1e3)
      } else {
        this.timer.innerText = ''
      }
      this.progress.innerText = 'Step ' + (this.current_step + 1) + ' of ' + t.n_steps
      this.dialog.innerText = step.description
      this.current_step++
      this.waiting = false
      this.focuser = setTimeout(() => this.continue.focus(), 0)
    }
  }
  end_tutorial(this: TutorialManager): void {
    this.in_progress = ''
    this.current_step = 0
    this.container.classList.add('hidden')
    this.waiting = false
    clearTimeout(this.focuser as number)
  }
}
