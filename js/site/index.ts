import DataHandler from '../data_handler/index'
import type {DataSets, Generic, MapInfo, Query, SiteCondition, SiteRule, SiteSpec, Summary} from '../types'
import {defaults} from './defaults'
import type {BaseInput, RegisteredInputs, SiteInputs} from './inputs/index'
import type {RegisteredOutputs, SiteOutputs} from './outputs/index'
import {GlobalView} from './global_view'
import {patterns} from './patterns'
import {storage} from './storage'
import {Subscriptions} from './subscriptions'
import * as conditionals from './conditionals'
import * as utils from './utils'
import {DiscretePalette, palettes} from './palettes'
import {InputSelect} from './inputs/select'
import {InputNumber} from './inputs/number'
import {SiteDataView} from './dataview'
import {Page} from './page'
import {InputVirtual} from './inputs/virtual'
import {InputButton} from './inputs/button'
import {InputCombobox} from './inputs/combobox'
import {InputRadio} from './inputs/radio'
import {InputCheckbox} from './inputs/checkbox'
import {OutputInfo} from './outputs/info'
import {OutputMap} from './outputs/map'
import {OutputPlotly} from './outputs/plotly'
import {InputButtonGroup} from './inputs/buttongroup'
import {InputSwitch} from './inputs/switch'
import {InputText} from './inputs/text'
import {OutputDataTable} from './outputs/datatables'
import {OutputTable} from './outputs/table'
import {OutputLegend} from './outputs/legend'
import {OutputText} from './outputs/text'

type Queue = {
  timeout: NodeJS.Timeout | number
  elements: Map<string, boolean>
}

const inputs = {
  button: InputButton,
  buttongroup: InputButtonGroup,
  combobox: InputCombobox,
  select: InputSelect,
  number: InputNumber,
  radio: InputRadio,
  switch: InputSwitch,
  checkbox: InputCheckbox,
  text: InputText,
}
const outputs = {
  info: OutputInfo,
  map: OutputMap,
  plotly: OutputPlotly,
  datatable: OutputDataTable,
  table: OutputTable,
  legend: OutputLegend,
  text: OutputText,
}

export type Dependency = {
  id: string
  type: 'rule' | 'update' | 'filter' | 'display' | 'dataview' | keyof typeof conditionals | keyof BaseInput
  conditional?: keyof typeof conditionals
  condition?: SiteCondition
  uid?: string
  rule?: number
}

type Tree = {
  _n: {children: number; parents: number}
  children: {[index: string]: Tree}
  parents: {[index: string]: Tree}
}

