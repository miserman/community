import type {SiteInputs} from '../inputs/index'
import {BaseOutput} from './index'
import type Community from '../index'
import type {Entity, ObjectIndex, Order, Summary, Variables} from '../../types'
import DataHandler from '../../data_handler/index'
import type {Api, Config} from 'datatables.net-dt'

type TableVariableSpec = {name: string; title?: string; source?: 'data' | 'features'}
type TableOrderSpec = [number, string][]
type TableFeatureSpec = {title?: string; name?: string}[]
export type DataTableSpec = {
  [index: string]:
    | boolean
    | string
    | string[]
    | TableFeatureSpec
    | TableOrderSpec
    | TableVariableSpec
    | TableVariableSpec[]
  variables?: string | string[] | TableVariableSpec | TableVariableSpec[]
  order?: TableOrderSpec
  features?: string | TableFeatureSpec
  variable_source?: string
}
type TableRowRef = {
  time: number
  entity: {get_value: Function; features: {[index: string]: number}; variables: Variables}
  int: boolean
  offset: number
  variable: string
}
type TableRowGen = {
  int: boolean
  variable: string
  time_range: number[]
  renderer?: (o: OutputDataTable, e: Entity) => void
}
interface DataTableRow {
  node: () => HTMLTableRowElement
  scrollTo: (animate?: boolean) => void
  selector: {
    rows: number
    cols: number
    opts: {
      order: string
      search: string
      page: string
    }
  }
}
interface DataTableCell extends HTMLTableCellElement {
  _DT_CellIndex: {row: number; column: number}
}
interface DataTablesMouseEvent extends MouseEvent {
  target: DataTableCell
}

