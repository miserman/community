(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.DataHandler = factory());
})(this, (function () { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    const defaults = {
        file_format: 'csv',
        table_format: 'mixed',
        features: { ID: 'id', Name: 'name' },
        feature_conditions: [],
        variables: {
            filter_by: [],
            conditions: [],
        },
    };
    const options = {
        file_format: ['csv', 'tsv'],
        table_format: ['tall', 'mixed', 'wide'],
        filter_components: ['first', 'min', 'mean', 'sum', 'max', 'last'],
    };

    const group_checks = {
        '!': function (v) {
            return this !== v;
        },
        '=': function (v) {
            return this === v;
        },
        includes: function (v) {
            return -1 !== this.indexOf(v);
        },
        excludes: function (v) {
            return -1 === this.indexOf(v);
        },
    };
    const export_checks = {
        file_format: function (a) {
            return -1 === options.file_format.indexOf(a);
        },
        table_format: function (a) {
            return -1 === options.table_format.indexOf(a);
        },
        include: function (a, vars) {
            for (let i = a.length; i--;) {
                if (!(a[i] in vars))
                    return a[i];
            }
            return '';
        },
    };
    const value_checks = {
        '!': function (a) {
            return !a || -1 == a;
        },
        '': function (a) {
            return !!a && -1 != a;
        },
        '=': function (a, b) {
            return a === b;
        },
        '!=': function (a, b) {
            return a != b;
        },
        '>': function (a, b) {
            return a > b;
        },
        '<': function (a, b) {
            return a < b;
        },
        '>=': function (a, b) {
            return a >= b;
        },
        '<=': function (a, b) {
            return a <= b;
        },
        equals: function (s, e) {
            return !s || -1 == s || s === e;
        },
        includes: function (s, e) {
            return !s || !s.length || -1 !== s.indexOf(e);
        },
        excludes: function (s, e) {
            return !s || !s.length || -1 === s.indexOf(e);
        },
    };

    function vector_summary(vec, range) {
        if (Array.isArray(vec)) {
            const n = Math.min(range[1] + 1, vec.length), r = {
                missing: 0,
                first: vec[0],
                min: Infinity,
                mean: 0,
                sum: 0,
                max: -Infinity,
                last: vec[n - 1],
            };
            let on = 0;
            for (let i = Math.max(range[0], 0); i < n; i++) {
                const v = vec[i];
                if ('number' === typeof v) {
                    if (isNaN(v)) {
                        r.missing++;
                    }
                    else {
                        on++;
                        if (r.min > v)
                            r.min = v;
                        if (r.max < v)
                            r.max = v;
                        r.sum += v;
                    }
                }
                else {
                    if ('NA' !== v)
                        on++;
                }
            }
            r.mean = on ? r.sum / on : 0;
            return r;
        }
        else {
            return { missing: Number(isNaN(vec)) + 0, first: vec, min: vec, mean: vec, sum: vec, max: vec, last: vec };
        }
    }
    function passes_filter(entity, time_range, filter, variables) {
        const s = {}, adjs = {};
        for (let i = filter.filter_by.length; i--;) {
            const f = filter.filter_by[i];
            const c = variables[f].code;
            if (!(c in entity.data))
                return false;
            const r = entity.group in variables[f].info
                ? variables[f].info[entity.group].time_range
                : variables[f].time_range[entity.group];
            if (!r)
                return false;
            adjs[f] = r[0];
            s[f] = vector_summary(entity.data[c], [time_range[0] - r[0], Math.max(time_range[1] - r[0], time_range[1] - r[1])]);
        }
        for (let i = filter.conditions.length; i--;) {
            const co = filter.conditions[i];
            if (!(co.time_component ? co.check(entity.data[variables[co.name].code], adjs[co.name] || 0) : co.check(s[co.name])))
                return false;
        }
        return true;
    }
    function passes_feature_filter(entities, id, filter) {
        const entity = entities[id];
        for (let i = filter.length; i--;) {
            const value = filter[i].value;
            if (value !== '-1') {
                let pass = false;
                const ck = (id) => {
                    if (!pass) {
                        const group = id in entities && entities[id].group;
                        if (group && group in entity.features
                            ? id === entity.features[group]
                            : id.length < entity.features.id.length
                                ? id === entity.features.id.substring(0, id.length)
                                : id === entity.features.id)
                            pass = true;
                    }
                };
                if ('id' === filter[i].name && Array.isArray(value)) {
                    value.forEach(ck);
                    return pass;
                }
                else {
                    ck(value + '');
                    return pass;
                }
            }
        }
        return true;
    }

    const patterns = {
        seps: /[\s._-]/g,
        comma: /,/,
        word_start: /\b(\w)/g,
        single_operator: /([<>!])([^=])/,
        greater: /%3E$/,
        less: /%3C$/,
        operator_start: /[<>!]$/,
        component: /^(.+)\[(.+)\]/,
        number: /^[0-9.+-]+$/,
        non_letter_num: /[^0-9a-z]+/g,
    };

    function tall(entity, time_range, feats, vars, sep) {
        if (entity.group in this.meta.times) {
            const op = [], time = this.meta.times[entity.group].value;
            let tr = '';
            Object.keys(feats).forEach(f => {
                tr += '"' + entity.features[feats[f]] + '"' + sep;
            });
            vars.forEach(k => {
                const vc = entity.variables[k].code;
                if (vc in entity.data) {
                    const range = this.meta.variables[entity.group][k].time_range;
                    let r = '';
                    const yn = time_range[1] + 1;
                    for (let y = time_range[0]; y < yn; y++) {
                        if (y >= range[0] && y <= range[1]) {
                            const vec = entity.data[vc];
                            const value = Array.isArray(vec) ? vec[y - range[0]] : vec;
                            if (!isNaN(value)) {
                                r += (r ? '\n' : '') + tr + time[y] + sep + '"' + k + '"' + sep + value;
                            }
                        }
                    }
                    if (r)
                        op.push(r);
                }
            });
            return op.join('\n');
        }
        return '';
    }
    function mixed(entity, time_range, feats, vars, sep) {
        if (entity.group in this.meta.times) {
            const op = [], time = this.meta.times[entity.group].value;
            let tr = '';
            Object.keys(feats).forEach(f => {
                tr += '"' + entity.features[feats[f]] + '"' + sep;
            });
            const yn = time_range[1] + 1;
            for (let y = time_range[0]; y < yn; y++) {
                let r = tr + time[y];
                vars.forEach((k) => {
                    const vc = entity.variables[k].code;
                    if (vc in entity.data) {
                        const trange = this.meta.variables[entity.group][k].time_range;
                        const vec = entity.data[vc];
                        let value = NaN;
                        if (Array.isArray(vec)) {
                            if (y >= trange[0] && y <= trange[1])
                                value = vec[y - trange[0]];
                        }
                        else if (y === trange[0]) {
                            value = vec;
                        }
                        r += sep + (isNaN(value) ? 'NA' : value);
                    }
                    else
                        r += sep + 'NA';
                });
                op.push(r);
            }
            return op.join('\n');
        }
        return '';
    }
    function wide(entity, time_range, feats, vars, sep) {
        if (entity.group in this.meta.times) {
            let r = '';
            Object.keys(feats).forEach(f => {
                r += (r ? sep : '') + '"' + entity.features[feats[f]] + '"';
            });
            vars.forEach(k => {
                const vc = entity.variables[k].code;
                const range = this.meta.ranges[k];
                const trange = this.meta.variables[entity.group][k].time_range;
                const yn = time_range[1] + 1;
                for (let y = time_range[0]; y < yn; y++) {
                    if (y >= range[0] && y <= range[1]) {
                        if (vc in entity.data) {
                            const vec = entity.data[vc];
                            let value = NaN;
                            if (Array.isArray(vec)) {
                                if (y >= trange[0] && y <= trange[1])
                                    value = vec[y - trange[0]];
                            }
                            else if (y === trange[0]) {
                                value = vec;
                            }
                            r += sep + (isNaN(value) ? 'NA' : value);
                        }
                        else
                            r += sep + 'NA';
                    }
                }
            });
            return r;
        }
        return '';
    }

    var row_writers = /*#__PURE__*/Object.freeze({
        __proto__: null,
        mixed: mixed,
        tall: tall,
        wide: wide
    });

    function exporter(query_string, entities, in_browser, all_data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!in_browser)
                yield this.data_ready;
            const query = this.parse_query(query_string);
            entities = entities || this.entities;
            if (-1 === options.file_format.indexOf(query.file_format))
                query.file_format = defaults.file_format;
            if (!(query.table_format in row_writers))
                query.table_format = defaults.table_format;
            const res = {
                statusCode: 400,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename=' },
                body: 'Invalid Request',
            }, inc = query.include && query.include.length
                ? 'string' === typeof query.include
                    ? query.include in this.variables
                        ? [query.include]
                        : query.include.split(',')
                    : query.include
                : Object.keys(this.variables), exc = query.exclude || [], vars = [], feats = query.features || JSON.parse(JSON.stringify(defaults.features)), rows = [], range = [Infinity, -Infinity], sep = 'csv' === query.file_format ? ',' : '\t', rw = row_writers[query.table_format].bind(this), no_filter = !query.variables.filter_by.length, no_feature_filter = !query.feature_conditions.length, in_group = !('dataset' in query)
                ? () => true
                : group_checks[query.dataset.operator].bind('number' === typeof query.dataset.value ? query.dataset.value + '' : query.dataset.value);
            let malformed = '';
            inc.forEach(ii => {
                if (ii in this.features && !(ii in feats)) {
                    feats[ii] = this.format_label(ii);
                }
                else if (!(ii in this.variables)) {
                    malformed += ii + ',';
                    if (malformed in this.variables) {
                        inc.push(malformed);
                        malformed = '';
                    }
                }
            });
            for (const k in export_checks)
                if (k in query) {
                    const r = export_checks[k]('include' === k ? inc : query[k], this.variables);
                    if (r) {
                        res.body = 'Failed check for ' + k + ': ' + r;
                        return res;
                    }
                }
            Object.keys(this.variable_codes).forEach(k => {
                if (-1 !== inc.indexOf(this.variable_codes[k].name) && -1 === exc.indexOf(this.variable_codes[k].name)) {
                    vars.push(this.variable_codes[k].name);
                    const tr = this.meta.ranges[this.variable_codes[k].name];
                    if (tr[0] < range[0])
                        range[0] = tr[0];
                    if (tr[1] > range[1])
                        range[1] = tr[1];
                }
            });
            if (query.time_range[0] < range[0])
                query.time_range[0] = range[0];
            if (query.time_range[1] > range[1])
                query.time_range[1] = range[1];
            rows.push(Object.keys(feats).join(sep));
            if ('wide' === query.table_format) {
                vars.forEach(vi => {
                    const tr = this.meta.ranges[vi], yn = Math.min(query.time_range[1], tr[1]) + 1;
                    for (let y = Math.max(query.time_range[0], tr[0]); y < yn; y++) {
                        rows[0] += sep + '"' + vi + '_' + this.meta.overall.value[y] + '"';
                    }
                });
            }
            else
                rows[0] +=
                    sep +
                        'time' +
                        sep +
                        ('mixed' === query.table_format ? vars.map(n => '"' + n + '"') : ['variable', 'value']).join(sep);
            let first_entity = '';
            Object.keys(entities).forEach(k => {
                const e = entities[k];
                if (in_group(e.group) &&
                    (no_feature_filter || passes_feature_filter(entities, k, query.feature_conditions)) &&
                    (no_filter || passes_filter(e, query.time_range, query.variables, this.variables))) {
                    const r = rw(e, query.time_range, feats, vars, sep);
                    if (r) {
                        if (!first_entity)
                            first_entity = k;
                        rows.push(r);
                    }
                }
            });
            res.headers['Content-Type'] = 'text/' + (',' === sep ? 'csv' : 'plain') + '; charset=utf-8';
            res.body = rows.join('\n');
            const times = this.meta.overall.value, filename = 'export_' +
                (in_browser && !all_data && first_entity
                    ? entities[first_entity].group + '_'
                    : query.dataset
                        ? query.dataset.value + '_'
                        : '') +
                (query.time_range[0] === query.time_range[1]
                    ? times[query.time_range[0]]
                    : times[query.time_range[0]] + '-' + times[query.time_range[1]]) +
                '_' +
                (1 === vars.length
                    ? this.variables[vars[0]].meta.short_name.toLowerCase().replace(patterns.non_letter_num, '-')
                    : vars.length + '-variables') +
                '_' +
                (rows.join('\n').split('\n').length - 1) +
                'x' +
                rows[0].split(sep).length;
            if (in_browser) {
                const e = document.createElement('a');
                document.body.appendChild(e);
                e.rel = 'noreferrer';
                e.target = '_blank';
                e.download = filename + '.' + query.file_format;
                e.href = URL.createObjectURL(new Blob([res.body], { type: res.headers['Content-Type'] }));
                setTimeout(function () {
                    e.dispatchEvent(new MouseEvent('click'));
                    URL.revokeObjectURL.bind(null, e.href);
                    document.body.removeChild(e);
                }, 0);
            }
            res.statusCode = 200;
            res.headers['Content-Disposition'] += filename + '.' + query.file_format;
            return res;
        });
    }

    function single(v, t) {
        if (t < 0)
            return NaN;
        if (this.variables[v].is_time) {
            return Array.isArray(this.time.value) && t < this.time.value.length ? this.time.value[t] : NaN;
        }
        else {
            v = this.variables[v].code;
            return 0 === t && v in this.data ? this.data[v] : NaN;
        }
    }
    function multi(v, t) {
        if (t < 0)
            return NaN;
        if (this.variables[v].is_time) {
            return Array.isArray(this.time.value) ? this.time.value[t] : this.time.value;
        }
        else {
            v = this.variables[v].code;
            const value = this.data[v];
            return v in this.data ? (Array.isArray(value) ? (t < value.length ? value[t] : NaN) : 0 === t ? value : NaN) : NaN;
        }
    }
    function row_time(d, type, row) {
        const i = this.i - (row.offset - this.o);
        return d && i >= 0 && i < d.length ? ('number' === typeof d[i] ? this.format_value(d[i], row.int) : d[i]) : NaN;
    }

    var retrievers = /*#__PURE__*/Object.freeze({
        __proto__: null,
        multi: multi,
        row_time: row_time,
        single: single
    });

    function value(v, int) {
        if (null === v || isNaN(v)) {
            return NaN;
        }
        else if (int) {
            return v;
        }
        else {
            return 'number' !== typeof this.settings.settings.digits
                ? v
                : v.toFixed(this.settings.settings.digits > 0 ? this.settings.settings.digits : 0);
        }
    }
    function label(l) {
        return 'string' !== typeof l
            ? ''
            : l in this.variables && this.variables[l].meta && this.variables[l].meta.short_name
                ? this.variables[l].meta.short_name
                : l.replace(patterns.seps, ' ').replace(patterns.word_start, function (w) {
                    return w.toUpperCase();
                });
    }

    function data(d, name) {
        this.sets[name] = d;
        this.loaded[name] = true;
        if (!(name in this.info))
            this.info[name] = { name: name, site_file: name + '.json', schema: { fields: [] }, ids: [] };
        if ('_meta' in d) {
            const time = d._meta.time;
            this.meta.times[name] = time;
            if ('number' === typeof time.value)
                time.value = [time.value];
            const times = time.value;
            time.n = times.length;
            time.is_single = 1 === time.n;
            time.range = [times[0], times[time.n - 1]];
            if (d._meta.time.name in this.variables) {
                time.info = this.variables[time.name];
                time.info.is_time = true;
            }
            if (time.range[0] < this.meta.overall.range[0])
                this.meta.overall.range[0] = time.range[0];
            if (time.range[1] > this.meta.overall.range[1])
                this.meta.overall.range[1] = time.range[1];
            times.forEach((v) => {
                if (-1 === this.meta.overall.value.indexOf(v))
                    this.meta.overall.value.push(v);
            });
            this.meta.overall.value.sort();
            this.meta.variables[name] = d._meta.variables || {};
            Object.keys(this.meta.variables[name]).forEach((k) => {
                if (!(k in this.variables)) {
                    this.variables[k] = {
                        datasets: [name],
                        info: {},
                        time_range: {},
                        type: 'unknown',
                        name: k,
                        code: k,
                        views: {},
                        meta: {
                            full_name: k,
                            measure: k.split(':')[1] || k,
                            short_name: this.format_label(k),
                            long_name: k,
                            type: 'unknown',
                        },
                    };
                    this.variable_info[k] = this.variables[k].meta;
                }
                this.variables[k].name = k;
                this.variables[k].code = this.meta.variables[name][k].code;
                const t = this.meta.variables[name][k].time_range;
                this.variables[k].time_range[name] = t;
                this.variable_codes[this.variables[k].code] = this.variables[k];
                if (-1 !== t[0]) {
                    if (k in this.meta.ranges) {
                        if (t[0] < this.meta.ranges[k][0])
                            this.meta.ranges[k][0] = t[0];
                        if (t[1] > this.meta.ranges[k][1])
                            this.meta.ranges[k][1] = t[1];
                    }
                    else {
                        this.meta.ranges[k] = [t[0], t[1]];
                    }
                }
            });
        }
        this.load_id_maps();
    }
    function id_maps() {
        return __awaiter(this, void 0, void 0, function* () {
            this.metadata.datasets &&
                this.metadata.datasets.forEach((k) => {
                    let has_map = false;
                    k in this.info &&
                        this.info[k].ids.forEach((id, i) => {
                            if ('map' in id) {
                                has_map = true;
                                const map = id.map;
                                if (map in this.data_maps) {
                                    if (this.data_maps[map].retrieved) {
                                        const features = (k in this.data_maps[map].resource ? this.data_maps[map].resource[k] : this.data_maps[map].resource);
                                        this.info[k].schema.fields[i].ids = this.entity_features[k] = features;
                                        this.map_entities(k);
                                    }
                                    else {
                                        const queue = this.data_maps[map].queue;
                                        if (-1 === queue.indexOf(k))
                                            queue.push(k);
                                    }
                                }
                                else if ('string' !== typeof map || id.map_content) {
                                    if ('string' === typeof map) {
                                        this.data_maps[map] = { queue: [], resource: JSON.parse(id.map_content), retrieved: true };
                                        const features = (k in this.data_maps[map].resource ? this.data_maps[map].resource[k] : this.data_maps[map].resource);
                                        this.info[k].schema.fields[i].ids = this.entity_features[k] = features;
                                    }
                                    else {
                                        this.entity_features[k] = map;
                                    }
                                    this.map_entities(k);
                                }
                                else {
                                    this.data_maps[map] = { queue: [k], resource: {}, retrieved: false };
                                    if (this.settings.entity_info && map in this.settings.entity_info) {
                                        const e = this.settings.entity_info;
                                        if ('string' === typeof e[map])
                                            e[map] = JSON.parse(e[map]);
                                        this.ingest_map(e[map], map, i);
                                    }
                                    else if ('undefined' === typeof window) {
                                        require('https')
                                            .get(map, (r) => {
                                            const c = [];
                                            r.on('data', (d) => {
                                                c.push(d);
                                            });
                                            r.on('end', () => {
                                                this.ingest_map(JSON.parse(c.join('')), r.req.protocol + '//' + r.req.host + r.req.path, i);
                                            });
                                        })
                                            .end();
                                    }
                                    else {
                                        const f = new window.XMLHttpRequest();
                                        f.onreadystatechange = function (url, fi) {
                                            if (4 === f.readyState) {
                                                if (200 === f.status) {
                                                    this.ingest_map(JSON.parse(f.responseText), url, fi);
                                                }
                                                else {
                                                    throw new Error('data_handler.ingester.id_maps failed: ' + f.responseText);
                                                }
                                            }
                                        }.bind(this, map, i);
                                        f.open('GET', map, true);
                                        f.send();
                                    }
                                }
                            }
                        });
                    if (!has_map) {
                        this.entity_features[k] = {};
                        this.map_entities(k);
                    }
                });
        });
    }
    function map(m, url, field) {
        this.data_maps[url].resource = m;
        this.data_maps[url].retrieved = true;
        this.data_maps[url].queue.forEach((k) => {
            if (this.info[k].schema.fields.length > field) {
                if (!(k in this.entity_features))
                    this.entity_features[k] = {};
                const features = (k in this.data_maps[url].resource ? this.data_maps[url].resource[k] : this.data_maps[url].resource);
                this.info[k].schema.fields[field].ids = this.entity_features[k] = features;
                this.map_entities(k);
            }
        });
        this.hooks.data_load && this.hooks.data_load();
    }

    function sort_a1(a, b) {
        return isNaN(a[1]) ? (isNaN(b[1]) ? 0 : -1) : isNaN(b[1]) ? 1 : a[1] - b[1];
    }
    function summary_template() {
        return {
            type: 'number',
            filled: false,
            missing: [],
            n: [],
            sum: [],
            max: [],
            q3: [],
            mean: [],
            range: [],
            norm_median: [],
            break_median: [],
            lower_median_min: [],
            lower_median_range: [],
            upper_median_min: [],
            upper_median_range: [],
            norm_mean: [],
            break_mean: [],
            lower_mean_min: [],
            lower_mean_range: [],
            upper_mean_min: [],
            upper_mean_range: [],
            median: [],
            q1: [],
            min: [],
            mode: [],
            level_ids: {},
            levels: [],
        };
    }
    function init(v, d) {
        if (!this.inited_summary[d + v]) {
            this.settings.view_names.forEach((view) => {
                const vi = this.variables[v];
                if (!(view in vi.views))
                    vi.views[view] = {
                        order: {},
                        selected_order: {},
                        selected_summaries: {},
                        summaries: {},
                        state: {},
                        table: {},
                    };
                if (!(d in vi.time_range)) {
                    vi.time_range[d] = [0, this.meta.times[d].n - 1];
                }
                const ny = (vi.time_range[d][2] = vi.time_range[d][1] - vi.time_range[d][0] + 1);
                const m = vi.views[view], c = vi.code;
                if (d in this.sets) {
                    const da = this.sets[d];
                    const n = this.info[d].entity_count;
                    const at = !n || n > 65535 ? Uint32Array : n > 255 ? Uint16Array : Uint8Array;
                    const info = vi.info[d];
                    const is_string = 'string' === info.type;
                    let o = info.order;
                    if (o) {
                        Object.keys(da).forEach((k) => {
                            if (!(k in this.entities))
                                return;
                            if (!(view in this.entities[k].views))
                                this.entities[k].views[view] = { summary: {}, rank: {}, subset_rank: {} };
                            this.entities[k].views[view].rank[v] = new at(ny);
                            this.entities[k].views[view].subset_rank[v] = new at(ny);
                        });
                    }
                    else {
                        info.order = o = [];
                        for (let y = ny; y--;) {
                            o.push([]);
                        }
                        Object.keys(da).forEach((k) => {
                            const dak = da[k];
                            if ('_meta' !== k && c in dak) {
                                const ev = dak[c];
                                if (Array.isArray(ev)) {
                                    for (let y = ny; y--;) {
                                        if (is_string && ev[y] in vi.level_ids) {
                                            ev[y] = vi.level_ids[ev[y]];
                                        }
                                        else if ('number' !== typeof ev[y])
                                            ev[y] = NaN;
                                        o[y].push([k, ev[y]]);
                                    }
                                    Object.freeze(ev);
                                }
                                else {
                                    if (is_string && ev in vi.level_ids) {
                                        o[0].push([k, vi.level_ids[ev]]);
                                    }
                                    else if ('number' !== typeof ev) {
                                        dak[c] = NaN;
                                        o[0].push([k, NaN]);
                                    }
                                    else
                                        o[0].push([k, ev]);
                                }
                                if (!(k in this.entities))
                                    return;
                                if (!(view in this.entities[k].views))
                                    this.entities[k].views[view] = { summary: {}, rank: {}, subset_rank: {} };
                                const eview = this.entities[k].views[view];
                                if (!(v in eview.rank)) {
                                    eview.rank[v] = new at(ny);
                                    eview.subset_rank[v] = new at(ny);
                                }
                            }
                        });
                    }
                    o.forEach((ev, y) => {
                        if (!Object.isFrozen(ev)) {
                            ev.sort(sort_a1);
                            Object.freeze(ev);
                        }
                        ev.forEach((r, i) => {
                            this.entities[r[0]].views[view].rank[v][y] = i;
                        });
                    });
                }
                if (!(d in m.summaries)) {
                    m.order[d] = [];
                    m.selected_order[d] = [];
                    m.selected_summaries[d] = summary_template();
                    const s = summary_template();
                    if ('string' === vi.info[d].type) {
                        s.type = 'string';
                        s.level_ids = vi.level_ids;
                        s.levels = vi.levels;
                        m.table = {};
                        vi.levels.forEach((l) => {
                            m.table[l] = [];
                            for (let y = ny; y--;)
                                m.table[l].push(0);
                        });
                        for (let y = ny; y--;) {
                            m.order[d].push([]);
                            m.selected_order[d].push([]);
                            s.missing.push(0);
                            s.n.push(0);
                            s.mode.push('');
                        }
                        m.summaries[d] = s;
                    }
                    else {
                        for (let y = ny; y--;) {
                            m.order[d].push([]);
                            m.selected_order[d].push([]);
                            m.selected_summaries[d].n.push(0);
                            m.selected_summaries[d].missing.push(0);
                            s.missing.push(0);
                            s.n.push(0);
                            s.sum.push(0);
                            s.max.push(-Infinity);
                            s.q3.push(0);
                            s.mean.push(0);
                            s.norm_median.push(0);
                            s.break_median.push(-1);
                            s.lower_median_min.push(-1);
                            s.lower_median_range.push(-1);
                            s.upper_median_min.push(-1);
                            s.upper_median_range.push(-1);
                            s.norm_mean.push(0);
                            s.break_mean.push(-1);
                            s.lower_mean_min.push(-1);
                            s.lower_mean_range.push(-1);
                            s.upper_mean_min.push(-1);
                            s.upper_mean_range.push(-1);
                            s.median.push(0);
                            s.q1.push(0);
                            s.min.push(Infinity);
                        }
                        m.summaries[d] = s;
                    }
                    Object.seal(m.order[d]);
                    Object.seal(m.selected_order[d]);
                    Object.seal(m.selected_summaries[d]);
                    Object.seal(m.summaries[d]);
                }
            });
        }
    }
    function quantile(p, n, o, x) {
        const a = p * (n - 1), ap = a % 1, bp = 1 - ap, b = o + Math.ceil(a), i = o + Math.floor(a);
        return x[i][1] * ap + x[b][1] * bp;
    }
    function calculate(measure, v, full) {
        return __awaiter(this, void 0, void 0, function* () {
            const view = v && v.id;
            const dataset = v.get.dataset();
            yield this.data_processed[dataset];
            const summaryId = dataset + measure;
            if (!this.inited_summary[summaryId])
                this.init_summary(measure, dataset);
            this.inited_summary[summaryId] = new Promise(resolve => {
                this.summary_ready[summaryId] = resolve;
            });
            const variable = this.variables[measure], m = variable.views[view];
            if (v.valid[dataset] && m.state[dataset] !== v.state) {
                const summary_set = this.settings.settings.summary_selection, s = v.selection[summary_set], a = v.selection.all, mo = m.order[dataset], mso = m.selected_order[dataset], ny = variable.time_range[dataset][2], order = variable.info[dataset].order, levels = variable.levels, level_ids = variable.level_ids, subset = v.n_selected[summary_set] !== v.n_selected.dataset, mss = m.selected_summaries[dataset], ms = m.summaries[dataset], is_string = 'string' === variable.type;
                for (let y = ny; y--;) {
                    mo[y] = subset ? [] : order[y];
                    mso[y] = subset ? [] : order[y];
                    mss.missing[y] = 0;
                    mss.n[y] = 0;
                    ms.missing[y] = 0;
                    ms.n[y] = 0;
                    if (is_string) {
                        ms.mode[y] = '';
                        levels.forEach(k => (m.table[k][y] = 0));
                    }
                    else {
                        ms.sum[y] = 0;
                        ms.mean[y] = 0;
                        ms.max[y] = -Infinity;
                        ms.min[y] = Infinity;
                        ms.break_mean[y] = -1;
                        ms.break_median[y] = -1;
                    }
                }
                order.forEach((o, y) => {
                    const moy = mo[y], msoy = mso[y];
                    let rank = 0;
                    o.forEach(oi => {
                        const k = oi[0], value = oi[1];
                        if (k in s) {
                            const en = s[k].views[view], present = !isNaN(value);
                            if (!y) {
                                if (!(measure in en.summary))
                                    en.summary[measure] = { n: 0, overall: ms, order: mo };
                                en.summary[measure].n = 0;
                            }
                            if (full && subset) {
                                moy.push(oi);
                                if (k in a) {
                                    msoy.push(oi);
                                    if (present) {
                                        mss.n[y]++;
                                    }
                                    else
                                        mss.missing[y]++;
                                }
                            }
                            if (present) {
                                en.subset_rank[measure][y] = rank++;
                                en.summary[measure].n++;
                                ms.n[y]++;
                                if (is_string) {
                                    m.table[levels[value]][y]++;
                                }
                                else {
                                    ms.sum[y] += value;
                                    if (value > ms.max[y])
                                        ms.max[y] = value;
                                    if (value < ms.min[y])
                                        ms.min[y] = value;
                                }
                            }
                            else
                                ms.missing[y]++;
                        }
                    });
                });
                if (full) {
                    mo.forEach((o, y) => {
                        if (is_string) {
                            if (ms.n[y]) {
                                let l = 0;
                                Object.keys(m.table).forEach(k => {
                                    if (m.table[k][y] > m.table[levels[l]][y])
                                        l = level_ids[k];
                                });
                                ms.mode[y] = levels[l];
                            }
                            else
                                ms.mode[y] = '';
                        }
                        else {
                            if (ms.n[y]) {
                                ms.mean[y] = ms.sum[y] / ms.n[y];
                                if (!isFinite(ms.min[y]))
                                    ms.min[y] = ms.mean[y];
                                if (!isFinite(ms.max[y]))
                                    ms.max[y] = ms.mean[y];
                                ms.range[y] = ms.max[y] - ms.min[y];
                                if (1 === ms.n[y]) {
                                    ms.q3[y] = ms.median[y] = ms.q1[y] = null == o[0][1] ? ms.mean[y] : o[0][1];
                                }
                                else {
                                    ms.median[y] = quantile(0.5, ms.n[y], ms.missing[y], o);
                                    ms.q3[y] = quantile(0.75, ms.n[y], ms.missing[y], o);
                                    ms.q1[y] = quantile(0.25, ms.n[y], ms.missing[y], o);
                                }
                                const n = o.length;
                                for (let i = ms.missing[y], bmd = false, bme = false; i < n; i++) {
                                    const v = o[i][1];
                                    if ('number' === typeof v) {
                                        if (!bmd && v > ms.median[y]) {
                                            ms.break_median[y] = i - 1;
                                            bmd = true;
                                        }
                                        if (!bme && v > ms.mean[y]) {
                                            ms.break_mean[y] = i - 1;
                                            bme = true;
                                        }
                                    }
                                    if (bmd && bme)
                                        break;
                                }
                            }
                            else {
                                ms.max[y] = 0;
                                ms.q3[y] = 0;
                                ms.median[y] = 0;
                                ms.q1[y] = 0;
                                ms.min[y] = 0;
                            }
                            if (ms.n[y]) {
                                ms.norm_median[y] = ms.range[y] ? (ms.median[y] - ms.min[y]) / ms.range[y] : 0.5;
                                if (-1 !== ms.break_median[y]) {
                                    ms.lower_median_min[y] = ms.norm_median[y] - (o[ms.missing[y]][1] - ms.min[y]) / ms.range[y];
                                    ms.lower_median_range[y] =
                                        ms.norm_median[y] - ((o[ms.break_median[y]][1] - ms.min[y]) / ms.range[y] - ms.lower_median_min[y]);
                                    ms.upper_median_min[y] = ms.norm_median[y] - (o[ms.break_median[y]][1] - ms.min[y]) / ms.range[y];
                                    ms.upper_median_range[y] =
                                        (o[o.length - 1][1] - ms.min[y]) / ms.range[y] - ms.norm_median[y] - ms.upper_median_min[y];
                                }
                                ms.norm_mean[y] = ms.range[y] ? (ms.mean[y] - ms.min[y]) / ms.range[y] : 0.5;
                                if (-1 !== ms.break_mean[y]) {
                                    ms.lower_mean_min[y] = ms.norm_mean[y] - (o[ms.missing[y]][1] - ms.min[y]) / ms.range[y];
                                    ms.lower_mean_range[y] =
                                        ms.norm_mean[y] - ((o[ms.break_mean[y]][1] - ms.min[y]) / ms.range[y] - ms.lower_mean_min[y]);
                                    ms.upper_mean_min[y] = ms.norm_mean[y] - (o[ms.break_mean[y]][1] - ms.min[y]) / ms.range[y];
                                    ms.upper_mean_range[y] =
                                        (o[o.length - 1][1] - ms.min[y]) / ms.range[y] - ms.norm_mean[y] - ms.upper_mean_min[y];
                                }
                            }
                        }
                    });
                }
                else {
                    for (let y = 0; y < ny; y++) {
                        if (ms.n[y]) {
                            if (is_string) {
                                let q1 = 0;
                                Object.keys(m.table).forEach(k => {
                                    if (m.table[k][y] > m.table[levels[q1]][y])
                                        q1 = level_ids[k];
                                });
                                ms.mode[y] = levels[q1];
                            }
                            else
                                ms.mean[y] = ms.sum[y] / ms.n[y];
                        }
                        else {
                            ms[is_string ? 'mode' : 'mean'][y] = NaN;
                        }
                    }
                }
                ms.filled = true;
                m.state[dataset] = v.state;
                this.summary_ready[summaryId]();
            }
            else
                yield this.summary_ready[summaryId];
        });
    }

    function variables() {
        this.metadata.datasets.forEach((k) => {
            this.data_queue[k] = {};
            const m = this.info[k];
            if (m) {
                m.id_vars = m.ids.map((id) => id.variable);
                m.schema.fields.forEach((v) => {
                    const vn = v.name;
                    if (vn in this.variables) {
                        const ve = this.variables[vn];
                        ve.datasets.push(k);
                        ve.info[k] = v;
                        if ('string' === v.type) {
                            ve.levels = [];
                            ve.level_ids = {};
                            ((v.info && v.info.levels) || Object.keys(v.table)).forEach(l => {
                                if (!(l in ve.level_ids)) {
                                    ve.level_ids[l] = ve.levels.length;
                                    ve.levels.push(l);
                                }
                            });
                        }
                    }
                    else {
                        const ve = (this.variables[vn] = {
                            datasets: [k],
                            info: {},
                            time_range: {},
                            type: v.type,
                            code: vn,
                            name: vn,
                            meta: v.info,
                            levels: [],
                            level_ids: {},
                            table: {},
                            order: [],
                            views: {},
                        });
                        ve.info[k] = v;
                        if ('string' === v.type) {
                            ve.levels = [];
                            ve.level_ids = {};
                            Object.keys(v.table).forEach(l => {
                                ve.level_ids[l] = ve.levels.length;
                                ve.levels.push(l);
                            });
                        }
                        if (!ve.meta)
                            ve.meta = {
                                full_name: vn,
                                measure: vn.split(':')[1] || vn,
                                short_name: this.format_label(vn),
                                type: v.type || 'unknown',
                            };
                        ve.meta.full_name = vn;
                        if (!('measure' in ve.meta))
                            ve.meta.measure = vn.split(':')[1] || vn;
                        if (!('short_name' in ve.meta))
                            ve.meta.short_name = this.format_label(vn);
                        if (!('long_name' in ve.meta))
                            ve.meta.long_name = ve.meta.short_name;
                        if (!(vn in this.variable_info))
                            this.variable_info[vn] = ve.meta;
                    }
                });
            }
        });
    }
    function entities(g) {
        return __awaiter(this, void 0, void 0, function* () {
            if (g in this.sets && !this.inited[g] && g in this.meta.times) {
                const s = this.sets[g], time = this.meta.times[g], retriever = DataHandler.retrievers[time.is_single ? 'single' : 'multi'], datasets = Object.keys(this.sets), infos = this.info;
                Object.keys(s).forEach((id) => {
                    const si = s[id], l = id.length;
                    if ('_meta' !== id) {
                        const overwrite = this.entity_features[g][id];
                        const f = overwrite || { id: id, name: id };
                        f.id = id;
                        if (!f.name)
                            f.name = id;
                        const e = (id in this.entities
                            ? this.entities[id]
                            : {
                                group: g,
                                data: si,
                                variables: this.variables,
                                features: f,
                                views: {},
                            });
                        if (id in this.entities) {
                            e.group = g;
                            e.data = si;
                            e.variables = this.variables;
                            if (!e.features)
                                e.features = {};
                            if (!e.views)
                                e.views = {};
                        }
                        else {
                            this.entities[id] = e;
                        }
                        if (!(id in this.entity_tree))
                            this.entity_tree[id] = { parents: {}, children: {} };
                        const rel = this.entity_tree[id];
                        e.relations = rel;
                        Object.keys(f).forEach((k) => {
                            if (!(k in this.features))
                                this.features[k] = this.format_label(k);
                            if ('id' === k || overwrite || !(k in e.features)) {
                                e.features[k] = f[k];
                            }
                            if (-1 !== this.metadata.datasets.indexOf(k)) {
                                if (!(f[k] in this.entity_tree))
                                    this.entity_tree[f[k]] = { parents: {}, children: {} };
                                this.entity_tree[f[k]].children[id] = rel;
                                rel.parents[f[k]] = this.entity_tree[f[k]];
                            }
                        });
                        if (infos) {
                            datasets.forEach((d) => {
                                const p = d in infos && infos[d].id_length;
                                if (p && p < l) {
                                    const sl = id.substring(0, p);
                                    if (sl in this.sets[d]) {
                                        if (!(sl in this.entity_tree))
                                            this.entity_tree[sl] = { parents: {}, children: {} };
                                        this.entity_tree[sl].children[id] = rel;
                                        rel.parents[sl] = this.entity_tree[sl];
                                    }
                                }
                            });
                        }
                        this.settings.view_names.forEach((v) => {
                            if (!(v in e.views)) {
                                e.views[v] = { summary: {}, rank: {}, subset_rank: {} };
                            }
                        });
                        e.time = time;
                        e.get_value = retriever.bind(e);
                    }
                });
                this.inited[g] = true;
                this.data_promise[g]();
                setTimeout(() => {
                    if (!this.inited.first) {
                        this.hooks.init && this.hooks.init();
                        this.inited.first = true;
                    }
                    g in this.data_queue &&
                        Object.keys(this.data_queue[g]).forEach((id) => {
                            this.data_queue[g][id]();
                            delete this.data_queue[g][id];
                        });
                    this.hooks.onload && this.hooks.onload(g);
                }, 0);
            }
            for (const k in this.info)
                if (Object.prototype.hasOwnProperty.call(this.info, k) && !this.inited[k])
                    return void 0;
            this.all_data_ready();
        });
    }

    const ps = {
        any: /\{(?:categor|variant)/,
        category: /\{categor(?:y|ies)(\.[^}]+?)?\}/g,
        variant: /\{variants?(\.[^}]+?)?\}/g,
        all: /\{(?:categor(?:y|ies)|variants?)(\.[^}]+?)?\}/g,
        desc: /description$/,
    };
    function replace_dynamic(e, p, s, v, d = 'default') {
        p.lastIndex = 0;
        for (let m, k; (m = p.exec(e));) {
            const ss = v && 'v' === m[0].substring(1, 2) ? v : s;
            k = m[1] ? m[1].substring(1) : d;
            if (!(k in ss)) {
                if ('description' in ss && ps.desc.test(k)) {
                    k = d = 'description';
                }
                else if (k === d) {
                    k = 'default';
                }
            }
            const r = ss[k];
            if ('string' === typeof r) {
                while (e.includes(m[0]))
                    e = e.replace(m[0], r);
                p.lastIndex = 0;
            }
        }
        return e;
    }
    function prepare_source(name, o, s, p) {
        const r = { name: 'blank' === name ? '' : name };
        Object.keys(o).forEach(n => {
            const e = o[n];
            r[n] = 'string' === typeof e ? replace_dynamic(e, p, s) : e;
        });
        if (!('default' in r))
            r.default = r.name;
        return r;
    }
    function measure_info(info) {
        Object.keys(info).forEach(name => {
            if (ps.any.test(name)) {
                const base = info[name];
                const bn = Object.keys(base);
                if (base.categories || base.variants) {
                    const categories = Array.isArray(base.categories) ? {} : base.categories || {};
                    const variants = Array.isArray(base.variants) ? {} : base.variants || {};
                    const cats = Array.isArray(base.categories) ? base.categories : Object.keys(categories);
                    if (!cats.length)
                        cats.push('');
                    const vars = Array.isArray(base.variants) ? base.variants : Object.keys(variants);
                    if (!vars.length)
                        vars.push('');
                    cats.forEach(cn => {
                        vars.forEach(vn => {
                            const cs = prepare_source(cn, categories[cn] || {}, variants[vn] || {}, ps.variant);
                            const vs = prepare_source(vn, variants[vn] || {}, categories[cn] || {}, ps.category);
                            const s = Object.assign(Object.assign({}, cs), vs);
                            const r = {};
                            bn.forEach((k) => {
                                if ('categories' !== k && 'variants' !== k) {
                                    const temp = base[k];
                                    r[k] = 'string' === typeof temp ? replace_dynamic(temp, ps.all, cs, vs, k) : temp;
                                }
                            });
                            Object.keys(s).forEach(k => {
                                if (!(k in r) &&
                                    'default' !== k &&
                                    'name' !== k &&
                                    ('description' !== k || !(r.long_description || r.short_description)))
                                    r[k] = s[k];
                            });
                            info[replace_dynamic(name, ps.all, cs, vs)] = r;
                        });
                    });
                }
            }
        });
        return info;
    }
    function query(q) {
        const f = JSON.parse(JSON.stringify(defaults));
        if ('string' === typeof q) {
            if ('?' === q[0])
                q = q.substring(1);
            const aq = q.split('&');
            q = {};
            aq.forEach(aqi => {
                const a = aqi.split('=');
                q[a[0]] = a.length > 1 ? a[1] : '';
            });
        }
        q &&
            Object.keys(q).forEach(k => {
                if ('include' === k || 'exclude' === k || k in f) {
                    f[k] = q[k];
                }
                else {
                    let a = [];
                    if (patterns.single_operator.test(k)) {
                        a = k.replace(patterns.single_operator, '$1=$2').split('=');
                        if (a.length > 1) {
                            k = a[0];
                            q[k] = a[1];
                        }
                    }
                    const aq = patterns.component.exec(k), tf = {
                        name: k.replace(patterns.greater, '>').replace(patterns.less, '<'),
                        component: 'mean',
                        operator: '=',
                        value: patterns.number.test(q[k]) ? +q[k] : q[k],
                        time_component: false,
                        check: () => false,
                    };
                    if ('object' === typeof q[k]) {
                        if ('component' in q[k])
                            tf.component = q[k].component;
                        if ('operator' in q[k])
                            tf.operator = q[k].operator;
                        if ('value' in q[k])
                            tf.value = q[k].value;
                    }
                    k = tf.name;
                    if (aq) {
                        if (-1 !== options.filter_components.indexOf(aq[2])) {
                            tf.component = aq[2];
                            tf.name = aq[1];
                        }
                        else if (patterns.number.test(aq[2])) {
                            const time = +aq[2];
                            const i = time > 0 && time < this.meta.overall.value.length ? time : this.meta.overall.value.indexOf(time);
                            if (-1 !== i) {
                                tf.time_component = true;
                                tf.component = i;
                                tf.name = aq[1];
                            }
                        }
                    }
                    if (patterns.operator_start.test(k) && k[k.length - 1] in DataHandler.checks) {
                        tf.operator = k[k.length - 1];
                        if (!a.length)
                            tf.operator += '=';
                        if (k === tf.name)
                            tf.name = k.substring(0, k.length - 1);
                    }
                    if (undefined === tf.value || '-1' == tf.value)
                        return;
                    if (('=' === tf.operator || '!' === tf.operator) &&
                        'string' === typeof tf.value &&
                        patterns.comma.test(tf.value)) {
                        tf.value = tf.value.split(',');
                        tf.operator = '=' === tf.operator ? 'includes' : 'excludes';
                    }
                    if ('time_range' === tf.name) {
                        if (Array.isArray(tf.value)) {
                            f.time_range = [
                                this.meta.overall.value.indexOf(+tf.value[0]),
                                this.meta.overall.value.indexOf(+tf.value[1]),
                            ];
                        }
                        else {
                            const i = this.meta.overall.value.indexOf(+tf.value);
                            f.time_range =
                                '=' === tf.operator ? [i, i] : '>' === tf.operator ? [i, this.meta.overall.value.length - 1] : [0, i];
                        }
                        if (-1 === f.time_range[0])
                            f.time_range[0] = 0;
                        if (-1 === f.time_range[1])
                            f.time_range[1] = this.meta.overall.value.length ? this.meta.overall.value.length - 1 : 0;
                    }
                    else if ('dataset' === tf.name) {
                        f.dataset = tf;
                    }
                    else if (tf.name in this.features) {
                        if ('id' === tf.name && !tf.value)
                            tf.value = (tf.value + '').split(',');
                        tf.check = group_checks[tf.operator].bind('number' === typeof tf.value ? tf.value + '' : tf.value);
                        f.feature_conditions.push(tf);
                    }
                    else if (tf.name in this.variables) {
                        tf.check = (tf.time_component
                            ? function (d, adj) {
                                const multi = 'number' !== typeof d, i = 'number' === typeof this.condition.component ? this.condition.component - adj : 0;
                                return multi
                                    ? this.check(d[i], this.condition.value)
                                    : !i
                                        ? this.check(d, this.condition.value)
                                        : false;
                            }
                            : function (s) {
                                return this.check(s[this.condition.component], this.condition.value);
                            }).bind({ check: DataHandler.checks[tf.operator], condition: tf });
                        if (-1 === f.variables.filter_by.indexOf(tf.name))
                            f.variables.filter_by.push(tf.name);
                        f.variables.conditions.push(tf);
                    }
                }
            });
        if (!('time_range' in f))
            f.time_range = [0, this.meta.overall.value.length ? this.meta.overall.value.length - 1 : 0];
        return f;
    }

    class DataHandler {
        constructor(settings, defaults, data$1, hooks) {
            this.hooks = {};
            this.defaults = { dataview: 'default_view', time: 'time' };
            this.settings = {};
            this.metadata = { datasets: [] };
            this.info = {};
            this.sets = {};
            this.dynamic_load = false;
            this.all_data_ready = () => false;
            this.data_ready = new Promise(resolve => {
                this.all_data_ready = resolve;
            });
            this.features = {};
            this.variables = {};
            this.variable_codes = {};
            this.variable_info = {};
            this.references = {};
            this.entities = {};
            this.entity_tree = {};
            this.meta = {
                times: {},
                variables: {},
                ranges: {},
                overall: {
                    range: [Infinity, -Infinity],
                    value: [],
                },
            };
            this.loaded = {};
            this.inited = {};
            this.inited_summary = {};
            this.summary_ready = {};
            this.entity_features = {};
            this.data_maps = {};
            this.data_queue = {};
            this.data_promise = {};
            this.data_processed = {};
            this.load_requests = {};
            this.retrieve = function (name, url) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!this.load_requests[name]) {
                        this.load_requests[name] = url;
                        const f = new window.XMLHttpRequest();
                        f.onreadystatechange = () => {
                            if (4 === f.readyState) {
                                if (200 === f.status) {
                                    this.ingest_data(JSON.parse(f.responseText), name);
                                }
                                else {
                                    throw new Error('DataHandler.retrieve failed: ' + f.responseText);
                                }
                            }
                        };
                        f.open('GET', url, true);
                        f.send();
                    }
                });
            };
            this.format_value = value;
            this.format_label = label;
            this.ingest_data = data;
            this.ingest_map = map;
            this.load_id_maps = id_maps;
            this.init_summary = init;
            this.calculate_summary = calculate;
            this.map_variables = variables;
            this.map_entities = entities;
            this.parse_query = query;
            this.export = exporter;
            this.get_variable = function (variable, view) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (variable in this.variables)
                        yield this.calculate_summary(variable, view, true);
                    return this.variables[variable];
                });
            };
            this.get_value = function vector(r) {
                if (this.variables[r.variable].is_time) {
                    return r.entity.time.value;
                }
                else {
                    const v = this.variables[r.variable].code;
                    return (v in r.entity.data ? (Array.isArray(r.entity.data[v]) ? r.entity.data[v] : [r.entity.data[v]]) : [NaN]);
                }
            };
            this.defaults = defaults || {};
            this.settings = settings || {};
            this.metadata = this.settings.metadata || { datasets: [] };
            this.sets = data$1 || {};
            this.hooks = hooks || {};
            this.get_value = this.get_value.bind(this);
            this.dynamic_load = 'dataviews' in this.settings && this.settings.settings && !!this.settings.settings.partial_init;
            this.settings.view_names = this.dynamic_load ? Object.keys(this.settings.dataviews) : ['default_view'];
            if ('string' === typeof this.metadata.datasets)
                this.metadata.datasets = [this.metadata.datasets];
            const init$1 = () => {
                if (!this.metadata.datasets || !this.metadata.datasets.length) {
                    this.metadata.datasets = Object.keys(this.info);
                    if (!this.metadata.datasets.length)
                        this.metadata.datasets = Object.keys(this.sets);
                }
                if (this.metadata.measure_info) {
                    const info = measure_info(this.metadata.measure_info);
                    this.metadata.datasets.forEach((d) => {
                        if (info._references)
                            this.info[d]._references = info._references;
                        const v = this.info[d].schema.fields;
                        v.forEach(e => (e.name in info ? (e.info = info[e.name]) : ''));
                    });
                }
                this.map_variables();
                if (this.metadata.datasets.length) {
                    this.metadata.datasets.forEach((k) => {
                        this.loaded[k] = k in this.sets;
                        this.inited[k] = false;
                        this.data_processed[k] = new Promise(resolve => {
                            this.data_promise[k] = resolve;
                        });
                        if (k in this.info)
                            this.info[k].site_file = (this.metadata.url ? this.metadata.url + '/' : '') + this.info[k].name + '.json';
                        if (this.loaded[k]) {
                            this.ingest_data(this.sets[k], k);
                        }
                        else if (!this.dynamic_load ||
                            (this.settings.settings && !this.settings.settings.partial_init) ||
                            !this.defaults.dataset ||
                            k === this.defaults.dataset) {
                            this.retrieve(k, this.info[k].site_file);
                        }
                    });
                }
                else {
                    setTimeout(() => {
                        this.inited.first = true;
                        this.hooks.init && this.hooks.init();
                        this.hooks.onload && this.hooks.onload();
                    }, 0);
                }
            };
            if (this.metadata.package && !this.metadata.info) {
                if ('undefined' === typeof window) {
                    require('https')
                        .get(this.metadata.url + this.metadata.package, (r) => {
                        const c = [];
                        r.on('data', (d) => {
                            c.push(d);
                        });
                        r.on('end', () => {
                            this.info = {};
                            const dp = JSON.parse(c.join(''));
                            if (dp.measure_info)
                                this.metadata.measure_info = dp.measure_info;
                            dp.resources.forEach((r) => (this.info[r.name] = r));
                            init$1();
                        });
                    })
                        .end();
                }
                else {
                    const f = new window.XMLHttpRequest();
                    f.onreadystatechange = () => {
                        if (4 === f.readyState) {
                            if (200 === f.status) {
                                this.info = {};
                                const dp = JSON.parse(f.responseText);
                                if (dp.measure_info)
                                    this.metadata.measure_info = dp.measure_info;
                                dp.resources.forEach((r) => (this.info[r.name] = r));
                                init$1();
                            }
                            else {
                                throw new Error('failed to load datapackage: ' + f.responseText);
                            }
                        }
                    };
                    f.open('GET', this.metadata.url + this.metadata.package);
                    f.send();
                }
            }
            else {
                if (this.metadata.info)
                    this.info = this.metadata.info;
                init$1();
            }
        }
    }
    DataHandler.retrievers = retrievers;
    DataHandler.checks = value_checks;

    return DataHandler;

}));
//# sourceMappingURL=data_handler.js.map