export default class Community {
  spec: SiteSpec
  storage = storage
  patterns = patterns
  palettes = palettes
  conditionals: {[index: string]: Function} = {}
  data: DataHandler
  page: Page
  view: GlobalView
  subs: Subscriptions
  registered_inputs: Map<string, SiteInputs> = new Map()
  registered_outputs: Map<string, SiteOutputs> = new Map()
  defaults = defaults
  dataviews: {[index: string]: SiteDataView} = {}
  inputs: RegisteredInputs = {}
  outputs: RegisteredOutputs = {}
  dependencies: {[index: string]: Dependency[]} = {}
  url_options: {[index: string]: boolean | string} = {}
  queue: Queue = {timeout: 0, elements: new Map()}
  tree: {[index: string]: Tree} = {}
  maps: MapInfo = {
    queue: {},
    waiting: {},
    overlay_property_selectors: [],
  }
  meta = {
    retain_state: true,
    lock_after: '',
  }
  state = ''
  query = ''
  parsed_query: Query = {}
  endpoint?: string
  rule_conditions: {[index: string]: SiteRule[]} = {}
  constructor(spec?: SiteSpec) {
    if (spec) {
      this.spec = spec
      spec.active = this
    }
    if (!spec.settings) spec.settings = {}
    if (!('dataLayer' in window)) (window as any).dataLayer = []
    storage.copy = storage.get() as Generic
    if (storage.copy)
      for (const k in spec.settings) {
        if (k in storage.copy) {
          let c = storage.copy[k]
          if ('string' === typeof c) {
            if (patterns.bool.test(c)) {
              c = !!c || 'true' === c
            } else if (patterns.number.test(c)) c = parseFloat(c)
          }
          spec.settings[k] = c
        }
      }
    function poly_channel(ch: number, pos: number, coefs: number[][]) {
      const n = coefs.length
      let v = coefs[0][ch] + pos * coefs[1][ch],
        i = 2
      for (; i < n; i++) {
        v += Math.pow(pos, i) * coefs[i][ch]
      }
      return Math.max(0, Math.min(255, v))
    }
    Object.keys(palettes).forEach(k => {
      const n = 255
      let p = palettes[k]
      if ('continuous-polynomial' === p.type) {
        const c = p.colors as number[][],
          r: DiscretePalette = {name: k, type: 'discrete', colors: []}
        for (let i = 0; i < n; i++) {
          const v = i / n
          r.colors.push(
            'rgb(' + poly_channel(0, v, c) + ', ' + poly_channel(1, v, c) + ', ' + poly_channel(2, v, c) + ')'
          )
        }
        p = palettes[k] = r
      }
      p.odd = p.colors.length % 2
    })
    this.query = window.location.search.replace('?', '')
    if (this.query) {
      this.query.split('&').forEach(a => {
        const c = a.split('='),
          k = c[0]
        let v: string | boolean
        if (c.length < 2) c.push('true')
        v = patterns.bool.test(c[1]) ? !!c[1] || 'true' === c[1] : c[1].replace(patterns.url_spaces, ' ')
        this.url_options[c[0]] = v
        if (patterns.settings.test(c[0])) storage.set(c[0].replace(patterns.settings, ''), v)
      })
    }
    if ('embedded' in this.url_options || 'hide_navbar' in this.url_options) {
      if (!('hide_logo' in this.url_options)) this.url_options.hide_logo = true
      if (!('hide_title' in this.url_options)) this.url_options.hide_title = true
      if (!('hide_navcontent' in this.url_options)) this.url_options.hide_navcontent = true
      if (!('hide_panels' in this.url_options)) this.url_options.hide_panels = true
      if ('embedded' in this.url_options && !('close_menus' in this.url_options)) this.url_options.close_menus = true
    }
    this.init = this.init.bind(this)
    this.request_queue = this.request_queue.bind(this)
    this.run_queue = this.run_queue.bind(this)
    this.global_reset = this.global_reset.bind(this)
    Object.keys(conditionals).forEach(
      (k: keyof typeof conditionals) => (this.conditionals[k] = conditionals[k].bind(this))
    )
    if (this.spec.dataviews) {
      this.defaults.dataview = Object.keys(this.spec.dataviews)[0]
    } else {
      this.spec.dataviews = {}
      this.spec.dataviews[this.defaults.dataview] = {}
    }
    if (!this.maps.overlay_property_selectors) this.maps.overlay_property_selectors = []
    this.view = new GlobalView(this)
    new Page(this)
    document.querySelectorAll('.auto-input').forEach((e: HTMLElement) => {
      if (e.dataset.autotype in inputs && !(e.id in this.inputs)) {
        const u = new inputs[e.dataset.autotype as keyof typeof inputs](e, this)
        this.registered_inputs.set(u.id, u)
        this.inputs[u.id] = u
      }
    })
    this.subs = new Subscriptions(this)
    document.querySelectorAll('.auto-output').forEach((e: HTMLElement) => {
      if (e.dataset.autotype in outputs && !(e.id in this.outputs)) {
        const u = new outputs[e.dataset.autotype as keyof typeof outputs](e, this)
        this.registered_outputs.set(u.id, u)
        this.outputs[u.id] = u
        const opt = 'options' in u ? u.options : u.spec
        if ('subto' in opt) {
          if ('string' === typeof opt.subto) opt.subto = [opt.subto]
          if (Array.isArray(opt.subto)) opt.subto.forEach(v => this.subs.add(v, u))
        }
      }
    })
    if (spec.variables && spec.variables.length)
      spec.variables.forEach(v => {
        const u = new InputVirtual(v, this)
        this.registered_inputs.set(v.id, u)
        this.inputs[v.id] = u
      })
    this.defaults.dataset = this.spec.dataviews[defaults.dataview].dataset
    if (!this.spec.metadata) this.spec.metadata = {datasets: []}
    const sets = this.spec.metadata.datasets
    if (sets && sets.length && -1 === sets.indexOf(this.defaults.dataset)) {
      if (1 === sets.length) {
        this.defaults.dataset = sets[0]
      } else {
        this.registered_inputs.forEach(u => {
          if (!this.defaults.dataset) {
            const d = u.default
            if (-1 !== sets.indexOf(u.dataset)) {
              this.defaults.dataset = u.dataset
            } else if ('string' === typeof d && -1 !== sets.indexOf(d)) {
              this.defaults.dataset = d
            } else if (
              'select' === u.type &&
              'number' === typeof d &&
              u.options[d] &&
              -1 !== sets.indexOf(u.options[d].value)
            ) {
              this.defaults.dataset = u.options[d].value
            } else if (
              ('select' === u.type || 'combobox' === u.type) &&
              Array.isArray(u.values) &&
              u.values[u.default] &&
              -1 !== sets.indexOf(u.values[u.default])
            ) {
              this.defaults.dataset = u.values[u.default]
            }
          }
        })
        if (!this.defaults.dataset) this.defaults.dataset = sets[sets.length - 1]
      }
      this.defaults.dataset = this.valueOf(this.defaults.dataset) as string
      if (-1 === sets.indexOf(this.defaults.dataset)) this.defaults.dataset = sets[0]
      this.registered_inputs.forEach(u => {
        if (!u.dataset) u.dataset = this.defaults.dataset
      })
      if (!this.spec.dataviews[defaults.dataview].dataset)
        this.spec.dataviews[defaults.dataview].dataset = this.defaults.dataset
    }
    if (spec.rules && spec.rules.length) {
      spec.rules.forEach((r, i) => {
        r.parsed = {}
        if ('display' in r.effects) {
          r.parsed.display = {e: document.getElementById(r.effects.display)}
          const e = r.parsed.display.e.querySelector('.auto-input')
          if (e) {
            const u = this.inputs[e.id]
            u.rule = r
            r.parsed.display.u = u
          }
        }
        if ('lock' in r.effects) {
          const us = new Map()
          document.querySelectorAll('#' + r.effects.lock + ' .auto-input').forEach(e => us.set(e.id, this.inputs[e.id]))
          r.parsed.lock = us
        }
        r.condition.forEach(c => {
          if (c.type in DataHandler.checks) {
            c.check = function (this: {c: SiteCondition; site: Community}) {
              return DataHandler.checks[this.c.type](this.site.valueOf(this.c.id), this.site.valueOf(this.c.value))
            }.bind({c, site: this})
            if (c.id in this.inputs) {
              this.add_dependency(c.id, {type: 'rule', id: c.id, condition: c, rule: i})
              if (!(c.id in this.rule_conditions)) this.rule_conditions[c.id] = []
              this.rule_conditions[c.id][i] = r
            }
            if (c.check()) {
              Object.keys(r.effects).forEach(k => {
                if (k in this.inputs) this.inputs[k].set(this.valueOf(r.effects[k]) as string)
              })
            } else if (c.default) {
              Object.keys(r.effects).forEach(k => {
                if (k in this.inputs) this.inputs[k].set(this.valueOf(c.default) as string)
              })
            }
          }
        })
      })
    }
    const dataset = this.valueOf(this.spec.dataviews[this.defaults.dataview].dataset) as string | number
    this.defaults.dataset = 'number' === typeof dataset ? sets[dataset] : dataset
    if (-1 === sets.indexOf(this.defaults.dataset)) this.defaults.dataset = sets[0]
    this.data = new DataHandler(this.spec, this.defaults, this.data as unknown as DataSets, {
      init: this.init,
      onload: function (this: Community) {
        if (this.data.inited) clearTimeout(this.data.inited.load_screen as NodeJS.Timeout)
        this.data.inited.load_screen = setTimeout(this.drop_load_screen.bind(this), 600)
        delete this.data.onload
      }.bind(this),
      data_load: function (this: Community) {
        Object.keys(this.dependencies).forEach(k => this.request_queue(false, k))
      }.bind(this),
    })
  }
  init() {
    if (this.data.variables) {
      const variable = Object.keys(this.data.variables)
      this.defaults.variable = variable[variable.length - 1]
    }
    Object.keys(this.spec.dataviews).forEach(id => new SiteDataView(this, id, this.spec.dataviews[id]))
    this.view.init()
    this.page.init()
    if (this.query) {
      this.parsed_query = this.data.parse_query(this.query)
      if (this.parsed_query.variables.conditions.length) {
        this.parsed_query.variables.conditions.forEach(f => {
          const info = this.data.variable_info[f.name]
          if (info) this.page.add_filter_condition(f.name, f)
        })
      }
    }
    this.run_queue()
    this.registered_inputs.forEach(async o => {
      const combobox = 'combobox' === o.type
      if (o.optionSource && 'options' in o) {
        if (patterns.palette.test(o.optionSource)) {
          o.options = []
          Object.keys(palettes).forEach(v => o.add(v, palettes[v].name))
          if (-1 === o.default) o.default = defaults.palette
        } else if (patterns.datasets.test(o.optionSource)) {
          if (-1 === o.default) o.default = defaults.dataset
          o.options = []
          this.spec.metadata.datasets.forEach(d => o.add(d))
        } else if ('option_sets' in o) {
          o.sensitive = false
          if (patterns.properties.test(o.optionSource)) {
            this.maps.overlay_property_selectors.push(o)
          }
          if (o.depends) this.add_dependency(o.depends as string, {type: 'options', id: o.id})
          if (o.dataset in this.inputs) this.add_dependency(o.dataset, {type: 'options', id: o.id})
          if (o.view) this.add_dependency(o.view, {type: 'options', id: o.id})
          const v = this.valueOf(o.dataset) || defaults.dataset
          if ('string' === typeof v) {
            if (!o.dataset) o.dataset = v
            if (v in this.data.info) this.conditionals.options(o)
          }
        }
      }
      if (combobox || 'select' === o.type) {
        // resolve options
        if (Array.isArray(o.values)) {
          o.values = {}
          o.display = {}
          let new_display = true
          const select = 'select' === o.type
          o.options.forEach(e => {
            if (select) e.dataset.value = (e as HTMLOptionElement).value
            if (new_display) new_display = e.dataset.value === e.innerText
          })
          o.options.forEach((e, i) => {
            o.values[e.dataset.value] = i
            if (new_display) e.innerText = this.data.format_label(e.dataset.value)
            o.display[e.innerText] = i
          })
          if (!(o.default in o.values) && !(o.default in this.inputs)) {
            o.default = +o.default
            if (isNaN(o.default)) o.default = -1
            if (-1 !== o.default && o.default < o.options.length) {
              o.default = o.options[o.default].dataset.value
            } else {
              o.default = -1
            }
          }
          o.source = ''
          o.id in this.url_options ? o.set(this.url_options[o.id] as string) : o.reset()
        }
        o.subset = o.e.dataset.subset || 'all'
        o.selection_subset = o.e.dataset.selectionSubset || o.subset
        if (o.type in this.spec && o.id in this.spec[o.type]) {
          o.settings = this.spec[o.type][o.id]
          if (o.settings.filters) {
            Object.keys(o.settings.filters).forEach(f => {
              this.add_dependency(o.settings.filters[f], {type: 'filter', id: o.id})
            })
          }
        }
      } else if ('number' === o.type) {
        // retrieve option values
        o.min = o.e.getAttribute('min')
        o.min_ref = parseFloat(o.min)
        o.min_indicator = o.e.parentElement.parentElement.querySelector('.indicator-min')
        if (o.min_indicator) {
          o.min_indicator.addEventListener(
            'click',
            function (this: InputNumber) {
              this.set(this.parsed.min)
            }.bind(o)
          )
        }
        o.max = o.e.getAttribute('max')
        o.max_ref = parseFloat(o.max)
        o.max_indicator = o.e.parentElement.parentElement.querySelector('.indicator-max')
        if (o.max_indicator) {
          o.max_indicator.addEventListener(
            'click',
            function (this: InputNumber) {
              this.set(this.parsed.max)
            }.bind(o)
          )
        }
        o.ref = isNaN(o.min_ref) || isNaN(o.max_ref)
        o.range = [o.min_ref, o.max_ref]
        o.step = parseFloat(o.e.step) || 1
        o.parsed = {min: undefined, max: undefined}
        o.depends = {}
        o.default_max = 'max' === o.default || 'last' === o.default
        o.default_min = 'min' === o.default || 'first' === o.default
        if (o.view) this.add_dependency(o.view, {type: 'update', id: o.id})
        if (!(o.max in this.data.variables)) {
          if (o.max in this.inputs) {
            this.add_dependency(o.max, {type: 'max', id: o.id})
          } else o.e.max = o.max
        } else if (o.view) {
          this.add_dependency(o.view + '_time', {type: 'max', id: o.id})
        }
        if (!(o.min in this.data.variables)) {
          if (o.min in this.inputs) {
            this.add_dependency(o.min, {type: 'min', id: o.id})
          } else o.e.min = o.min
        } else if (o.view) {
          this.add_dependency(o.view + '_time', {type: 'min', id: o.id})
        }
        if ('undefined' !== typeof o.default) {
          if (patterns.number.test(o.default as string)) {
            o.default = +o.default
          } else
            o.reset = o.default_max
              ? function (this: InputNumber) {
                  if (this.range) {
                    this.current_default = this.site.valueOf(this.range[1]) as number
                    this.set(this.current_default)
                  }
                }.bind(o)
              : o.default_max
              ? function (this: InputNumber) {
                  if (this.range) {
                    this.current_default = this.site.valueOf(this.range[0]) as number
                    this.set(this.current_default)
                  }
                }.bind(o)
              : o.default in this.inputs
              ? function (this: InputNumber) {
                  this.current_default = this.site.valueOf(this.default) as number
                  this.set(this.current_default)
                }.bind(o)
              : function () {}
        }
        if (o.variable) {
          const d = -1 === this.spec.metadata.datasets.indexOf(o.dataset) ? defaults.dataset : o.dataset
          if (o.variable in this.inputs) {
            this.add_dependency(o.variable, {type: 'update', id: o.id})
          } else if (o.variable in this.data.variables) {
            o.min = o.parsed.min = o.range[0] = this.data.variables[o.variable].info[d].min
            o.e.min = o.min + ''
            o.max = o.parsed.max = o.range[1] = this.data.variables[o.variable].info[d].max
            o.e.max = o.max + ''
          }
        }
      }
      if ('select' === o.type || 'number' === o.type || 'text' === o.type) {
        if (
          o.e.parentElement.lastElementChild &&
          o.e.parentElement.lastElementChild.classList.contains('select-reset')
        ) {
          o.e.parentElement.lastElementChild.addEventListener('click', o.reset.bind(o))
        }
      }
      if (patterns.settings.test(o.id)) {
        o.setting = o.id.replace(patterns.settings, '')
        if (null == o.default && o.setting in this.spec.settings) o.default = this.spec.settings[o.setting] as string
        this.add_dependency(o.id, {type: 'setting', id: o.id})
      }
      if (!o.view) o.view = defaults.dataview
      const v = this.url_options[o.id] || storage.get(o.id.replace(patterns.settings, ''))
      if ('init' in o) o.init()
      if (v) {
        o.set(v as string)
      } else {
        o.reset()
      }
    })
    this.registered_outputs.forEach(o => {
      if ('init' in o) o.init()
    })
  }
  global_update() {
    this.meta.retain_state = false
    this.queue.elements.forEach(this.request_queue)
    this.registered_outputs.forEach(u => u.update())
  }
  global_reset() {
    this.meta.retain_state = false
    this.registered_inputs.forEach((u, k) => {
      if (!u.setting && u.reset) {
        u.reset()
        this.request_queue(false, k)
      }
    })
  }
  clear_storage() {
    if (window.localStorage) storage.perm.removeItem(storage.name)
    window.location.reload()
  }
  request_queue(waiting: boolean | string, id?: string) {
    if ('boolean' !== typeof waiting) {
      id = waiting as string
      waiting = false
    }
    if (!waiting && (-1 === this.queue.timeout || !this.queue.elements.get(id))) {
      this.queue.elements.set(id, true)
      if ((this.queue.timeout as number) > 0) clearTimeout(this.queue.timeout as number)
      this.queue.timeout = setTimeout(this.run_queue, 20)
      this.meta.lock_after = id
    }
  }
  run_queue() {
    if ((this.queue.timeout as number) > 0) clearTimeout(this.queue.timeout as number)
    this.queue.timeout = -1
    this.queue.elements.forEach((fire, k) => {
      if (fire) {
        const d = this.refresh_conditions(k) as string
        if (d) {
          if (!(k in this.data.data_queue[d])) this.data.data_queue[d][k] = this.run_queue
          return false
        }
        this.queue.elements.set(k, false)
      }
    })
    let k = this.get_options_url()
    if (this.data.inited.first && k !== this.state) {
      this.state = k
      Object.keys(this.url_options).forEach(s => {
        const v = this.url_options[s]
        if ('string' === typeof v && patterns.embed_setting.test(s))
          k += '&' + s + '=' + ('navcolor' === s ? v.replace(patterns.hashes, '%23') : v)
      })
      if (!this.spec.settings.hide_url_parameters) {
        window.history.replaceState(Date.now(), '', k)
      }
      requestAnimationFrame(() => this.page.resize())
    }
  }
  refresh_conditions(id: string) {
    if (id in this.dependencies) {
      const d = this.dependencies[id],
        r: number[] = [],
        c = 'view.' === id.substring(0, 5) ? this.view : id in this.dataviews ? this.dataviews[id] : this.inputs[id],
        is_view = c instanceof SiteDataView,
        is_global = c instanceof GlobalView,
        part = 'id' === id.substring(5) ? 'id_state' : 'filter_state',
        v = is_global ? c[part]() : c && c.value() + '',
        state = is_global ? c.states[part] : c && c.state
      if (c && (!this.meta.retain_state || state !== v)) {
        if (is_global) {
          c.states[part] = v
        } else if (!is_view) {
          const view = this.dataviews[c.view],
            dd =
              v in this.data.loaded ? v : c.dataset ? (this.valueOf(c.dataset) as string) : view && view.get.dataset()
          if (this.data.info && dd in this.data.loaded && !this.data.loaded[dd]) {
            if (!c.deferred) this.data.retrieve(dd, this.data.info[dd].site_file)
            return dd
          }
          c.state = v
        } else {
          c.state = v
        }
        d.forEach(di => {
          if ('rule' === di.type) {
            if (-1 === r.indexOf(di.rule)) {
              r.push(di.rule)
            }
          } else if ('dataview' === di.type) {
            this.dataviews[di.id].update()
          } else if (di.conditional) {
            this.conditionals[di.conditional](di.id in this.dataviews ? this.dataviews[di.id] : this.inputs[di.id], c)
          } else if (di.id in this.inputs) {
            const du = this.inputs[di.id]
            di.type in du && (du[di.type as keyof BaseInput] as Function)()
          } else if (di.id in this.outputs) {
            const du = this.outputs[di.id]
            di.type in du && du[di.type as 'update']()
          }
        })
        r.forEach(i => {
          let pass = false
          const ri = this.spec.rules[i],
            n = ri.condition.length
          for (let i = 0; i < n; i++) {
            const ck = ri.condition[i]
            pass = ck.check()
            if (ck.any ? pass : !pass) break
          }
          Object.keys(ri.parsed).forEach(k => {
            if (pass) {
              if ('display' === k) {
                ri.parsed[k].e.classList.remove('hidden')
              } else if ('lock' === k) {
                ri.parsed[k].forEach((u: InputSelect) => {
                  u.e.classList.remove('locked')
                  utils.toggle_input(u, true)
                })
              } else if (k in this.inputs) {
                const value = this.valueOf(ri.effects[k]) as string
                this.inputs[k].set(value)
              }
            } else if ('display' === k) {
              const e = ri.parsed[k]
              if (!e.e.classList.contains('hidden')) {
                e.e.classList.add('hidden')
                if (e.u && e.u.reset) e.u.reset()
                e.e.querySelectorAll('.auto-input').forEach(c => {
                  const input = this.inputs[c.id]
                  if (input && input.reset) input.reset()
                })
              }
            } else if ('lock' === k) {
              ri.parsed[k].forEach((u: InputSelect) => {
                u.e.classList.add('locked')
                utils.toggle_input(u)
              })
            } else if ('default' in ri) {
              if (k in this.inputs) {
                this.inputs[k].set(this.valueOf(ri.default) as string)
              }
            }
          })
        })
      }
      if (id === this.meta.lock_after) this.meta.retain_state = true
    }
  }
  valueOf(v: boolean | string | number | (string | number)[]): boolean | string | number | (string | number)[] {
    return 'string' === typeof v && v in this.inputs ? this.valueOf(this.inputs[v].value()) : v
  }
  get_options_url() {
    let s = ''
    this.registered_inputs.forEach((u, k) => {
      if ('virtual' !== u.type && !patterns.settings.test(k)) {
        if (!('range' in u) || u.range[0] !== u.range[1]) {
          let v = u.value() as number | string | string[]
          if ('off_default' in u ? u.off_default : v !== u.default) {
            if (Array.isArray(v)) v = v.join(',')
            if ('' !== v && null != v && '-1' != v) s += (s ? '&' : '?') + k + '=' + v
          }
        }
      }
    })
    if (this.data && this.view.filters.size) s += (s ? '&' : '?') + this.view.filter_state([])
    return window.location.protocol + '//' + window.location.host + window.location.pathname + s
  }
  gtag(...args: any) {
    if (this.spec.settings.tracking) (window as any).dataLayer.push(arguments)
  }
  drop_load_screen() {
    if (this.data && this.data.inited) clearTimeout(+this.data.inited.load_screen)
    this.page.wrap.style.visibility = 'visible'
    this.page.load_screen.style.display = 'none'
    if (this.spec.tutorials && 'tutorial' in this.url_options) {
      setTimeout(
        this.page.tutorials.start_tutorial.bind(this.page.tutorials, {
          target: {dataset: {name: this.url_options.tutorial}},
        }),
        0
      )
    }
  }
  add_dependency(id: string, o: Dependency): void {
    if (!(id in this.dependencies)) this.dependencies[id] = []
    if (!o.uid) o.uid = JSON.stringify(o)
    if (o.type in this.conditionals) {
      o.conditional = o.type as keyof typeof conditionals
    }
    const c = this.dependencies[id]
    for (let i = c.length; i--; ) if (o.uid === c[i].uid) return void 0
    c.push(o)
    if (!(id in this.tree)) this.tree[id] = {_n: {children: 0, parents: 0}, children: {}, parents: {}}
    if (!(o.id in this.tree)) this.tree[o.id] = {_n: {children: 0, parents: 0}, children: {}, parents: {}}
    this.tree[id].children[o.id] = this.tree[o.id]
    this.tree[id]._n.children++
    this.tree[o.id].parents[id] = this.tree[id]
    this.tree[o.id]._n.parents++
    c.sort((a, b) => {
      return !(a.id in this.tree) || !(b.id in this.tree)
        ? -Infinity
        : this.tree[a.id]._n.children - this.tree[b.id]._n.children
    })
    this.request_queue(true, id)
  }
  get_color(value: number, which: string, summary: Summary, index: number, rank: number, total: number) {
    const pal = palettes[which]
    if (isNaN(value) || 'continuous-polynomial' === pal.type) return this.defaults.missing
    const settings = this.spec.settings,
      centered = 'none' !== settings.color_scale_center && !settings.color_by_order,
      fixed = 'discrete' === pal.type,
      string = 'string' === summary.type,
      min = !string ? summary.min[index] : 0,
      range = string ? summary.levels.length - min : summary.range[index],
      stat =
        'none' === settings.color_scale_center || patterns.median.test(settings.color_scale_center as string)
          ? 'median'
          : 'mean',
      center_source = ((settings.color_by_order ? 'break_' : 'norm_') + stat) as 'break_mean',
      center = settings.color_by_order
        ? centered
          ? summary[center_source][index] / total
          : 0.5
        : isNaN(summary[center_source][index])
        ? 0.5
        : summary[center_source][index],
      r = fixed
        ? centered && !settings.color_by_order
          ? Math.ceil(pal.colors.length / 2) - pal.odd / 2
          : pal.colors.length
        : 1,
      p = settings.color_by_order
        ? (rank + 0.5) / total
        : range
        ? ((string ? summary.level_ids[value] : value) - min) / range
        : 0.5,
      upper = p > (centered ? center : 0.5),
      bound_ref = upper ? 'upper_' : 'lower_',
      value_min = (bound_ref + stat + '_min') as 'upper_mean_min',
      value_range = (bound_ref + stat + '_range') as 'upper_mean_range'
    let v = centered
      ? range
        ? ((upper ? p - center : p + center) - summary[value_min][index]) / summary[value_range][index]
        : 1
      : p
    if (!fixed) {
      v = Math.max(0, Math.min(1, v))
      if (upper) v = 1 - v
      if (!centered) v *= 2
    }
    return (string ? value in summary.level_ids : 'number' === typeof value)
      ? fixed
        ? pal.colors[
            Math.max(0, Math.min(pal.colors.length - 1, Math.floor(centered ? (upper ? r + r * v : r * v) : r * v)))
          ]
        : 'rgb(' +
          (upper
            ? pal.colors[0][0][0] +
              v * pal.colors[0][1][0] +
              ', ' +
              (pal.colors[0][0][1] + v * pal.colors[0][1][1]) +
              ', ' +
              (pal.colors[0][0][2] + v * pal.colors[0][1][2])
            : pal.colors[2][0][0] +
              v * pal.colors[2][1][0] +
              ', ' +
              (pal.colors[2][0][1] + v * pal.colors[2][1][1]) +
              ', ' +
              (pal.colors[2][0][2] + v * pal.colors[2][1][2])) +
          ')'
      : defaults.missing
  }
}