export class OutputDataTable extends BaseOutput {
  type: 'datatable' = 'datatable'
  table: Api
  style: HTMLStyleElement
  clickto?: SiteInputs
  spec: DataTableSpec
  parsed: {
    summary?: Summary
    order?: Order
    time: number
    color: string
    dataset?: string
    time_index: ObjectIndex
    time_range?: number[]
  } = {time: 0, color: '', time_index: {}}
  time: string
  queue: number | NodeJS.Timeout = -1
  pending: number | NodeJS.Timeout = -1
  state: string = ''
  reference_options: {[index: string]: string} = {}
  header: {
    title: string
    data?: string | Function
    type?: string
    render?: Function
    dataset?: string
    variable?: string
  }[] = []
  rows: {[index: string]: DataTableRow} = {}
  rowIds: {[index: number]: string} = {}
  variable_header = false
  variables: TableVariableSpec | TableVariableSpec[]
  current_filter: {[index: string]: string} = {}
  varstate: string
  constructor(e: HTMLElement, site: Community) {
    super(e, site)
    this.queue_init = this.queue_init.bind(this)
    this.mouseover = this.mouseover.bind(this)
    this.mouseout = this.mouseout.bind(this)
    this.click = this.click.bind(this)
    e.appendChild(document.createElement('thead'))
    e.appendChild(document.createElement('tbody'))
    this.style = document.head.appendChild(document.createElement('style'))
    e.addEventListener('mouseover', this.mouseover)
    e.addEventListener('mouseout', this.mouseout)
    Object.keys(this.spec).forEach(k => {
      const opt = this.spec[k]
      if ('string' === typeof opt && opt in site.inputs) this.reference_options[k] = opt
    })
    if ('string' === typeof this.spec.variables) this.spec.variable_source = this.spec.variables
    if (this.tab) {
      document.getElementById(e.parentElement.getAttribute('aria-labelledby')).addEventListener(
        'click',
        function (this: OutputDataTable) {
          if (!this.e.parentElement.classList.contains('active')) {
            setTimeout(this.update, 155)
            setTimeout(this.site.page.trigger_resize, 155)
          }
        }.bind(this)
      )
    }
  }
  init() {
    this.parsed.dataset = this.site.dataviews[this.view].get.dataset()
    if (this.spec.variables) {
      if ('string' === typeof this.spec.variables) {
        if (this.spec.variables in this.site.inputs) {
          this.site.add_dependency(this.spec.variables, {type: 'update', id: this.id})
          this.spec.variables = this.site.valueOf(this.spec.variables) as string | string[]
          this.spec.single_variable = 'string' === typeof this.spec.variables
        } else if (!this.spec.single_variable) {
          this.spec.variables = [{name: this.spec.variables}]
        }
      }
    } else this.spec.variables = Object.keys(this.site.data.variables)
    if (Array.isArray(this.spec.variables)) {
      const vars = this.spec.variables as string[]
      if (vars.length && 'string' === typeof vars[0]) {
        this.variables = vars.map((v: string): TableVariableSpec => {
          return {
            name: v,
          }
        })
      }
    } else if ('string' === typeof this.spec.variables) {
      this.variables = {name: this.spec.variables}
    }
    const time = this.site.data.meta.times[this.parsed.dataset]
    if (this.spec.single_variable) {
      const c = this.variables as TableVariableSpec
      this.header.push({title: 'Name', data: 'entity.features.name'})
      if (time && time.is_single) this.variable_header = true
      const t = c.name in this.site.data.variables && this.site.data.variables[c.name].time_range[this.parsed.dataset]
      if (t)
        for (let n = t[1] - t[0] + 1; n--; ) {
          this.header[n + 1] = {
            title: this.variable_header ? c.title || this.site.data.format_label(c.name) : time.value[n + t[0]] + '',
            data: this.site.data.get_value,
            render: DataHandler.retrievers.row_time.bind({
              i: n,
              o: t[0],
              format_value: this.site.data.format_value.bind(this.site.data),
            }),
          }
        }
      this.spec.order = [[this.header.length - 1, 'dsc']]
    } else if (this.spec.wide) {
      if (this.spec.features) {
        if ('string' === typeof this.spec.features) this.spec.features = [{name: this.spec.features}]
        this.spec.features.forEach(f => {
          this.header.push({
            title: f.title || f.name,
            data: 'entity.features.' + f.name.replace(this.site.patterns.all_periods, '\\.'),
          })
        })
      }
      const vars = this.variables as TableVariableSpec[]
      for (let i = vars.length; i--; ) {
        const c = vars[i]
        if (!c.source) c.source = c.name in this.site.data.variables ? 'data' : 'features'
        this.header.push(
          'features' === c.source
            ? {
                title: c.title || this.site.data.format_label(c.name),
                data: 'entity.features.' + c.name.toLowerCase().replace(this.site.patterns.all_periods, '\\.'),
              }
            : {
                title: c.title || this.site.data.format_label(c.name),
                render: async function (
                  this: {o: OutputDataTable; c: TableVariableSpec},
                  d: number[],
                  type: string,
                  row: TableRowRef
                ) {
                  if ('data' === this.c.source) {
                    if (this.c.name in this.o.site.data.variables) {
                      const v = await this.o.site.data.get_variable(this.c.name, this.o.site.dataviews[this.o.view])
                      const i = row.time - v.time_range[this.o.parsed.dataset][0]
                      return i < 0 ? NaN : row.entity.get_value(this.c.name, i)
                    } else return NaN
                  } else
                    return this.c.source in row.entity && this.c.name in row.entity[this.c.source]
                      ? row.entity[this.c.source][this.c.name]
                      : NaN
                }.bind({o: this, c}),
              }
        )
      }
    } else {
      if (!time.is_single) {
        this.header.push({
          title: 'Year',
          data: 'entity.time.value',
          render: function (d: number[], type: string, row: TableRowRef) {
            const t = row.time + row.offset
            return d && t >= 0 && t < d.length ? d[t] : NaN
          },
        })
      }
      if (this.spec.features) {
        if ('string' === typeof this.spec.features) this.spec.features = [{name: this.spec.features}]
        this.spec.features.forEach(f => {
          this.header.splice(0, 0, {
            title: f.title || f.name,
            data: 'entity.features.' + f.name.replace(this.site.patterns.all_periods, '\\.'),
          })
        })
      }
      this.header.push({
        title: 'Variable',
        data: function (row: TableRowRef) {
          return row.variable in row.entity.variables
            ? row.entity.variables[row.variable].meta.short_name
            : row.variable
        },
      })
      this.header.push({
        title: 'Value',
        data: this.site.data.get_value,
        render: (d: (string | number)[], type: string, row: TableRowRef) => {
          return d
            ? 'number' === typeof d[row.time]
              ? this.site.data.format_value(d[row.time] as number, row.int)
              : d[row.time]
            : ''
        },
      })
    }
    if (this.view) {
      this.site.add_dependency(this.view, {type: 'update', id: this.id})
      this.site.add_dependency(this.view + '_filter', {type: 'update', id: this.id})
      this.site.add_dependency(this.site.dataviews[this.view].time_agg as string, {type: 'update', id: this.id})
    } else this.view = this.site.defaults.dataview
    const click_ref = this.e.dataset.click
    if (click_ref in this.site.inputs) {
      this.clickto = this.site.inputs[click_ref]
      this.e.addEventListener('click', this.click)
    }
    this.queue_init()
  }
  show(e: Entity) {
    if (e.features && e.features.id in this.rows) {
      if (this.site.spec.settings.table_autoscroll) {
        this.rows[e.features.id].scrollTo('smooth' === this.site.spec.settings.table_scroll_behavior)
      }
      if ((this.pending as number) > 0) clearTimeout(this.pending)
      this.pending = -1
      const row = this.rows[e.features.id].node()
      if (row) {
        row.classList.add('highlighted')
      } else {
        this.pending = setTimeout(
          function (this: DataTableRow) {
            const row = this.node()
            if (row) row.classList.add('highlighted')
          }.bind(this.rows[e.features.id]),
          0
        )
      }
    }
  }
  revert() {
    if ((this.pending as number) > 0) clearTimeout(this.pending)
    this.e.querySelectorAll('tr.highlighted').forEach(e => e.classList.remove('highlighted'))
  }
  queue_init() {
    const showing = this.deferred || !this.tab || this.tab.classList.contains('show')
    if (showing && 'jQuery' in window && 'DataTable' in window && 'get' in this.site.dataviews[this.view]) {
      this.spec.columns = this.header
      this.table = $(this.e).DataTable(this.spec as Config)
      this.update()
    } else {
      this.deferred = true
      setTimeout(this.queue_init, showing ? 0 : 2000)
    }
  }
  async update(pass?: boolean) {
    if ((this.queue as number) > 0) clearTimeout(this.queue)
    this.queue = -1
    if (!pass) {
      if (!this.tab || this.tab.classList.contains('show')) this.queue = setTimeout(() => this.update(true), 50)
    } else {
      if (this.table) {
        let vn =
          this.spec.variable_source &&
          (this.site.valueOf(this.spec.variable_source) as string).replace(this.site.patterns.all_periods, '\\.')
        const v = this.site.dataviews[this.view],
          d = v.get.dataset()
        if (!this.site.data.inited[d]) return
        const settings = this.site.spec.settings,
          times = this.site.data.meta.times[d],
          state =
            d +
            v.value() +
            v.get.time_filters() +
            settings.digits +
            vn +
            settings.theme_dark +
            settings.show_empty_times,
          update = state !== this.state,
          time = this.site.valueOf(v.time_agg),
          variable = await this.site.data.get_variable(vn, v)
        this.parsed.time_range = variable ? variable.time_range[d] : times.info.time_range[d]
        this.parsed.time = ('number' === typeof time ? time - times.range[0] : 0) - this.parsed.time_range[0]
        if (update) {
          this.rows = {}
          this.rowIds = {}
          this.table.clear()
          let redraw = true
          if (v.valid[d]) {
            this.state = state
            Object.keys(this.reference_options).forEach(
              k => (this.spec[k] = this.site.valueOf(this.reference_options[k]) as string)
            )
            if (!Array.isArray(this.variables)) {
              this.parsed.time_index = {}
              this.parsed.dataset = d
              this.parsed.color = vn
              this.parsed.summary = this.view in variable.views ? variable.views[this.view].summaries[d] : undefined
              this.parsed.order =
                this.view in variable.views ? variable.views[this.view].order[d][this.parsed.time] : undefined
              if (this.header.length < 2 || d !== this.header[1].dataset || vn !== this.header[1].variable) {
                this.table.destroy()
                $(this.e).empty()
                this.header = [{title: 'Name', data: 'entity.features.name', type: 'string'}]
                if (-1 !== this.parsed.time_range[0]) {
                  for (let n = this.parsed.time_range[2]; n--; ) {
                    this.header[n + 1] = {
                      dataset: d,
                      variable: vn,
                      type: 'string' === variable.type ? 'string' : 'num',
                      title: this.variable_header
                        ? this.variables.title || this.site.data.format_label(vn)
                        : times.value[n + this.parsed.time_range[0]] + '',
                      data: this.site.data.get_value,
                      render: DataHandler.retrievers.row_time.bind({
                        i: n,
                        o: this.parsed.time_range[0],
                        format_value: this.site.data.format_value.bind(this.site.data),
                      }),
                    }
                  }
                } else this.state = ''
                this.spec.order[0][0] = this.header.length - 1
                this.spec.columns = this.header
                this.table = $(this.e).DataTable(this.spec as Config)
              }
              const n = this.header.length,
                ns = this.parsed.summary.n
              let reset
              for (let i = 1, show = false, nshowing = 0; i < n; i++) {
                show =
                  v.times[i - 1 + this.parsed.time_range[0]] && ((settings.show_empty_times as boolean) || !!ns[i - 1])
                this.table.column(i).visible(show, false)
                if (show) {
                  this.parsed.time_index[times.value[i - 1 + this.parsed.time_range[0]]] = ++nshowing
                  reset = false
                }
              }
              if (reset) this.state = ''
            }
            if (this.spec.wide) {
              Object.keys(v.selection.all).forEach(k => {
                if (vn) {
                  if (vn in v.selection.all[k].views[this.view].summary) {
                    this.rows[k] = this.table.row.add({
                      dataset: d,
                      variable: vn,
                      offset: this.parsed.time_range[0],
                      entity: v.selection.all[k],
                      int:
                        d in this.site.data.variables[vn].info &&
                        'integer' === this.site.data.variables[vn].info[d].type,
                    }) as unknown as DataTableRow
                    this.rowIds[this.rows[k].selector.rows] = k
                  }
                } else {
                  for (let i = times.n; i--; ) {
                    this.rows[k] = this.table.row.add({
                      time: i,
                      entity: v.selection.all[k],
                    }) as unknown as DataTableRow
                    this.rowIds[this.rows[k].selector.rows] = k
                  }
                }
              })
            } else if (Array.isArray(this.variables)) {
              if (this.spec.filters)
                Object.keys(this.spec.filters).forEach(f => {
                  this.current_filter[f] = this.site.valueOf(f) as string
                })
              const va: TableRowGen[] = []
              let varstate = '' + this.parsed.dataset + v.get.single_id() + v.get.features() + settings.digits
              for (let i = this.variables.length; i--; ) {
                vn = this.variables[i].name
                pass = !this.spec.filters
                const variable = await this.site.data.get_variable(vn, v)
                if (vn in this.site.data.variables && 'meta' in variable) {
                  if (this.spec.filters) {
                    for (const c in this.current_filter)
                      if (c in variable.meta) {
                        pass = variable.meta[c as keyof typeof variable.meta] === this.current_filter[c]
                        if (!pass) break
                      }
                  } else pass = true
                }
                if (pass) {
                  varstate += vn
                  va.push({
                    variable: vn,
                    int: this.site.patterns.int_types.test(this.site.data.variables[vn].type),
                    time_range: variable.time_range[d],
                    renderer: function (o, e) {
                      const k = e.features.id,
                        r = this.time_range,
                        n = r[1]
                      for (let i = r[0]; i <= n; i++) {
                        o.rows[k] = o.table.row.add({
                          offset: this.time_range[0],
                          time: i - this.time_range[0],
                          dataset: d,
                          variable: this.variable,
                          entity: e,
                          int: this.int,
                        }) as unknown as DataTableRow
                        o.rowIds[o.rows[k].selector.rows] = k
                      }
                    },
                  })
                }
              }
              if (varstate === this.varstate) return
              this.varstate = varstate
              Object.keys(v.selection.all).forEach(k => {
                const e = v.selection.all[k]
                if (this.spec.single_variable) {
                  if (vn in e.views[this.view].summary && variable.code in e.data) {
                    this.rows[k] = this.table.row.add({
                      offset: this.parsed.time_range[0],
                      dataset: d,
                      variable: vn,
                      entity: e,
                      int: this.site.patterns.int_types.test(this.site.data.variables[vn].type),
                    }) as unknown as DataTableRow
                    this.rowIds[this.rows[k].selector.rows] = k
                  }
                } else {
                  va.forEach(v => {
                    if (this.site.data.variables[v.variable].code in e.data) v.renderer(this, e)
                  })
                }
              })
            }
          }
          redraw ? this.table.draw() : this.table.columns.adjust().draw(false)
        }
        if (this.parsed.time > -1 && this.header.length > 1 && v.time_range.filtered_index) {
          if (this.style.sheet.cssRules.length) this.style.sheet.deleteRule(0)
          if (this.parsed.time_index[time as number])
            this.style.sheet.insertRule(
              '#' +
                this.id +
                ' td:nth-child(' +
                (this.parsed.time_index[time as number] + 1) +
                '){background-color: var(--background-highlight)}',
              0
            )
          if (!update && this.site.spec.settings.table_autosort) {
            this.table
              .column(this.parsed.time + 1)
              .order('dsc')
              .draw()
          }
          if (this.site.spec.settings.table_autoscroll) {
            const w = this.e.parentElement.getBoundingClientRect().width,
              col = this.table.column(this.parsed.time + 1),
              h = col.header().getBoundingClientRect()
            if (h)
              this.e.parentElement.scroll({
                left: h.x - this.e.getBoundingClientRect().x + h.width + 16 - w,
                behavior: (this.site.spec.settings.table_scroll_behavior as ScrollBehavior) || 'smooth',
              })
          }
        }
      }
    }
  }
  mouseover(e: DataTablesMouseEvent) {
    if (e.target._DT_CellIndex && e.target._DT_CellIndex.row in this.rowIds) {
      const id = this.rowIds[e.target._DT_CellIndex.row],
        row = this.rows[id].node()
      if (row) row.classList.add('highlighted')
      if (id in this.site.data.entities) {
        this.site.subs.update(this.id, 'show', this.site.data.entities[id])
      }
    }
  }
  mouseout(e: DataTablesMouseEvent) {
    if (e.target._DT_CellIndex && e.target._DT_CellIndex.row in this.rowIds) {
      const id = this.rowIds[e.target._DT_CellIndex.row],
        row = this.rows[id].node()
      if (row) row.classList.remove('highlighted')
      if (id in this.site.data.entities) {
        this.site.subs.update(this.id, 'revert', this.site.data.entities[id])
      }
    }
  }
  click(e: DataTablesMouseEvent) {
    if (this.clickto && e.target._DT_CellIndex && e.target._DT_CellIndex.row in this.rowIds) {
      const id = this.rowIds[e.target._DT_CellIndex.row]
      if (id in this.site.data.entities) this.clickto.set(id)
    }
  }
}
