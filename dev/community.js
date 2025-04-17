(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Community = factory());
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

    const defaults$1 = {
        file_format: 'csv',
        table_format: 'mixed',
        features: { ID: 'id', Name: 'name' },
        feature_conditions: [],
        variables: {
            filter_by: [],
            conditions: [],
        },
    };
    const options$1 = {
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
            return -1 === options$1.file_format.indexOf(a);
        },
        table_format: function (a) {
            return -1 === options$1.table_format.indexOf(a);
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

    const patterns$1 = {
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
            if (-1 === options$1.file_format.indexOf(query.file_format))
                query.file_format = defaults$1.file_format;
            if (!(query.table_format in row_writers))
                query.table_format = defaults$1.table_format;
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
                : Object.keys(this.variables), exc = query.exclude || [], vars = [], feats = query.features || JSON.parse(JSON.stringify(defaults$1.features)), rows = [], range = [Infinity, -Infinity], sep = 'csv' === query.file_format ? ',' : '\t', rw = row_writers[query.table_format].bind(this), no_filter = !query.variables.filter_by.length, no_feature_filter = !query.feature_conditions.length, in_group = !('dataset' in query)
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
                    ? this.variables[vars[0]].meta.short_name.toLowerCase().replace(patterns$1.non_letter_num, '-')
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
                : l.replace(patterns$1.seps, ' ').replace(patterns$1.word_start, function (w) {
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
        const f = JSON.parse(JSON.stringify(defaults$1));
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
                    if (patterns$1.single_operator.test(k)) {
                        a = k.replace(patterns$1.single_operator, '$1=$2').split('=');
                        if (a.length > 1) {
                            k = a[0];
                            q[k] = a[1];
                        }
                    }
                    const aq = patterns$1.component.exec(k), tf = {
                        name: k.replace(patterns$1.greater, '>').replace(patterns$1.less, '<'),
                        component: 'mean',
                        operator: '=',
                        value: patterns$1.number.test(q[k]) ? +q[k] : q[k],
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
                        if (-1 !== options$1.filter_components.indexOf(aq[2])) {
                            tf.component = aq[2];
                            tf.name = aq[1];
                        }
                        else if (patterns$1.number.test(aq[2])) {
                            const time = +aq[2];
                            const i = time > 0 && time < this.meta.overall.value.length ? time : this.meta.overall.value.indexOf(time);
                            if (-1 !== i) {
                                tf.time_component = true;
                                tf.component = i;
                                tf.name = aq[1];
                            }
                        }
                    }
                    if (patterns$1.operator_start.test(k) && k[k.length - 1] in DataHandler.checks) {
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
                        patterns$1.comma.test(tf.value)) {
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

    const defaults = {
        time: 'time',
        dataview: 'default_view',
        palette: 'vik',
        background_highlight: '#adadad',
        border: '#7e7e7e',
        border_highlight_true: '#ffffff',
        border_highlight_false: '#000000',
        missing: '#00000000',
    };

    class GlobalView {
        constructor(site) {
            this.registered = {};
            this.selection = {};
            this.entities = new Map();
            this.selected = [];
            this.select_ids = {};
            this.filters = new Map();
            this.states = {
                id_state: 'initial',
                filter_state: 'initial',
            };
            this.site = site;
        }
        init() {
            this.times = this.site.data.meta.overall.value;
            this.dataview = this.site.dataviews[this.site.defaults.dataview].parsed;
        }
        filter_state(q, agg) {
            const as_state = !q;
            if (as_state)
                q = [];
            this.filters.forEach(f => {
                const component = 'selected' === f.component
                    ? this.times['undefined' === typeof agg ? this.dataview.time_agg : agg]
                    : f.time_component
                        ? this.times[f.component]
                        : f.component;
                if (f.value)
                    q.push(f.variable + '[' + component + ']' + f.operator + f.value + (as_state ? f.active : ''));
            });
            return q.join('&');
        }
        id_state() {
            return Object.keys(this.select_ids).join(',');
        }
        id_filter() {
            const ids = {};
            this.selected = [];
            this.select_ids = ids;
            if (this.site.data.metadata.datasets) {
                const inputs = this.site.page.modal.filter.entity_inputs;
                this.site.data.metadata.datasets.forEach(d => {
                    if (d in inputs) {
                        const s = inputs[d].value(), cs = [];
                        if (Array.isArray(s)) {
                            s.forEach(id => {
                                const e = this.site.data.entities[id];
                                if (e) {
                                    cs.push(id);
                                    this.selected.push(id);
                                    ids[id] = true;
                                    if (e.relations) {
                                        Object.keys(e.relations.parents).forEach(k => (ids[k] = true));
                                        Object.keys(e.relations.children).forEach(k => (ids[k] = true));
                                    }
                                }
                            });
                            inputs[d].source = cs;
                        }
                    }
                });
            }
        }
    }

    const patterns = {
        seps: /[\s,/._-]+/g,
        period: /\./,
        all_periods: /\./g,
        word_start: /\b(\w)/g,
        settings: /^settings?\./,
        features: /^features?\./,
        filter: /^filter\./,
        data: /^data\./,
        variables: /^variables?\./,
        properties: /prop/,
        palette: /^pal/,
        datasets: /^dat/,
        variable: /^var/,
        levels: /^lev/,
        ids: /^ids/,
        minmax: /^m[inax]{2}$/,
        int_types: /^(?:year|int|integer)$/,
        end_punct: /[.?!]$/,
        mustache: /\{([^}]+)\}/g,
        measure_name: /(?:^measure|_name)$/,
        http: /^https?:\/\//,
        bool: /^(?:true|false)$/,
        number: /^[\d-][\d.,]*$/,
        leading_zeros: /^0+/,
        url_spaces: /%20/g,
        hashes: /#/g,
        embed_setting: /^(?:hide_|navcolor|close_menus)/,
        median: /^med/i,
        location_string: /^[^?]*/,
        time_ref: /\{time\}/g,
        pre_colon: /^[^:]*:/,
        exclude_query: /^(?:features|time_range|id)$/,
        space: /\s+/,
        has_html: /<(?:math|a|br)[/\s>]/,
        href: /\\(?:href|url)\{([^}]+)\}(?:\{([^}]+)\})?/g,
        bracket_content: /(?:^|>)[^<]*(?:<|$)/,
        html_tags: /^(?:semantics|m|a|br)/,
        html_attributes: /^(?:xmlns|display|style|encoding|stretchy|alttext|scriptlevel|fence|math|separator|href|rel|target)/,
        id_escapes: /(?<=#[^\s]+)([.[\](){}?*-])/g,
        repo: /\.com[/:]([^\/]+\/[^\/]+)/,
        basename: /^.*\//,
    };

    const storage = {
        name: window.location.pathname || 'default',
        perm: window.localStorage,
        copy: {},
        set: function (opt, value) {
            const s = JSON.parse(this.perm.getItem(this.name) || '{}');
            s[opt] = value;
            this.perm.setItem(this.name, JSON.stringify(s));
        },
        get: function (opt) {
            const s = JSON.parse(this.perm.getItem(this.name) || '{}');
            return opt ? s[opt] : s;
        },
    };

    class Subscriptions {
        constructor(site) {
            this.site = site;
            this.subs = {};
        }
        add(id, o) {
            if (!(id in this.subs))
                this.subs[id] = new Map();
            this.subs[id].set(o.id, o);
        }
        update(id, fun, e) {
            if (id in this.subs) {
                const tu = this.site.outputs[id];
                this.subs[id].forEach(u => {
                    if (fun in u)
                        u[fun](e, tu);
                });
            }
        }
    }

    const keymap = {
        Enter: 'select',
        NumpadEnter: 'select',
        ArrowUp: 'move',
        Home: 'move',
        ArrowDown: 'move',
        End: 'move',
        Escape: 'close',
        Tab: 'close',
    };
    const filter_components = {
        Time: ['first', 'selected', 'last'],
        summary: ['missing', 'min', 'q1', 'mean', 'median', 'q3', 'max'],
    };
    const tooltip_icon_rule = 'button.has-note::after,.button-wrapper.has-note ' +
        'button::before,.has-note legend::before,.has-note ' +
        'label::before,.wrapper.has-note > div > label::before{display:none}';

    function set_description(e, info) {
        let description = info.long_description || info.description || info.short_description || '';
        const subs = new Map();
        for (let l; (l = patterns.href.exec(description));) {
            subs.set(l[0], '<a href="' + l[1] + '" target="_blank" rel="noreferrer">' + (l.length > 2 ? l[2] : l[1]) + '</a>');
        }
        if (subs.size) {
            subs.forEach((f, r) => {
                description = description.replace(r, f);
            });
        }
        let has_html = patterns.has_html.test(description);
        if (has_html) {
            const tags = description.split(patterns.bracket_content);
            for (let i = tags.length; i--;) {
                const t = tags[i];
                if (t && '/' !== t.substring(0, 1)) {
                    const p = t.split(patterns.space), n = p.length;
                    has_html = patterns.html_tags.test(p[0]);
                    if (!has_html)
                        break;
                    for (let a = 1; a < n; a++) {
                        has_html = patterns.html_attributes.test(p[a]);
                        if (!has_html)
                            break;
                    }
                    if (!has_html)
                        break;
                }
            }
        }
        e[has_html ? 'innerHTML' : 'innerText'] = description;
    }
    function toggle_input(u, enable) {
        if (enable && !u.e.classList.contains('locked')) {
            u.e.removeAttribute('disabled');
            u.e.classList.remove('disabled');
            if ('combobox' === u.type)
                u.input_element.removeAttribute('disabled');
        }
        else {
            u.e.setAttribute('disabled', 'true');
            u.e.classList.add('disabled');
            if ('combobox' === u.type)
                u.input_element.setAttribute('disabled', 'true');
        }
    }
    function fill_ids_options(u, d, out, onend) {
        if (!(d in u.site.data.sets)) {
            u.site.data.data_queue[d][u.id] = () => {
                u.loader && u.e.removeEventListener('click', u.loader);
                fill_ids_options(u, d, out, onend);
                u.set_current();
                u.current_set = d;
            };
            return;
        }
        out[d] = { options: [], values: {}, display: {} };
        const current = u.values, s = out[d].options, values = out[d].values, disp = out[d].display, combobox = 'combobox' === u.type;
        let ck = !u.sensitive && !!u.current_set, n = 0;
        if (u.settings.group) {
            out[d].groups = { e: [], by_name: {} };
            if (combobox && u.settings.accordion) {
                u.listbox.classList.add('accordion');
                u.listbox.id = u.id + '-listbox';
            }
        }
        const ugroup = out[d].groups;
        Object.keys(u.site.data.entities).forEach(k => {
            const entity = u.site.data.entities[k];
            if (d === entity.group) {
                if (ck && !(k in current)) {
                    u.sensitive = true;
                    ck = false;
                }
                if (ugroup) {
                    let groups = entity.features[u.settings.group] || ['No Group'];
                    if (!Array.isArray(groups))
                        groups = [groups];
                    for (let g = groups.length; g--;) {
                        const group = groups[g];
                        if (!(group in ugroup.by_name)) {
                            const e = document.createElement(combobox ? 'div' : 'optgroup');
                            if (combobox) {
                                const id = u.id + '_' + group.replace(patterns.seps, '-');
                                let ee;
                                if (u.settings.accordion) {
                                    e.setAttribute('data-group', group);
                                    e.className = 'combobox-group accordion-item combobox-component';
                                    e.appendChild((ee = document.createElement('div')));
                                    ee.className = 'accordion-header combobox-component';
                                    ee.appendChild((ee = document.createElement('button')));
                                    ee.id = id + '-label';
                                    ee.innerText = group;
                                    ee.type = 'button';
                                    ee.className = 'accordion-button combobox-component collapsed';
                                    ee.setAttribute('data-bs-toggle', 'collapse');
                                    ee.setAttribute('data-bs-target', '#' + id);
                                    ee.setAttribute('aria-expanded', 'false');
                                    ee.setAttribute('aria-controls', id);
                                    e.appendChild((ee = document.createElement('div')));
                                    ee.id = id;
                                    ee.className = 'combobox-component accordion-collapse collapse';
                                    ee.setAttribute('data-bs-parent', '#' + u.id + '-listbox');
                                    ee.appendChild((ee = document.createElement('div')));
                                    ee.className = 'accordion-body combobox-component';
                                    ee.role = 'group';
                                    ee.setAttribute('aria-labelledby', id + '-label');
                                }
                                else {
                                    e.className = 'combobox-group combobox-component';
                                    e.id = id;
                                    e.role = 'group';
                                    e.appendChild((ee = document.createElement('div')));
                                    ee.appendChild((ee = document.createElement('label')));
                                    ee.dataset.for = id;
                                    ee.innerText = group;
                                    ee.id = id + '-label';
                                    ee.className = 'combobox-group-label combobox-component';
                                }
                            }
                            else {
                                e.setAttribute('aria-label', group);
                            }
                            ugroup.by_name[group] = e;
                            ugroup.e.push(e);
                        }
                        const o = u.add(k, entity.features.name, true);
                        o.setAttribute('data-group', group);
                        if (combobox && u.settings.accordion) {
                            ugroup.by_name[group].lastElementChild.lastElementChild.appendChild(o);
                        }
                        else {
                            ugroup.by_name[group].appendChild(o);
                        }
                    }
                }
                else {
                    s.push(u.add(k, entity.features.name));
                    values[k] = n;
                    disp[entity.features.name] = n++;
                }
            }
        });
        if (u.settings.group) {
            n = 0;
            Object.keys(ugroup.by_name).forEach(g => {
                ugroup.by_name[g].querySelectorAll(combobox ? '.combobox-option' : 'option').forEach((c) => {
                    s.push(c);
                    values[combobox ? c.dataset.value : c.value] = n;
                    disp[c.innerText] = n++;
                });
            });
        }
        onend && onend();
    }
    function fill_variables_options(u, d, out) {
        out[d] = { options: [], values: {}, display: {} };
        const current = u.values, s = out[d].options, values = out[d].values, disp = out[d].display, combobox = 'combobox' === u.type;
        let ck = !u.sensitive && !!u.current_set, n = 0;
        if (u.settings.group) {
            out[d].groups = { e: [], by_name: {} };
            if (combobox && u.settings.accordion) {
                u.listbox.classList.add('accordion');
                u.listbox.id = u.id + '-listbox';
            }
        }
        const url_set = u.site.url_options[u.id], ugroup = out[d].groups;
        let ck_suffix = false;
        if (url_set && !(url_set in u.site.data.variables)) {
            u.site.url_options[u.id] = url_set.replace(patterns.pre_colon, '');
            if (!(url_set in u.site.data.variables))
                ck_suffix = true;
        }
        u.site.data.info[d].schema.fields.forEach(m => {
            const v = u.site.data.variables[m.name];
            if (v && !v.is_time) {
                const l = u.site.data.format_label(m.name);
                if (ck && !(m.name in current)) {
                    u.sensitive = true;
                    ck = false;
                }
                if (ugroup) {
                    let groups = (m.info && m.info[u.settings.group]) || ['No Group'];
                    if (!Array.isArray(groups))
                        groups = [groups];
                    for (let g = groups.length; g--;) {
                        const group = groups[g];
                        if (!(group in ugroup.by_name)) {
                            const e = document.createElement(combobox ? 'div' : 'optgroup');
                            if (combobox) {
                                const id = u.id + '_' + group.replace(patterns.seps, '-');
                                let ee;
                                if (u.settings.accordion) {
                                    e.dataset.group = group;
                                    e.className = 'combobox-group accordion-item combobox-component';
                                    e.appendChild((ee = document.createElement('div')));
                                    ee.className = 'accordion-header combobox-component';
                                    ee.appendChild((ee = document.createElement('button')));
                                    ee.id = id + '-label';
                                    ee.innerText = group;
                                    ee.type = 'button';
                                    ee.className = 'accordion-button combobox-component collapsed';
                                    ee.setAttribute('data-bs-toggle', 'collapse');
                                    ee.setAttribute('data-bs-target', '#' + id);
                                    ee.setAttribute('aria-expanded', 'false');
                                    ee.setAttribute('aria-controls', id);
                                    e.appendChild((ee = document.createElement('div')));
                                    ee.id = id;
                                    ee.className = 'combobox-component accordion-collapse collapse';
                                    ee.setAttribute('data-bs-parent', '#' + u.id + '-listbox');
                                    ee.appendChild((ee = document.createElement('div')));
                                    ee.className = 'accordion-body combobox-component';
                                    ee.role = 'group';
                                    ee.setAttribute('aria-labelledby', id + '-label');
                                }
                                else {
                                    e.className = 'combobox-group combobox-component';
                                    e.role = 'group';
                                    e.appendChild((ee = document.createElement('div')));
                                    ee.appendChild((ee = document.createElement('label')));
                                    ee.dataset.for = id;
                                    ee.innerText = group;
                                    ee.id = id;
                                    ee.className = 'combobox-group-label combobox-component';
                                }
                            }
                            else {
                                e.setAttribute('aria-label', group);
                            }
                            ugroup.by_name[group] = e;
                            ugroup.e.push(e);
                        }
                        const o = u.add(m.name, l, true, m);
                        o.dataset.group = group;
                        if (combobox && u.settings.accordion) {
                            ugroup.by_name[group].lastElementChild.lastElementChild.appendChild(o);
                        }
                        else {
                            ugroup.by_name[group].appendChild(o);
                        }
                    }
                }
                else {
                    s.push(u.add(m.name, l, true, m));
                    s[n].id = u.id + '-option' + n;
                    values[m.name] = n;
                    disp[l] = n++;
                }
                if (ck_suffix && url_set === m.name.replace(patterns.pre_colon, '')) {
                    u.site.url_options[u.id] = m.name;
                    ck_suffix = false;
                }
            }
        });
        if (u.settings.group) {
            n = 0;
            Object.keys(ugroup.by_name).forEach(g => {
                ugroup.by_name[g].querySelectorAll(combobox ? '.combobox-option' : 'option').forEach((c) => {
                    s.push(c);
                    s[n].id = u.id + '-option' + n;
                    values[combobox ? c.dataset.value : c.value] = n;
                    disp[(c.firstChild && c.firstChild.textContent) || c.innerText] = n++;
                });
            });
        }
        if (!u.settings.clearable && !(u.default in u.site.data.variables))
            u.default = u.site.defaults.variable;
    }
    function fill_overlay_properties_options(u, source, out) {
        out[source] = { options: [], values: {}, display: {} };
        const current = u.values, s = out[source].options, values = out[source].values, disp = out[source].display; 'combobox' === u.type;
        let ck = !u.sensitive && !!u.current_set, n = 0;
        Object.keys(u.site.maps.queue[source].property_summaries).forEach(v => {
            const l = u.site.data.format_label(v);
            if (ck && !(l in current)) {
                u.sensitive = true;
                ck = false;
            }
            s.push(u.add(v, l));
            s[n].id = u.id + '-option' + n;
            values[v] = n;
            disp[l] = n++;
        });
    }
    function fill_levels_options(u, d, v, out) {
        const m = u.site.data.variables[v].info[d], t = 'string' === m.type ? 'levels' : 'ids', l = m[t];
        if (l) {
            const k = d + v;
            out[k] = { options: [], values: {}, display: {} };
            const current = u.values, s = out[k].options, values = out[k].values, disp = out[k].display;
            let ck = !u.sensitive && !!u.current_set, n = 0;
            Object.keys(l).forEach(k => {
                const lk = l[k];
                if (ck && !(k in current)) {
                    u.sensitive = true;
                    ck = false;
                }
                s.push(u.add(lk.id, lk.name, true));
                values[lk.id] = n;
                disp[lk.name] = n++;
            });
        }
        else if ('ids' === t) {
            u.site.data.data_queue[d][u.id] = function () {
                return fill_levels_options(u, d, v, out);
            };
        }
    }
    function tooltip_trigger() {
        if (this.site.spec.settings.hide_tooltips || this.id === this.site.page.tooltip.showing)
            return void 0;
        const tooltip = this.site.page.tooltip;
        tooltip.showing = this.id;
        tooltip.e.firstElementChild.innerText = this.note;
        tooltip.e.classList.remove('hidden');
        const p = this.wrapper.getBoundingClientRect(), t = tooltip.e.getBoundingClientRect();
        tooltip.e.style.left = Math.max(0, Math.min(p.x, p.x + p.width / 2 - t.width / 2)) + 'px';
        tooltip.e.style.top = p.y + (p.y < t.height ? p.height + 5 : -t.height - 5) + 'px';
    }
    function make_summary_table(formatter, parent, summary, additional) {
        parent.classList.add('info-summary-wrapper');
        const table = document.createElement('table'), headers = document.createElement('tr'), row = document.createElement('tr');
        table.className = 'info-summary';
        table.appendChild(document.createElement('thead'));
        table.appendChild(document.createElement('tbody'));
        table.firstElementChild.appendChild(headers);
        table.lastElementChild.appendChild(row);
        if (additional) {
            Object.keys(additional).forEach(h => {
                const th = document.createElement('th'), td = document.createElement('td');
                headers.appendChild(th);
                th.innerText = h;
                row.appendChild(td);
                td.innerText = additional[h];
            });
        }
        ['NAs', 'Min', 'Q1', 'Mean', 'Median', 'Q3', 'Max'].forEach(h => {
            const lower = h.toLowerCase();
            if (!summary || lower in summary) {
                const th = document.createElement('th'), td = document.createElement('td');
                headers.appendChild(th);
                th.innerText = h;
                row.appendChild(td);
                td.innerText = summary ? formatter(summary[lower]) + '' : 'NA';
            }
        });
        parent.appendChild(table);
        return table;
    }
    function make_variable_source(s, table) {
        const e = document.createElement(table ? 'tr' : 'div');
        let div = document.createElement('div'), a = document.createElement('a'), span = document.createElement('span'), td = document.createElement('td'), p = document.createElement('p');
        if (table) {
            if (s.name) {
                e.appendChild(td);
                if (s.url) {
                    td.appendChild(a);
                    a.target = '_blank';
                    a.rel = 'noreferrer';
                    a.href = s.url;
                    a.innerText = s.name;
                }
                else {
                    td.appendChild(span);
                    span.innerText = s.name;
                }
            }
            if (s.date_accessed) {
                e.appendChild((td = document.createElement('td')));
                td.appendChild((span = document.createElement('span')));
                span.innerText = s.date_accessed;
            }
        }
        else {
            e.className = 'card';
            if (s.name) {
                e.appendChild(div);
                div.className = 'card-header';
                if (s.url) {
                    div.appendChild(a);
                    a.target = '_blank';
                    a.rel = 'noreferrer';
                    a.href = s.url;
                    a.innerText = s.name;
                }
                else {
                    div.appendChild(span);
                    span.innerText = s.name;
                }
            }
            e.appendChild(document.createElement('div'));
            e.lastElementChild.className = 'card-body';
            if (s.location) {
                e.lastElementChild.appendChild(p);
                p.appendChild((span = document.createElement('span')));
                span.innerText = 'Location: ';
                p.appendChild((span = document.createElement('span')));
                if (s.location_url) {
                    span.appendChild((a = document.createElement('a')));
                    a.target = '_blank';
                    a.rel = 'noreferrer';
                    a.href = s.location_url;
                    a.innerText = s.location;
                }
                else {
                    span.innerText = s.location;
                }
            }
            if (s.date_accessed) {
                e.lastElementChild.appendChild((p = document.createElement('p')));
                p.appendChild((span = document.createElement('span')));
                span.innerText = 'Date Accessed: ';
                p.appendChild((span = document.createElement('span')));
                span.innerText = s.date_accessed;
            }
        }
        return e;
    }

    function setting(u) {
        this.spec.settings[u.setting]; const v = u.value(), theme = v ? 'dark' : 'light';
        if (v !== this.spec.settings[u.setting]) {
            this.spec.settings[u.setting] = v;
            if ('theme_dark' === u.setting) {
                v
                    ? document.body.classList.replace('light-theme', 'dark-theme')
                    : document.body.classList.replace('dark-theme', 'light-theme');
                if (this.spec.plotly)
                    Object.keys(this.spec.plotly).forEach(k => this.outputs[k].update_theme());
                if (this.spec.map)
                    Object.keys(this.spec.map).forEach(k => {
                        const u = this.outputs[k];
                        if (u && theme in u.tiles) {
                            Object.keys(u.tiles).forEach(l => {
                                if (theme !== l)
                                    u.tiles[l].removeFrom(u.map);
                            });
                            u.tiles[theme].addTo(u.map);
                        }
                    });
            }
            else if ('hide_url_parameters' === u.setting) {
                window.history.replaceState(Date.now(), '', this.spec.settings.hide_url_parameters
                    ? window.location.protocol + '//' + window.location.host + window.location.pathname
                    : this.get_options_url());
            }
            else if ('hide_tooltips' === u.setting) {
                v ? this.page.script_style.sheet.insertRule(tooltip_icon_rule, 0) : this.page.script_style.sheet.deleteRule(0);
            }
            else if ('map_overlay' === u.setting) {
                Object.keys(this.spec.map).forEach(id => {
                    if ('_' !== id[0]) {
                        const mu = this.outputs[id];
                        if (v) {
                            mu.update();
                        }
                        else {
                            mu.overlay.clearLayers();
                            mu.overlay_control.remove();
                        }
                    }
                });
            }
            else if ('tracking' === u.setting) {
                if (v && this.spec.tag_id) {
                    this.gtag('js', new Date());
                    this.gtag('config', this.spec.tag_id);
                    this.gtag('consent', 'default', { analytics_storage: 'denied' });
                }
                this.gtag('consent', 'update', { analytics_storage: v ? 'granted' : 'denied' });
            }
            else {
                this.global_update();
            }
            this.gtag('event', 'setting', { event_category: u.setting, event_label: v });
            this.storage.set(u.setting, this.spec.settings[u.setting]);
        }
    }
    function options(u) {
        const no_view = !u.view || !this.dataviews[u.view].selection, d = (this.valueOf(u.dataset || no_view || this.spec.dataviews[u.view].dataset) || this.defaults.dataset), va = this.valueOf(u.variable), k = d + (va ? va : ''), combobox = 'combobox' === u.type;
        if (!(k in u.option_sets)) {
            if (this.patterns.variable.test(u.optionSource)) {
                if ('number' === typeof u.default && -1 === u.default)
                    u.default = this.defaults.variable;
                fill_variables_options(u, d, u.option_sets);
            }
            else if (this.patterns.levels.test(u.optionSource)) {
                fill_levels_options(u, d, va, u.option_sets);
            }
            else if (this.patterns.ids.test(u.optionSource)) {
                fill_ids_options(u, d, u.option_sets);
            }
        }
        if (k in u.option_sets) {
            const fresh = k !== u.current_set && (u.sensitive || !u.current_set), c = u[combobox ? 'listbox' : 'e'];
            if (fresh || u.filter || u.selection_subset) {
                if (fresh) {
                    c.innerHTML = '';
                    if (u.option_sets[k].groups)
                        u.groups = u.option_sets[k].groups;
                    u.values = u.option_sets[k].values;
                    u.display = u.option_sets[k].display;
                    u.options = u.option_sets[k].options;
                }
                let ns = 0;
                if ('ID' === u.variable || this.patterns.ids.test(u.optionSource)) {
                    const value = u.value();
                    let selection = -1 === value || '' === value ? u.subset : u.selection_subset, v = {};
                    if (!no_view) {
                        if (selection in this.inputs)
                            selection = this.valueOf(selection);
                        if ('siblings' === selection) {
                            const rel = this.data.entity_tree && this.data.entity_tree[value];
                            if (rel) {
                                const parents = Object.keys(rel.parents);
                                if (parents.length) {
                                    v = {};
                                    parents.forEach(id => {
                                        v = Object.assign(Object.assign({}, v), this.data.entity_tree[id].children);
                                    });
                                }
                            }
                        }
                        else {
                            v = this.dataviews[u.view].selection[selection];
                        }
                    }
                    u.options.forEach((si) => {
                        if (fresh && !u.groups)
                            c.appendChild(si);
                        if (no_view || (combobox ? si.dataset.value : si.value) in v) {
                            si.classList.remove('hidden');
                            ns++;
                        }
                        else {
                            si.classList.add('hidden');
                        }
                    });
                }
                else if (fresh) {
                    u.options.forEach(si => {
                        si.classList.remove('hidden');
                        if (!u.groups)
                            c.appendChild(si);
                        ns++;
                    });
                }
                else
                    ns++;
                if (fresh && u.groups)
                    u.groups.e.forEach(e => c.appendChild(e));
                toggle_input(u, !!ns);
                u.current_set = k;
                if (fresh) {
                    if (combobox) {
                        u.source = [];
                    }
                    else {
                        u.e.selectedIndex = -1;
                        u.source = '';
                    }
                    u.id in this.url_options
                        ? u.set(this.url_options[u.id])
                        : u.state in u.values
                            ? u.set(u.state)
                            : u.reset();
                }
                if (u.filter)
                    u.filter();
            }
        }
    }
    function min(u, c) {
        return __awaiter(this, void 0, void 0, function* () {
            let cv = c.value(), uv = u.value(), v = this.dataviews[u.view || c.view], variable;
            if ('string' === typeof cv) {
                cv = this.patterns.minmax.test(cv) ? c.parsed.min : parseFloat(cv);
            }
            if (v && v.y) {
                variable = this.valueOf(v.y);
                if (variable in this.data.variables) {
                    if (!v.time_range.time.length)
                        yield this.conditionals.time_range(v, u, true);
                    cv = Math.max(v.time_range.time[0], cv);
                }
                u.update();
            }
            u.e.min = ('undefined' === typeof u.parsed.min ? cv : Math.max(u.parsed.min, cv)) + '';
            if (!u.e.value) {
                u.reset();
            }
            else if ('number' === typeof uv && isFinite(uv) && uv < cv) {
                u.set(cv);
            }
            if (u.min_indicator)
                u.min_indicator.firstElementChild.innerText = cv + '';
        });
    }
    function max(u, c) {
        return __awaiter(this, void 0, void 0, function* () {
            let cv = c.value(), uv = u.value(), v = this.dataviews[u.view || c.view], variable;
            if ('string' === typeof cv) {
                cv = this.patterns.minmax.test(cv) ? c.parsed.min : parseFloat(cv);
            }
            if (v && v.y) {
                variable = this.valueOf(v.y);
                if (variable in this.data.variables) {
                    if (!v.time_range.time.length)
                        yield this.conditionals.time_range(v, u, true);
                    cv = Math.min(v.time_range.time[1], cv);
                }
                u.update();
            }
            u.e.max = ('undefined' === typeof u.parsed.max ? cv : Math.min(u.parsed.max, cv)) + '';
            if (!u.e.value) {
                u.reset();
            }
            else if ('number' === typeof uv && isFinite(uv) && uv > cv) {
                u.set(cv);
            }
            if (u.max_indicator)
                u.max_indicator.firstElementChild.innerText = cv + '';
        });
    }
    function time_filters(u) {
        u.time_range.filtered[0] = Infinity;
        u.time_range.filtered[1] = -Infinity;
        const d = u.get.dataset(), time = this.data.meta.times[d], current = u.time_range.filtered_index + '';
        if (!this.data.inited[d])
            return;
        for (let i = time.n; i--;) {
            let pass = false;
            if (i >= u.time_range.index[0] && i <= u.time_range.index[1]) {
                for (let f = u.time_filters.length; f--;) {
                    const v = {}, tf = u.time_filters[f];
                    if (!(tf.value in v))
                        v[tf.value] = this.valueOf(tf.value);
                    pass = DataHandler.checks[tf.type](time.value[i], v[tf.value]);
                    if (!pass)
                        break;
                }
            }
            u.times[i] = pass;
            if (pass) {
                if (u.time_range.filtered[0] > time.value[i])
                    u.time_range.filtered[0] = time.value[i];
                if (u.time_range.filtered[1] < time.value[i])
                    u.time_range.filtered[1] = time.value[i];
            }
        }
        u.time_range.filtered_index = [
            u.time_range.index[0] + u.time_range.filtered[0] - u.time_range.time[0],
            u.time_range.index[1] + u.time_range.filtered[1] - u.time_range.time[1],
        ];
        if (current !== u.time_range.filtered_index + '') {
            const c = this.dependencies[u.id + '_filter'];
            if (c)
                c.forEach(ci => {
                    if ('update' === ci.type) {
                        if (ci.id in this.inputs) {
                            this.inputs[ci.id].update();
                        }
                        else {
                            this.outputs[ci.id].update();
                        }
                    }
                    else if (ci.type in this.conditionals) {
                        this.conditionals[ci.type](this.inputs[ci.id], u);
                    }
                });
        }
    }
    function time_range(u, c, passive) {
        return __awaiter(this, void 0, void 0, function* () {
            const v = c && 'value' in c && c.value(), d = u.get.dataset(), tv = u.time ? this.valueOf(u.time) : this.defaults.time, t = tv in this.data.variables ? this.data.variables[tv].info[d].min : 1, s = this.dependencies[u.id + '_time'], variable = v in this.data.variables ? v : this.valueOf(u.y);
            let r = variable && (yield this.data.get_variable(variable, u));
            if (r) {
                const reset = d + variable != u.time_range.dataset + u.time_range.variable;
                const range = r.time_range[d];
                if (-1 !== range[0]) {
                    u.time_range.dataset = d;
                    u.time_range.variable = variable;
                    u.time_range.index[0] = range[0];
                    u.time_range.time[0] = u.time_range.filtered[0] = t + range[0];
                    u.time_range.index[1] = range[1];
                    u.time_range.time[1] = u.time_range.filtered[1] = t + range[1];
                }
                if (!passive && s) {
                    s.forEach(si => {
                        const su = this.inputs[si.id], value = su.value();
                        if ('min' === si.type) {
                            if (reset || (isFinite(u.time_range.time[0]) && parseFloat(su.e.min) !== u.time_range.time[0])) {
                                su.e.min = u.time_range.time[0] + '';
                                if (reset || !this.meta.retain_state || u.time_range.time[0] > value) {
                                    su.current_default = u.time_range.time[0];
                                    su.set(su.current_default);
                                }
                            }
                        }
                        else if ('max' === si.type) {
                            if (reset || (isFinite(u.time_range.time[1]) && parseFloat(su.e.max) !== u.time_range.time[1])) {
                                su.e.max = u.time_range.time[1] + '';
                                if (reset || !this.meta.retain_state || u.time_range.time[1] < value || value < u.time_range.time[0]) {
                                    su.current_default = u.time_range.time[1];
                                    su.set(su.current_default);
                                }
                            }
                        }
                    });
                    this.conditionals.time_filters(u);
                }
            }
            else {
                u.time_range.dataset = d;
                u.time_range.index[0] = 0;
                u.time_range.time[0] = u.time_range.filtered[0] = 1;
                u.time_range.index[1] = 0;
                u.time_range.time[1] = u.time_range.filtered[1] = 1;
            }
        });
    }

    var conditionals = /*#__PURE__*/Object.freeze({
        __proto__: null,
        max: max,
        min: min,
        options: options,
        setting: setting,
        time_filters: time_filters,
        time_range: time_range
    });

    const palettes = {
        // discrete palettes from https://colorbrewer2.org
        rdylbu7: {
            name: 'Red-Yellow-Blue (7)',
            type: 'discrete',
            colors: ['#d73027', '#fc8d59', '#fee090', '#adadad', '#e0f3f8', '#91bfdb', '#4575b4'],
        },
        orrd7: {
            name: 'Orange-Red (7)',
            type: 'discrete',
            colors: ['#fef0d9', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#990000'],
        },
        gnbu7: {
            name: 'Green-Blue (7)',
            type: 'discrete',
            colors: ['#a8ddb5', '#ccebc5', '#f0f9e8', '#adadad', '#4eb3d3', '#2b8cbe', '#08589e'],
        },
        brbg7: {
            name: 'Brown-Teal (7)',
            type: 'discrete',
            colors: ['#8c510a', '#d8b365', '#f6e8c3', '#adadad', '#c7eae5', '#5ab4ac', '#01665e'],
        },
        puor7: {
            name: 'Purple-Orange (7)',
            type: 'discrete',
            colors: ['#b35806', '#f1a340', '#fee0b6', '#adadad', '#d8daeb', '#998ec3', '#542788'],
        },
        prgn6: {
            name: 'Purple-Green (6)',
            type: 'discrete',
            colors: ['#762a83', '#af8dc3', '#e7d4e8', '#d9f0d3', '#7fbf7b', '#1b7837'],
        },
        reds5: {
            name: 'Red (5)',
            type: 'discrete',
            colors: ['#f1eef6', '#d7b5d8', '#df65b0', '#dd1c77', '#980043'],
        },
        greens5: {
            name: 'Green (5)',
            type: 'discrete',
            colors: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'],
        },
        paired4: {
            name: 'Blue-Green (4)',
            type: 'discrete',
            colors: ['#1f78b4', '#a6cee3', '#b2df8a', '#33a02c'],
        },
        greys4: {
            name: 'Grey (4)',
            type: 'discrete',
            colors: ['#f7f7f7', '#cccccc', '#969696', '#525252'],
        },
        grey: {
            name: 'Grey',
            type: 'continuous',
            colors: [
                [
                    [70, 70, 70],
                    [80, 80, 80],
                ],
                [150, 150, 150],
                [
                    [230, 230, 230],
                    [-80, -80, -80],
                ],
            ],
        },
        brown: {
            name: 'Brown',
            type: 'continuous',
            colors: [
                [
                    [131, 30, 0],
                    [62, 85, 95],
                ],
                [193, 115, 95],
                [
                    [255, 200, 190],
                    [-62, -85, -95],
                ],
            ],
        },
        purple: {
            name: 'Purple',
            type: 'continuous',
            colors: [
                [
                    [90, 14, 213],
                    [52.5, 89, 16],
                ],
                [142.5, 103, 229],
                [
                    [195, 192, 245],
                    [-52.5, -89, -16],
                ],
            ],
        },
        prgn: {
            name: 'Purple-Green',
            type: 'continuous-divergent',
            colors: [
                [
                    [27, 120, 55],
                    [207, 107, 168.5],
                ],
                [234, 227, 223.5],
                [
                    [118, 42, 131],
                    [116, 185, 92.5],
                ],
            ],
        },
        puor: {
            name: 'Purple-Orange',
            type: 'continuous-divergent',
            colors: [
                [
                    [179, 88, 6],
                    [56, 133, 202.5],
                ],
                [235, 221, 208.5],
                [
                    [84, 39, 136],
                    [151, 182, 72.5],
                ],
            ],
        },
        rdbu: {
            name: 'Red-Blue',
            type: 'continuous-divergent',
            colors: [
                [
                    [69, 117, 180],
                    [170, 116.5, 16],
                ],
                [239, 233.5, 196],
                [
                    [215, 48, 39],
                    [24, 185.5, 157],
                ],
            ],
        },
        vik: {
            name: 'vik',
            type: 'continuous-polynomial',
            colors: [
                [97.031, 18.4251, 0.4149],
                [461.7602, 637.5326, 244.4647],
                [-2434.798, -2838.5427, -5893.4695],
                [9665.3469, 14405.823, 44072.722],
                [-2575.9109, -25871.106, -109792.1319],
                [-42510.0569, 8528.3288, 120953.8594],
                [63342.3061, 14006.291, -59644.4457],
                [-26045.0391, -8868.9621, 10155.5667],
            ],
        },
        lajolla: {
            name: 'lajolla',
            type: 'continuous-polynomial',
            colors: [
                [256.0016, 255.9138, 204.945],
                [-187.6735, -46.2889, -768.5655],
                [1022.785, -1057.5602, 1782.0325],
                [-2032.382, 1490.8271, -1785.9056],
                [966.8373, -617.1949, 567.7715],
            ],
        },
    };

    class BaseInput {
        constructor(e, site) {
            this.input = true;
            this.settings = {};
            this.current_index = -1;
            this.previous = '';
            this.state = 'initial';
            this.e = e;
            this.site = site;
            this.default = e.dataset.default;
            this.optionSource = e.dataset.optionsource;
            this.subset = e.dataset.subset || 'all';
            this.selection_subset = e.dataset.selectionsubset || this.subset;
            this.depends = e.dataset.depends;
            this.variable = e.dataset.variable;
            this.dataset = e.dataset.dataset;
            this.view = e.dataset.view;
            this.id = e.id || this.optionSource || 'ui' + site.page.elementCount++;
            this.note = e.getAttribute('aria-description') || '';
            this.type = e.dataset.autotype;
            if (this.type in site.spec) {
                const spec = site.spec[this.type];
                if (this.id in spec)
                    this.settings = spec[this.id];
            }
            if (e.parentElement)
                this.wrapper = e.parentElement.classList.contains('wrapper') ? e.parentElement : e.parentElement.parentElement;
            if (this.wrapper) {
                if (this.note)
                    this.wrapper.classList.add('has-note');
                this.wrapper.setAttribute('data-of', this.id);
                ['div', 'span', 'label', 'fieldset', 'legend', 'input', 'button'].forEach(type => {
                    const c = this.wrapper.querySelectorAll(type);
                    if (c.length)
                        c.forEach(ci => ci.setAttribute('data-of', this.id));
                });
            }
            if (this.note) {
                const trigger = tooltip_trigger.bind(this);
                this.wrapper.addEventListener('mouseover', trigger);
                const p = 'DIV' !== e.tagName ? e : e.querySelector('input');
                if (p) {
                    p.addEventListener('focus', trigger);
                    p.addEventListener('blur', this.site.page.tooltip_clear);
                }
            }
            if (site.patterns.number.test(this.default))
                this.default = +this.default;
        }
        value() {
            if (Array.isArray(this.source))
                return this.source;
            const v = this.site.valueOf(this.source);
            return 'undefined' === typeof v ? this.site.valueOf(this.default) : v;
        }
        set(v) {
            this.source = v;
        }
        reset() {
            this.set(this.site.valueOf(this.default));
        }
    }

    function options_filter() {
        if (this.settings.filters) {
            Object.keys(this.settings.filters).forEach(f => {
                this.current_filter[f] = this.site.valueOf(this.settings.filters[f]);
            });
            let first = '';
            Object.keys(this.values).forEach((v, i) => {
                let pass = false;
                if (v in this.site.data.variables && 'meta' in this.site.data.variables[v]) {
                    const info = this.site.data.variables[v].meta;
                    for (const k in this.current_filter)
                        if (k in info) {
                            pass = info[k] === this.current_filter[k];
                            if (!pass)
                                break;
                        }
                }
                if (pass && !first)
                    first = v;
                this.options[i].classList[pass ? 'remove' : 'add']('hidden');
            });
            this.current_index = this.values[this.value()];
            if (first && (-1 === this.current_index || this.options[this.current_index].classList.contains('hidden'))) {
                this.set(first);
            }
        }
    }
    function set_current_options() {
        const to = this.option_sets[this.dataset];
        this.values = to.values;
        this.display = to.display;
        this.options = to.options;
        this.groups = to.groups;
        this.source = '';
        this.id in this.site.url_options
            ? this.set(this.site.url_options[this.id])
            : this.state in this.values
                ? this.set(this.state)
                : this.reset();
    }
    function loader() {
        if (!this.e.classList.contains('locked')) {
            this.deferred = false;
            this.e.removeEventListener('click', this.loader);
            this.site.request_queue(false, this.id);
        }
    }

    class InputSelect extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'select';
            this.current_filter = {};
            this.values = {};
            this.display = {};
            this.option_sets = {};
            this.current_set = '';
            this.sensitive = false;
            this.filter = options_filter;
            this.reformat_label = false;
            this.set_current = set_current_options;
            this.listen = this.listen.bind(this);
            e.addEventListener('change', this.listen);
            this.options = [...e.querySelectorAll('option')];
            if (this.optionSource && this.site.patterns.ids.test(this.optionSource)) {
                this.loader = loader.bind(this);
                e.addEventListener('click', this.loader);
                this.deferred = true;
            }
            else if ('number' === typeof this.default &&
                this.default > -1 &&
                this.options.length &&
                this.default < this.options.length) {
                this.default = this.options[this.default].value || this.options[this.default].dataset.value;
            }
            if (this.options.length) {
                this.reformat_label = true;
                this.options.forEach((e, i) => {
                    e.dataset.value = e.value;
                    this.values[e.value] = i;
                    if (this.reformat_label)
                        this.reformat_label = e.value === e.innerText;
                });
                const group = e.querySelectorAll('optgroup');
                if (group.length) {
                    this.groups = { e: [], by_name: {} };
                    group.forEach(e => {
                        const name = e.dataset.group;
                        this.groups.e.push(e);
                        this.groups.by_name[name] = e;
                    });
                }
            }
        }
        init() {
            this.options.forEach((e, i) => {
                if (this.reformat_label)
                    e.innerText = this.site.data.format_label(e.value);
                this.display[e.innerText] = i;
            });
        }
        get() {
            this.set(this.e.selectedIndex);
        }
        set(v) {
            if ('string' === typeof v && !(v in this.values) && this.site.patterns.number.test(v))
                v = +v;
            if ('number' === typeof v)
                v = this.options[v] ? this.options[v].value : v;
            if (!(v in this.values) && v in this.display)
                v = this.options[this.display[v]].value;
            if (v !== this.source) {
                this.e.selectedIndex = v in this.values ? this.values[v] : -1;
                this.source = v;
                this.site.request_queue(this.id);
            }
        }
        listen(e) {
            this.set(e.target.selectedIndex);
        }
        add(value, display, noadd, meta) {
            const e = document.createElement('option');
            e.value = value;
            e.innerText = display || this.site.data.format_label(value);
            if (meta && meta.info) {
                e.title = (meta.info.description || meta.info.short_description);
            }
            if (!noadd)
                this.e.appendChild(e);
            this.values[value] = this.display[e.innerText] = this.options.length;
            this.options.push(e);
            return e;
        }
    }

    class InputNumber extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'number';
            this.parsed = { min: -Infinity, max: Infinity };
            this.listen = this.listen.bind(this);
            e.addEventListener('change', this.listen);
            this.update = this.update.bind(this);
            const up = e.parentElement.parentElement.querySelector('.number-up');
            const down = e.parentElement.parentElement.querySelector('.number-down');
            if (down) {
                down.addEventListener('click', () => {
                    this.set(Math.max(this.parsed.min, this.value() - 1));
                });
            }
            if (up) {
                up.addEventListener('click', () => {
                    this.set(Math.min(this.parsed.max, this.value() + 1));
                });
            }
        }
        get() {
            this.set(this.e.value);
        }
        set(v, check) {
            if (!v)
                v = null;
            if ('string' === typeof v)
                v = parseFloat(v);
            if (isFinite(v) && v !== this.source) {
                this.previous = parseFloat(this.e.value);
                if (check) {
                    if (isFinite(this.parsed.min) && v < this.parsed.min) {
                        v = this.parsed.min;
                    }
                    else if (isFinite(this.parsed.max) && v > this.parsed.max) {
                        v = this.parsed.max;
                    }
                }
                this.off_default = v !== this.current_default;
                this.source = v;
                this.e.value = v + '';
                this.current_index = v - this.parsed.min;
                if ('range' === this.e.type) {
                    this.e.nextElementSibling.firstElementChild.innerText = this.e.value;
                }
                this.site.request_queue(this.id);
            }
        }
        listen() {
            this.set(this.e.value, true);
        }
        update() {
            return __awaiter(this, void 0, void 0, function* () {
                const view = this.site.dataviews[this.view], variable = this.site.valueOf(this.variable || view.y);
                // if (!view.time_range) view.time_range = {time: []}
                let d = view.get ? view.get.dataset() : this.site.valueOf(this.dataset), min = (this.site.valueOf(this.min) || view.time), max = (this.site.valueOf(this.max) || view.time);
                if ('string' === typeof min && this.site.patterns.minmax.test(min))
                    min = this.site.inputs[this.min].min;
                if ('string' === typeof max && this.site.patterns.minmax.test(max))
                    max = this.site.inputs[this.max].max;
                this.parsed.min = isNaN(this.min_ref)
                    ? 'undefined' === typeof min
                        ? view.time_range.time[0]
                        : 'number' === typeof min
                            ? min
                            : min in this.site.data.variables
                                ? this.site.data.variables[min].info[d || this.site.data.variables[min].datasets[0]].min
                                : parseFloat(min)
                    : this.min_ref;
                this.parsed.max = isNaN(this.max_ref)
                    ? 'undefined' === typeof max
                        ? view.time_range.time[1]
                        : 'number' === typeof max
                            ? max
                            : max in this.site.data.variables
                                ? this.site.data.variables[max].info[d || this.site.data.variables[max].datasets[0]].max
                                : parseFloat(max)
                    : this.min_ref;
                if (this.default_min) {
                    this.current_default = this.parsed.min;
                }
                else if (this.default_max) {
                    this.current_default = this.parsed.max;
                }
                if (this.ref && variable in this.site.data.variables) {
                    this.range[0] = isNaN(this.min_ref) ? Math.max(view.time_range.time[0], this.parsed.min) : this.min_ref;
                    this.e.min = this.range[0] + '';
                    this.range[1] = isNaN(this.max_ref) ? Math.min(view.time_range.time[1], this.parsed.max) : this.max_ref;
                    this.e.max = this.range[1] + '';
                    if (!this.depends[view.y]) {
                        this.depends[view.y] = true;
                        this.site.add_dependency(view.y, { type: 'update', id: this.id });
                    }
                    if (this.source > this.parsed.max || this.source < this.parsed.min)
                        this.reset();
                    // this.variable = await this.site.data.get_variable(variable, this.view)
                }
                else {
                    this.e.min = this.parsed.min + '';
                    if (this.parsed.min > this.source || (!this.source && this.default_min))
                        this.set(this.parsed.min);
                    this.e.max = this.parsed.max + '';
                    if (this.parsed.max < this.source || (!this.source && this.default_max))
                        this.set(this.parsed.max);
                }
            });
        }
    }

    const time_funs = {
        number: function (v) {
            return this - v.range[0];
        },
        first: function (v) {
            return 0;
        },
        selected: function (v, p) {
            return p.time_agg - v.range[0];
        },
        last: function (v) {
            return v.range[1] - v.range[0];
        },
    };
    function component_fun(times, c) {
        if ('string' === typeof c && patterns.number.test(c)) {
            c = times.indexOf(+c);
            if (-1 === c)
                return function () {
                    return NaN;
                };
        }
        return 'number' === typeof c
            ? time_funs.number.bind(c)
            : c in time_funs
                ? time_funs[c]
                : function () {
                    return NaN;
                };
    }

    class SiteDataView {
        constructor(site, id, spec) {
            this.time_range = {
                dataset: '',
                variable: '',
                filtered: [-Infinity, Infinity],
                filtered_index: [-Infinity, Infinity],
                index: [-Infinity, Infinity],
                time: [-Infinity, Infinity],
            };
            this.state = 'initial';
            this.valid = {};
            this.parsed = {
                dataset: '',
                ids: false,
                features: '',
                variables: '',
                time_filters: '',
                time_agg: 0,
                id_source: '',
                palette: '',
                variable_values: new Map(),
                feature_values: {},
            };
            this.selection = {
                ids: {},
                children: {},
                features: {},
                variables: {},
                dataset: {},
                filtered: {},
                full_filter: {},
                all: {},
            };
            this.n_selected = {
                ids: 0,
                children: 0,
                features: 0,
                variables: 0,
                dataset: 0,
                filtered: 0,
                full_filter: 0,
                all: 0,
            };
            this.site = site;
            this.id = id;
            this.update = this.update.bind(this);
            site.dataviews[id] = this;
            if (spec)
                Object.keys(spec).forEach((k) => {
                    this[k] = spec[k];
                });
            if ('string' === typeof this.palette && this.palette in this.site.inputs) {
                this.site.add_dependency(this.palette, { type: 'dataview', id: id });
            }
            if ('string' === typeof this.dataset && this.dataset in this.site.inputs) {
                this.site.add_dependency(this.dataset, { type: 'dataview', id: id });
            }
            if ('string' === typeof this.ids && this.ids in this.site.inputs) {
                this.site.add_dependency(this.ids, { type: 'dataview', id: id });
            }
            this.site.add_dependency(id, { type: 'time_range', id: id });
            this.site.add_dependency('view.filter', { type: 'dataview', id: id });
            this.site.add_dependency('view.id', { type: 'dataview', id: id });
            if (this.x in this.site.inputs)
                this.site.add_dependency(this.x, { type: 'time_range', id: id });
            if (this.y in this.site.inputs)
                this.site.add_dependency(this.y, { type: 'time_range', id: id });
            if (this.features) {
                Object.keys(this.features).forEach(f => {
                    const value = this.features[f];
                    if ('string' === typeof value && value in this.site.inputs) {
                        this.site.add_dependency(value, { type: 'dataview', id: id });
                    }
                });
            }
            if (this.variables) {
                this.variables.forEach(v => {
                    if (v.variable in this.site.inputs) {
                        this.site.add_dependency(v.variable, { type: 'dataview', id: id });
                    }
                    if (!('type' in v))
                        v.type = '=';
                    if (v.type in this.site.inputs) {
                        this.site.add_dependency(v.type, { type: 'dataview', id: id });
                    }
                    if (!('value' in v))
                        v.value = 0;
                    if ('string' === typeof v.value && v.value in this.site.inputs) {
                        this.site.add_dependency(v.value, { type: 'dataview', id: id });
                    }
                });
            }
            this.compile();
        }
        value() {
            if (this.get) {
                this.reparse();
                return ('' +
                    this.parsed.dataset +
                    this.site.view.entities.size +
                    this.site.data.inited[this.parsed.dataset] +
                    this.parsed.id_source +
                    Object.keys(this.parsed.ids) +
                    this.parsed.features +
                    this.parsed.variables +
                    this.parsed.palette +
                    this.site.spec.settings.summary_selection);
            }
        }
        update() {
            const state = this.value();
            if (state !== this.state && this.site.view.registered[this.parsed.dataset]) {
                if (this.site.data.inited[this.parsed.dataset]) {
                    this.valid[this.parsed.dataset] = true;
                    this.n_selected.ids = 0;
                    this.n_selected.children = 0;
                    this.n_selected.features = 0;
                    this.n_selected.variables = 0;
                    this.n_selected.dataset = 0;
                    this.n_selected.filtered = 0;
                    this.n_selected.full_filter = 0;
                    this.n_selected.all = 0;
                    this.selection.ids = {};
                    this.selection.children = {};
                    this.selection.features = {};
                    this.selection.variables = {};
                    this.selection.dataset = {};
                    this.selection.filtered = {};
                    this.selection.full_filter = {};
                    this.selection.all = {};
                    this.site.view.filters.forEach(f => {
                        f.passed = 0;
                        f.failed = 0;
                    });
                    this.site.view.entities.forEach(e => {
                        const c = this.check(e), id = e.features.id;
                        if (c.ids) {
                            this.selection.ids[id] = e;
                            this.n_selected.ids++;
                            c.all++;
                        }
                        if (c.features) {
                            this.selection.features[id] = e;
                            this.n_selected.features++;
                            c.all++;
                        }
                        if (c.variables) {
                            this.selection.variables[id] = e;
                            this.n_selected.variables++;
                            c.all++;
                        }
                        if (c.dataset) {
                            this.selection.dataset[id] = e;
                            this.n_selected.dataset++;
                            c.all++;
                        }
                        if (c.dataset && c.ids) {
                            this.selection.children[id] = e;
                            this.n_selected.children++;
                        }
                        if (c.features && c.variables) {
                            this.selection.full_filter[id] = e;
                            this.n_selected.full_filter++;
                        }
                        if (c.variables && c.features && c.ids) {
                            this.selection.filtered[id] = e;
                            this.n_selected.filtered++;
                        }
                        if (4 === c.all) {
                            this.selection.all[id] = e;
                            this.n_selected.all++;
                        }
                    });
                    this.site.request_queue(this.id);
                }
                else {
                    this.valid[this.parsed.dataset] = false;
                    this.site.data.data_queue[this.parsed.dataset][this.id] = this.update;
                }
            }
        }
        compile() {
            this.times = [];
            if (this.time_filters) {
                this.time_filters = [
                    { variable: this.site.defaults.time, type: '>=', value: 'filter.time_min' },
                    { variable: this.site.defaults.time, type: '<=', value: 'filter.time_max' },
                ];
                this.site.add_dependency(this.id + '_time', { type: 'min', id: 'filter.time_min' });
                this.site.add_dependency(this.id + '_time', { type: 'max', id: 'filter.time_max' });
                this.time_filters.forEach(f => {
                    if ('string' === typeof f.value && f.value in this.site.inputs) {
                        this.site.add_dependency(f.value, { type: 'time_filters', id: this.id });
                    }
                });
            }
            this.get = {
                dataset: () => {
                    let d = this.site.defaults.dataset;
                    if ('string' === typeof this.dataset && this.dataset in this.site.inputs) {
                        d = this.site.valueOf(this.site.inputs[this.dataset].value());
                        if (!(d in this.site.data.data_queue)) {
                            d = this.site.defaults.dataset;
                            this.site.inputs[this.dataset].set(d);
                        }
                    }
                    else {
                        d = this.site.valueOf(this.dataset);
                    }
                    return d in this.site.data.data_queue ? d : this.site.defaults.dataset;
                },
                single_id: () => {
                    const id = this.site.valueOf('string' === typeof this.ids && this.ids in this.site.inputs ? this.site.inputs[this.ids].value() : this.ids);
                    return 'string' === typeof id ? id : '';
                },
                ids: () => {
                    const id = this.site.valueOf('string' === typeof this.ids && this.ids in this.site.inputs ? this.site.inputs[this.ids].value() : this.ids);
                    if ('string' === typeof id && '' !== id && '-1' !== id) {
                        const ids = {}, e = this.site.data.entities[id];
                        ids[id] = true;
                        if (e && e.relations)
                            Object.keys(e.relations.children).forEach(k => (ids[k] = true));
                        return ids;
                    }
                    else if (this.site.view.selected.length) {
                        return this.site.view.select_ids;
                    }
                    return false;
                },
                features: () => {
                    let s = '';
                    this.features &&
                        Object.keys(this.features).forEach(k => {
                            s += k + this.site.valueOf(this.features[k]);
                        });
                    return s;
                },
                variables: () => {
                    if (this.variables || this.site.view.filters.size) {
                        if (!this.parsed.variable_values.size)
                            this.reparse();
                        let s = '';
                        this.parsed.variable_values.forEach(vi => {
                            vi.filter.summary.update();
                            s += vi.name + vi.operator + vi.component + vi.value + vi.active;
                        });
                        return s;
                    }
                    else
                        return '';
                },
                time_filters: () => {
                    let s = '';
                    this.time_filters &&
                        this.time_filters.forEach(f => {
                            s += f.value in this.site.inputs ? this.site.valueOf(f.value) : f.value;
                        });
                    return s;
                },
            };
            this.checks = {
                dataset: (e) => {
                    return this.parsed.dataset === e.group;
                },
                ids: (e) => {
                    return e.features && this.ids_check(this.parsed.ids, e.features.id);
                },
                features: (e) => {
                    if (e.features) {
                        let k, v, pass = true;
                        for (k in this.parsed.feature_values) {
                            if (k in this.parsed.feature_values) {
                                v = this.parsed.feature_values[k];
                                pass = DataHandler.checks[v.operator](v.value, this.site.valueOf(e.features[k]));
                                if (!pass)
                                    break;
                            }
                        }
                        return pass;
                    }
                    else
                        return true;
                },
                variables: (e) => {
                    if (e.data) {
                        let pass = true;
                        this.parsed.variable_values.forEach(v => {
                            if (v.active && !isNaN(+v.value)) {
                                const ev = e.get_value(v.name, v.comp_fun(v, this.parsed)), ck = !isNaN(ev) && DataHandler.checks[v.operator](ev, v.value);
                                v.filter[ck ? 'passed' : 'failed']++;
                                if (pass && !ck)
                                    pass = false;
                            }
                            else {
                                v.filter.failed++;
                            }
                        });
                        return pass;
                    }
                    else
                        return true;
                },
            };
        }
        ids_check(a, b) {
            return !a || b in a;
        }
        check(e) {
            return {
                ids: !this.ids || this.checks.ids(e),
                features: !this.features || this.checks.features(e),
                variables: (!this.variables && !this.site.view.filters.size) || this.checks.variables(e),
                dataset: !this.dataset || this.checks.dataset(e),
                all: 0,
            };
        }
        reparse() {
            this.parsed.dataset = this.get.dataset();
            this.parsed.ids = this.get.ids();
            this.parsed.time_filters = this.get.time_filters();
            this.parsed.time_agg =
                this.parsed.dataset in this.site.data.meta.times
                    ? this.site.valueOf(this.time_agg) - this.site.data.meta.times[this.parsed.dataset].range[0]
                    : 0;
            if ('string' === typeof this.ids) {
                const u = this.site.inputs[this.ids];
                if (this.ids in this.site.inputs &&
                    (('virtual' === u.type && u.source in this.site.inputs) ||
                        ('depends' in u && u.depends in this.site.inputs))) {
                    this.parsed.id_source = ('virtual' === u.type
                        ? this.site.valueOf(this.site.inputs[u.source].dataset)
                        : this.site.inputs[u.depends].value());
                }
            }
            if (this.palette)
                this.parsed.palette = this.site.valueOf(this.palette);
            if (this.features) {
                this.parsed.feature_values = {};
                Object.keys(this.features).forEach(k => {
                    const value = this.site.valueOf(this.features[k]);
                    this.parsed.feature_values[k] = {
                        value: value,
                        operator: 'string' === typeof value ? 'equals' : 'includes',
                    };
                });
                this.parsed.features = this.get.features();
            }
            else
                this.parsed.features = '';
            this.parsed.variable_values.clear();
            if (this.site.view.filters.size)
                this.site.view.filters.forEach(f => {
                    this.parsed.variable_values.set(f.id, {
                        filter: f,
                        name: f.variable,
                        range: this.site.data.variables[f.variable].info[this.parsed.dataset].time_range,
                        operator: f.operator,
                        value: f.value ? +f.value : NaN,
                        value_type: 'number',
                        component: f.component,
                        active: f.active,
                        comp_fun: component_fun(this.site.data.meta.overall.value, f.component),
                    });
                });
            if (this.variables || this.parsed.variable_values.size) {
                if (this.variables)
                    this.variables.forEach(v => {
                        const value = this.site.valueOf(v.value);
                        this.parsed.variable_values.set(this.parsed.variable_values.size + '', {
                            name: v.variable,
                            operator: v.operator,
                            value: value,
                            component: v.component,
                            active: true,
                            comp_fun: component_fun(this.site.data.meta.overall.value, v.component),
                        });
                    });
                this.parsed.variables = this.get.variables();
            }
            else
                this.parsed.variables = '';
        }
    }

    class InputCombobox extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'combobox';
            this.hover_index = -1;
            this.cleared_selection = '';
            this.expanded = false;
            this.container = document.createElement('div');
            this.current_filter = {};
            this.values = {};
            this.display = {};
            this.options = [];
            this.option_sets = {};
            this.current_set = '';
            this.sensitive = false;
            this.filter = options_filter;
            this.reformat_label = false;
            this.set_current = set_current_options;
            this.set = this.set.bind(this);
            this.reset = this.reset.bind(this);
            this.resize = this.resize.bind(this);
            this.toggle = this.toggle.bind(this);
            this.highlight = this.highlight.bind(this);
            this.filterer = this.filterer.bind(this);
            this.close = this.close.bind(this);
            this.set_selected = this.set_selected.bind(this);
            this.settings.use_display = this.settings.search || this.settings.multi;
            this.listbox = this.e.parentElement.children[1];
            this.options = [...this.listbox.querySelectorAll('.combobox-option')];
            if (this.optionSource && this.site.patterns.ids.test(this.optionSource)) {
                this.loader = loader.bind(this);
                e.addEventListener('click', this.loader);
                this.deferred = true;
            }
            if (this.options.length) {
                this.reformat_label = true;
                this.options.forEach((e, i) => {
                    this.values[e.dataset.value] = i;
                    if (this.reformat_label)
                        this.reformat_label = e.dataset.value === e.innerText;
                });
                const group = this.listbox.querySelectorAll('.combobox-group');
                if (group.length) {
                    this.groups = { e: [], by_name: {} };
                    group.forEach(e => {
                        const name = e.dataset.group;
                        this.groups.e.push(e);
                        this.groups.by_name[name] = e;
                    });
                }
            }
            this.container.className = 'combobox-options-container combobox-component hidden';
            this.site.page.overlay.appendChild(this.container);
            this.container.appendChild(this.listbox);
            this.selection = this.e.firstElementChild.firstElementChild;
            this.input_element = this.e.firstElementChild.lastElementChild;
            if (2 === this.e.childElementCount) {
                this.e.lastElementChild.addEventListener('click', function () {
                    if (!this.e.classList.contains('locked')) {
                        this.cleared_selection = '';
                        this.set([]);
                        this.input_element.focus();
                    }
                }.bind(this));
            }
            this.input_element.addEventListener('focus', function () {
                this.classList.add('focused');
            }.bind(this.e));
            this.input_element.addEventListener('blur', function () {
                this.classList.remove('focused');
            }.bind(this.e));
            this.listbox.addEventListener('click', this.set);
            window.addEventListener('resize', this.resize);
            this.e.addEventListener('mousedown', this.toggle);
            this.listbox.addEventListener('mouseover', this.highlight);
            if (this.settings.accordion) {
                this.listbox.addEventListener('show.bs.collapse', e => {
                    const group = this.hover_index === -1 ? '' : this.options[this.hover_index].dataset.group;
                    const et = e.target;
                    if (group !== et.dataset.group) {
                        et.firstElementChild.firstElementChild.dispatchEvent(new MouseEvent('mouseover'));
                        this.input_element.focus();
                    }
                });
            }
            if (this.settings.search) {
                this.input_element.addEventListener('keyup', this.filterer);
            }
            this.input_element.addEventListener('keydown', function (e) {
                const action = keymap[e.code];
                if (action) {
                    if ('close' === action) {
                        this.close();
                    }
                    else if ('select' === action) {
                        if (!this.expanded)
                            return this.toggle(void 0, this.input_element);
                        this.set(e);
                    }
                    else if ('move' === action) {
                        const value = this.input_element.value;
                        if (this.settings.strict || (this.expanded && '' === value)) {
                            e.preventDefault();
                            if ('ArrowUp' === e.code) {
                                if (this.filter_index && this.filter_index.length) {
                                    this.hover_index = this.filter_index.indexOf(this.hover_index) - 1;
                                    this.hover_index = this.filter_index[0 > this.hover_index ? 0 : this.hover_index];
                                }
                                else {
                                    this.hover_index = Math.max(0, this.hover_index - 1);
                                }
                            }
                            else if ('ArrowDown' === e.code) {
                                if (this.filter_index && this.filter_index.length) {
                                    this.hover_index = this.filter_index.indexOf(this.hover_index) + 1;
                                    this.hover_index =
                                        this.filter_index[this.filter_index.length - 1 < this.hover_index ? this.filter_index.length - 1 : this.hover_index];
                                }
                                else {
                                    this.hover_index = Math.min(this.options.length - 1, this.hover_index + 1);
                                }
                            }
                            else if ('Home' === e.code) {
                                this.hover_index = 0;
                            }
                            else if ('End' === e.code) {
                                this.hover_index = this.options.length - 1;
                            }
                            if (this.expanded) {
                                this.highlight();
                            }
                            else {
                                this.set(this.hover_index);
                            }
                        }
                        else if (this.site.patterns.number.test(value)) {
                            this.set(+value + ('ArrowUp' === e.code ? 1 : -1));
                        }
                    }
                }
                else if (!this.expanded) {
                    this.toggle(void 0, this.input_element);
                }
                else {
                    this.clear_highlight();
                }
            }.bind(this));
        }
        init() {
            this.options.forEach((e, i) => {
                if (this.reformat_label)
                    e.innerText = this.site.data.format_label(e.dataset.value);
                this.display[e.innerText] = i;
            });
        }
        filterer() {
            const q = this.input_element.value.toLowerCase();
            if ('' === q) {
                this.filter_reset();
            }
            else {
                this.filter_index = [];
                if (this.groups) {
                    this.groups.e.forEach(g => g.firstElementChild.firstElementChild.classList.add('hidden'));
                }
                this.options.forEach((o, i) => {
                    if (!o.classList.contains('hidden') && o.innerText.toLowerCase().includes(q)) {
                        o.classList.remove('filter-hidden');
                        this.filter_index.push(i);
                        const group = o.dataset.group;
                        if (group) {
                            this.groups.by_name[group].firstElementChild.firstElementChild.classList.remove('hidden');
                            if (this.settings.accordion) {
                                const g = this.groups.by_name[group];
                                g.firstElementChild.nextElementSibling.classList.add('show');
                                g.firstElementChild.firstElementChild.classList.remove('collapsed');
                                g.firstElementChild.firstElementChild.setAttribute('aria-expanded', 'true');
                            }
                        }
                    }
                    else {
                        o.classList.add('filter-hidden');
                    }
                });
            }
        }
        highlight(e, target) {
            if (e && !target)
                target = e.target;
            if (!target || target.dataset.value in this.values) {
                if (!this.groups)
                    this.settings.accordion = false;
                if (target && target.dataset.value) {
                    this.hover_index = this.values[target.dataset.value];
                }
                else if (-1 === this.hover_index && Array.isArray(this.source)) {
                    this.hover_index = this.values[this.source[0]];
                }
                if ('undefined' === typeof this.hover_index)
                    this.hover_index = -1;
                const o = this.options[this.hover_index];
                if (o) {
                    const previous = this.listbox.querySelector('.highlighted');
                    if (previous)
                        previous.classList.remove('highlighted');
                    if (e && 'mouseover' === e.type) {
                        target.classList.add('highlighted');
                    }
                    else {
                        o.classList.add('highlighted');
                        if (this.settings.accordion) {
                            const c = o.parentElement.parentElement;
                            if (!c.classList.contains('show')) {
                                c.classList.add('show');
                                c.previousElementSibling.firstElementChild.classList.remove('collapsed');
                                c.previousElementSibling.firstElementChild.setAttribute('aria-expanded', 'true');
                            }
                        }
                        this.input_element.setAttribute('aria-activedescendant', o.id);
                        const port = this.container.getBoundingClientRect(), item = o.getBoundingClientRect();
                        let top = port.top;
                        if (this.groups && o.dataset.group)
                            top += this.groups.by_name[o.dataset.group].firstElementChild.getBoundingClientRect().height;
                        if (top > item.top) {
                            this.container.scrollTo(0, this.container.scrollTop + item.top - top);
                        }
                        else if (port.bottom < item.bottom) {
                            this.container.scrollTo(0, this.container.scrollTop + item.bottom - port.bottom);
                        }
                    }
                }
            }
        }
        toggle(e, target) {
            if (e && !target)
                target = e.target;
            if (target && (!e || !e.button) && !this.e.classList.contains('disabled') && 'BUTTON' !== target.tagName) {
                if (this.expanded) {
                    if (target !== this.input_element)
                        this.close();
                }
                else {
                    if (this.site.spec.combobox)
                        Object.keys(this.site.spec.combobox).forEach(id => {
                            if (id !== this.id) {
                                const ou = this.site.inputs[id];
                                ou.expanded && ou.close();
                            }
                        });
                    this.container.classList.remove('hidden');
                    if ('' !== this.selection.innerText)
                        this.cleared_selection = this.selection.innerText;
                    if (this.cleared_selection in this.display)
                        this.highlight(void 0, this.options[this.display[this.cleared_selection]]);
                    if (this.settings.use_display)
                        this.selection.innerText = '';
                    window.addEventListener('click', this.close);
                    this.e.setAttribute('aria-expanded', 'true');
                    if (!e || e.target !== this.input_element)
                        setTimeout(() => this.input_element.focus(), 0);
                    this.resize();
                    this.expanded = true;
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
                : this.site.valueOf(this.default);
        }
        close(e) {
            if (this.expanded &&
                (!e ||
                    !e.target.classList ||
                    !e.target.classList.contains('combobox-component'))) {
                if (this.settings.use_display &&
                    '' === this.selection.innerText &&
                    Array.isArray(this.source) &&
                    this.source.length)
                    this.selection.innerText = this.cleared_selection;
                if ('' !== this.input_element.value)
                    setTimeout(this.set, 0);
                this.e.setAttribute('aria-expanded', 'false');
                this.expanded = false;
                this.container.classList.add('hidden');
                window.removeEventListener('click', this.close);
            }
        }
        resize() {
            const s = this.e.getBoundingClientRect();
            this.container.style.left = s.x + 'px';
            this.container.style.width = s.width + 'px';
            if (window.screen.height / 2 > s.y) {
                this.container.style.top = s.y + s.height + 'px';
                this.container.style.bottom = '';
            }
            else {
                this.container.style.top = '';
                this.container.style.bottom = -s.y + 'px';
            }
        }
        clear_highlight() {
            if (-1 !== this.hover_index) {
                this.options[this.hover_index].classList.remove('highlighted');
                this.hover_index = -1;
            }
        }
        filter_reset() {
            if (this.groups)
                this.groups.e.forEach(g => {
                    (this.settings.accordion ? g.firstElementChild.firstElementChild : g).classList.remove('hidden');
                });
            this.input_element.value = '';
            this.filter_index = [];
            this.options.forEach((o, i) => {
                if (!o.classList.contains('hidden'))
                    this.filter_index.push(i);
            });
            this.listbox.querySelectorAll('.filter-hidden').forEach(o => o.classList.remove('filter-hidden'));
        }
        set_selected(value) {
            if (value in this.values) {
                const option = this.options[this.values[value]];
                option.classList.add('selected');
                option.setAttribute('aria-selected', 'true');
            }
        }
        static create(site, label, options, settings, id) {
            id = id || 'created_combobox_' + ++site.page.elementCount;
            const main = document.createElement('div');
            let e = document.createElement('div'), div = document.createElement('div'), input = document.createElement('input'), lab = document.createElement('label');
            if (settings) {
                if (!site.spec.combobox)
                    site.spec.combobox = {};
                site.spec.combobox[id] = settings;
            }
            e.className = 'wrapper combobox-wrapper';
            if (settings && settings.floating) {
                e.appendChild(div);
                div.className = 'form-floating';
                div.dataset.of = id;
                e = div;
            }
            e.appendChild(main);
            main.id = id;
            main.dataset.autotype = 'combobox';
            main.className = 'auto-input form-select combobox combobox-component';
            main.role = 'combobox';
            main.appendChild((div = document.createElement('div')));
            div.className = 'combobox-selection combobox-component';
            div.appendChild(document.createElement('span'));
            div.lastElementChild.className = 'combobox-component';
            div.lastElementChild.setAttribute('aria-live', 'assertive');
            div.lastElementChild.setAttribute('aria-atomic', 'true');
            div.lastElementChild.role = 'log';
            div.appendChild(input);
            input.setAttribute('aria-haspopup', 'listbox');
            input.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-controls', id + '-listbox');
            input.className = 'combobox-input combobox-component';
            input.type = 'text';
            input.role = 'combobox';
            input.id = id + '-input';
            input.autocomplete = 'off';
            if (settings && settings.clearable) {
                const button = document.createElement('button');
                e.firstElementChild.appendChild(button);
                button.type = 'button';
                button.className = 'btn-close';
                button.title = 'clear selection';
            }
            e.appendChild((div = document.createElement('div')));
            div.className = 'combobox-options combobox-component';
            div.setAttribute('aria-labelledby', id + '-label');
            div.role = 'listbox';
            div.tabIndex = -1;
            div.id = id + '-listbox';
            e.appendChild(lab);
            lab.id = id + '-label';
            lab.innerText = label;
            lab.setAttribute('for', id + '-input');
            const u = new InputCombobox(main, site);
            site.inputs[id] = u;
            let n = 0;
            if (options)
                if (Array.isArray(options)) {
                    options.forEach(o => {
                        const l = site.data.format_label(o);
                        u.display[l] = n;
                        u.values[o] = n++;
                        u.add(o, l);
                    });
                }
                else {
                    u.groups = { e: [], by_name: {} };
                    Object.keys(options).forEach(k => {
                        const g = options[k];
                        const e = document.createElement('div'), id = u.id + '_group_' + k.replace(patterns.seps, '-');
                        e.dataset.group = k;
                        e.className = 'combobox-group combobox-component';
                        e.setAttribute('aria-labelledby', id);
                        e.appendChild((lab = document.createElement('label')));
                        lab.dataset.for = id;
                        lab.innerText = k;
                        lab.id = id;
                        lab.className = 'combobox-group-label combobox-component';
                        u.groups.by_name[k] = e;
                        u.groups.e.push(e);
                        g.forEach(o => e.appendChild(u.add(o, o, true)));
                        u.listbox.appendChild(e);
                    });
                    Object.keys(u.groups.by_name).forEach(g => {
                        u.groups.by_name[g].querySelectorAll('.combobox-option').forEach((c) => {
                            u.options.push(c);
                            c.dataset.group = g;
                            u.values[c.dataset.value] = n;
                            u.display[c.innerText] = n++;
                        });
                    });
                }
            return u;
        }
        get() {
            const s = [];
            this.listbox.querySelectorAll('.selected').forEach((o) => s.push(o.dataset.value));
            this.source = s;
            this.site.request_queue(false, this.id);
        }
        set(v, toggle) {
            if ('number' !== typeof v && !v)
                v = this.input_element.value;
            let update = false, i = -1;
            if (!Array.isArray(v) && 'object' === typeof v) {
                const t = v.target;
                if ((this.settings.accordion ? 'BUTTON' : 'LABEL') === t.tagName)
                    return void 0;
                i = this.hover_index;
                if (-1 !== i &&
                    (this.options[i].classList.contains('hidden') || this.options[i].classList.contains('filter-hidden')))
                    i = -1;
                v =
                    -1 === i
                        ? 'INPUT' === t.tagName
                            ? this.input_element.value
                            : t.dataset.value || t.innerText
                        : this.options[i].dataset.value || this.options[i].innerText;
                toggle = this.settings.multi;
            }
            this.filter_reset();
            if (Array.isArray(v)) {
                if (this.settings.multi) {
                    this.listbox.querySelectorAll('.selected').forEach(e => {
                        e.classList.remove('selected');
                        e.setAttribute('aria-selected', 'false');
                    });
                    this.source = -1 === v[0] ? [] : v;
                    v.forEach(this.set_selected);
                    update = true;
                }
                else
                    v = v[0];
            }
            if (!Array.isArray(this.source))
                this.source = [];
            if (!Array.isArray(v)) {
                if (this.settings.strict && 'string' === typeof v && !(v in this.values) && this.site.patterns.number.test(v))
                    v = +v;
                if ('number' !== this.value_type && 'number' === typeof v && this.options[v]) {
                    v = this.options[v].dataset.value;
                }
                if ('string' === typeof v && v in this.display)
                    v = this.options[this.display[v]].dataset.value;
                if (this.settings.strict && !(v in this.values))
                    v = this.default;
                i = this.source.indexOf(v);
                if (-1 === i) {
                    update = true;
                    if (-1 === v || '' === v) {
                        this.source = [];
                    }
                    else {
                        if (this.settings.multi) {
                            this.source.push(v);
                        }
                        else
                            this.source[0] = v;
                    }
                    if (v in this.values) {
                        if (!this.settings.multi) {
                            const selected = this.listbox.querySelector('.selected');
                            if (selected) {
                                selected.classList.remove('selected');
                                selected.setAttribute('aria-selected', 'false');
                            }
                        }
                        this.set_selected(v);
                    }
                }
                else if (toggle) {
                    update = true;
                    this.source.splice(i, 1);
                    if (v in this.values) {
                        const selection = this.options[this.values[v]];
                        selection.classList.remove('selected');
                        selection.setAttribute('aria-selected', 'false');
                    }
                }
            }
            if (!this.settings.multi && this.expanded) {
                this.input_element.focus();
                this.close();
                this.filter_reset();
            }
            let display = this.source.length
                ? this.settings.multi
                    ? this.source.length + ' of ' + this.options.length + ' selected'
                    : this.source[0] in this.values
                        ? this.options[this.values[this.source[0]]]
                        : this.settings.strict || -1 === this.source[0]
                            ? ''
                            : this.source[0] + ''
                : '';
            if ('string' !== typeof display) {
                display = display.firstChild ? display.firstChild.textContent : display.innerText;
            }
            if (this.settings.use_display) {
                this.selection.innerText = display;
            }
            else {
                this.input_element.value = display;
            }
            if (this.onchange)
                this.onchange();
            if (update)
                this.site.request_queue(false, this.id);
        }
        add(value, display, noadd, meta) {
            const e = document.createElement('div');
            e.id = this.id + '_' + value;
            e.role = 'option';
            e.setAttribute('aria-selected', 'false');
            e.tabIndex = 0;
            e.className = 'combobox-option combobox-component';
            e.dataset.value = value;
            e.innerText = display || this.site.data.format_label(value);
            if (meta && meta.info) {
                e.appendChild(document.createElement('p'));
                e.lastElementChild.className = 'combobox-option-description combobox-component';
                e.lastElementChild.innerText = meta.info.description || meta.info.short_description || '';
            }
            if (!noadd) {
                this.listbox.appendChild(e);
                this.options.push(e);
            }
            return e;
        }
    }

    class TutorialManager {
        constructor(tutorials, elements, resetter) {
            this.container = document.createElement('div');
            this.backdrop = document.createElement('div');
            this.highlight = document.createElement('div');
            this.menu = document.createElement('div');
            this.frame = document.createElement('div');
            this.header = document.createElement('p');
            this.dialog = document.createElement('p');
            this.timer = document.createElement('div');
            this.progress = document.createElement('div');
            this.continue = document.createElement('button');
            this.in_progress = '';
            this.waiting = false;
            this.current_step = 0;
            this.current_time = 0;
            this.tutorials = tutorials;
            this.site_elements = elements || {};
            this.site_reset = resetter || (() => { });
            this.start_tutorial = this.start_tutorial.bind(this);
            this.progress_tutorial = this.progress_tutorial.bind(this);
            this.execute_step = this.execute_step.bind(this);
            this.end_tutorial = this.end_tutorial.bind(this);
            // prepare menu
            document.body.appendChild(this.menu);
            this.menu.id = 'community_tutorials_menu';
            this.menu.className = 'modal fade';
            this.menu.tabIndex = -1;
            let e = document.createElement('div');
            this.menu.appendChild(e);
            e.className = 'modal-dialog modal-dialog-scrollable';
            e.appendChild((e = document.createElement('div')));
            e.className = 'modal-content';
            e.appendChild((e = document.createElement('div')));
            e.className = 'modal-header';
            e.appendChild((e = document.createElement('p')));
            e.className = 'modal-title h5';
            e.innerText = 'Tutorials';
            let close = document.createElement('button');
            e.insertAdjacentElement('afterend', close);
            close.type = 'button';
            close.className = 'btn-close';
            close.setAttribute('data-bs-dismiss', 'modal');
            close.setAttribute('aria-label', 'Close');
            const l = document.createElement('div');
            this.menu.lastElementChild.lastElementChild.appendChild(l);
            l.className = 'modal-body';
            Object.keys(tutorials).forEach(name => {
                const t = tutorials[name], e = document.createElement('div'), description = document.createElement('div'), start = document.createElement('button');
                t.manager = this;
                t.n_steps = t.steps.length;
                let p = document.createElement('div');
                l.appendChild(e);
                e.className = 'tutorial-listing card';
                e.appendChild(p);
                p.className = 'card-header';
                p.innerText = t.title || name;
                e.appendChild((p = document.createElement('div')));
                p.className = 'card-body';
                p.appendChild(description);
                description.appendChild(document.createElement('p'));
                description.firstElementChild.innerText = t.description || '';
                if (t.steps.length && t.steps[0].before && !Array.isArray(t.steps[0].before)) {
                    const before = t.steps[0].before, setting_display = document.createElement('div'), header = document.createElement('span');
                    setting_display.className = 'tutorial-initial-settings';
                    setting_display.appendChild(header);
                    header.innerText = 'Initial Settings';
                    header.className = 'h6';
                    Object.keys(t.steps[0].before).forEach((k, i) => {
                        const row = document.createElement('p');
                        let part = document.createElement('span');
                        part.className = 'syntax-variable';
                        part.innerText = k.replace(patterns.settings, '');
                        row.appendChild(part);
                        part = document.createElement('span');
                        part.className = 'syntax-operator';
                        part.innerText = ' = ';
                        row.appendChild(part);
                        part = document.createElement('span');
                        part.className = 'syntax-value';
                        part.innerText = before[k];
                        row.appendChild(part);
                        setting_display.appendChild(row);
                    });
                    description.appendChild(setting_display);
                }
                p.appendChild(start);
                start.type = 'button';
                start.className = 'btn';
                start.innerText = 'Start';
                start.dataset.name = name;
                start.addEventListener('click', this.start_tutorial);
            });
            // prepare step display
            document.body.appendChild(this.container);
            this.container.appendChild(this.backdrop);
            this.container.className = 'tutorial-container hidden';
            this.container.addEventListener('keyup', this.progress_tutorial);
            this.backdrop.addEventListener('click', this.progress_tutorial);
            this.backdrop.className = 'tutorial-backdrop';
            this.container.appendChild(this.highlight);
            this.highlight.className = 'tutorial-highlight';
            this.highlight.addEventListener('click', this.progress_tutorial);
            this.container.appendChild(this.frame);
            this.frame.className = 'tutorial-frame';
            this.frame.style.left = '50%';
            this.frame.tabIndex = -1;
            this.frame.appendChild((e = document.createElement('div')));
            this.frame.id = 'community_tutorial_frame';
            this.frame.role = 'dialog';
            this.frame.setAttribute('aria-labelledby', 'community_tutorial_description');
            e.className = 'tutorial-step card';
            e.appendChild((e = document.createElement('div')));
            e.className = 'card-header';
            e.appendChild(this.header);
            this.header.className = 'card-title';
            this.header.id = 'community_tutorial_title';
            close = document.createElement('button');
            e.appendChild(close);
            close.type = 'button';
            close.className = 'btn-close';
            close.setAttribute('aria-label', 'Close Tutorial');
            close.addEventListener('click', this.end_tutorial);
            this.frame.firstElementChild.appendChild((e = document.createElement('div')));
            e.className = 'card-body';
            e.appendChild(this.dialog);
            this.dialog.role = 'status';
            this.dialog.id = 'community_tutorial_description';
            this.dialog.setAttribute('aria-labelledby', 'community_tutorial_progress');
            this.dialog.setAttribute('aria-live', 'polite');
            e.lastElementChild.className = 'card-text';
            this.frame.firstElementChild.appendChild((e = document.createElement('div')));
            e.className = 'tutorial-footer card-footer';
            e.appendChild(this.progress);
            this.progress.role = 'progressbar';
            this.progress.id = 'community_tutorial_progress';
            e.appendChild(this.timer);
            this.timer.role = 'timer';
            e.appendChild(this.continue);
            this.continue.addEventListener('click', this.progress_tutorial);
            this.continue.type = 'button';
            this.continue.className = 'btn';
            this.continue.innerText = 'Next';
            this.continue.setAttribute('aria-controls', 'community_tutorial_frame');
        }
        retrieve_element(name) {
            let e;
            if (name in this.site_elements) {
                this.current_site_element = this.site_elements[name];
                e = this.current_site_element.e;
            }
            else if ('nav:' === name.substring(0, 4).toLowerCase()) {
                const text = name.replace(patterns.pre_colon, '');
                document.querySelectorAll('.nav-item button').forEach((item) => {
                    if (text === item.innerText)
                        e = item;
                });
            }
            else {
                try {
                    e = document.querySelector(name.replace(patterns.id_escapes, '\\$1'));
                }
                catch (error) { }
            }
            return e;
        }
        start_tutorial(event, name) {
            this.end_tutorial();
            document.querySelectorAll('[data-bs-dismiss]').forEach((close) => close.click());
            this.in_progress = name ? name : event.target.dataset.name;
            if (!(this.in_progress in this.tutorials)) {
                console.error('tutorial does not exist:', this.in_progress);
                this.in_progress = '';
                return;
            }
            this.container.classList.remove('hidden');
            this.header.innerText = this.tutorials[this.in_progress].title || this.in_progress;
            this.current_step = 0;
            this.current_time = 0;
            this.dialog.innerText = 'Starting tutorial ' + this.header.innerText;
            this.timer.innerText = '';
            this.continue.innerText = 'Next';
            if (this.tutorials[this.in_progress].reset)
                this.site_reset();
            this.progress_tutorial();
        }
        progress_tutorial(event) {
            const isClick = !event || !event.code;
            if (!isClick && 'Escape' === event.code)
                this.end_tutorial();
            if (this.in_progress && !this.waiting && (isClick || 'Enter' === event.code || 'ArrowRight' === event.code)) {
                this.waiting = true;
                clearTimeout(this.focuser);
                clearInterval(this.running_timer);
                const t = this.tutorials[this.in_progress];
                let step;
                const handle_object = (obj) => {
                    Object.keys(obj).forEach(k => {
                        if (patterns.number.test(k)) {
                            do_action(obj[k]);
                        }
                        else {
                            if (k in this.site_elements && this.site_elements[k].set) {
                                this.site_elements[k].set(obj[k]);
                            }
                        }
                    });
                };
                const set_value = (value) => {
                    if (this.current_site_element && this.current_site_element.set) {
                        this.current_site_element.set(value);
                    }
                    else {
                        const input = 'value' in this.current_element ? this.current_element : this.current_element.querySelector('input');
                        if (input) {
                            input.value = value;
                            input.dispatchEvent(new Event('change'));
                            input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
                        }
                    }
                };
                const do_action = (action) => {
                    if ('set' === action) {
                        if ('option' in step)
                            set_value(step.option);
                    }
                    else if ('click' === action) {
                        const u = this.current_site_element;
                        if (u) {
                            if (action === u.id && 'toggle' in u) {
                                if (!u.expanded)
                                    u.toggle(void 0, u.e);
                            }
                            else {
                                u.e.click();
                            }
                        }
                        else {
                            this.current_element && this.current_element.click();
                        }
                    }
                    else if ('close' === action) {
                        document.querySelectorAll('[data-bs-dismiss]').forEach((close) => close.click());
                    }
                    else if ('value' === action.substring(0, 5)) {
                        set_value(action.replace(patterns.pre_colon, '').trimStart());
                    }
                    else {
                        const e = this.retrieve_element(action);
                        if (e)
                            e.click();
                    }
                };
                // handle previous step's after action
                if (this.current_step > 0) {
                    step = t.steps[this.current_step - 1];
                    if ('after' in step) {
                        if (Array.isArray(step.after)) {
                            step.after.forEach(do_action);
                        }
                        else {
                            handle_object(step.after);
                        }
                    }
                }
                if (this.current_step >= t.n_steps) {
                    this.end_tutorial();
                }
                else {
                    this.current_site_element = void 0;
                    // handle current step's before action
                    step = t.steps[this.current_step];
                    this.current_element = this.retrieve_element(step.focus);
                    if ('before' in step) {
                        if (Array.isArray(step.before)) {
                            step.before.forEach(do_action);
                        }
                        else {
                            handle_object(step.before);
                        }
                    }
                    if (this.current_step === t.n_steps - 1)
                        this.continue.innerText = 'Finish';
                    if (this.current_element && this.current_element.scrollIntoView)
                        this.current_element.scrollIntoView();
                    // execute current step after actions have resolved
                    setTimeout(this.execute_step, 'wait' in step ? step.wait : 400);
                }
            }
        }
        execute_step() {
            if (this.in_progress) {
                const t = this.tutorials[this.in_progress];
                const step = t.steps[this.current_step];
                if (!this.current_element) {
                    const e = this.retrieve_element(step.focus);
                    if (!e) {
                        console.error('failed to retrieve element', step.focus);
                        return this.end_tutorial();
                    }
                    this.current_element = e;
                    if (e.scrollIntoView)
                        e.scrollIntoView();
                    setTimeout(this.execute_step, 0);
                    return;
                }
                this.continue.disabled = !!step.disable_continue;
                const b = this.current_element.getBoundingClientRect(), f = this.frame.getBoundingClientRect();
                this.highlight.style.top = b.top + 'px';
                this.highlight.style.left = b.left + 'px';
                this.highlight.style.width = b.width + 'px';
                this.highlight.style.height = b.height + 'px';
                this.frame.style.top = (b.y < screen.availHeight / 2 ? b.y + b.height + 10 : b.y - f.height - 10) + 'px';
                this.frame.style.marginLeft = -f.width / 2 + 'px';
                if (step.time) {
                    this.current_time = step.time;
                    this.timer.innerText = step.time + '';
                    this.running_timer = setInterval(() => {
                        this.current_time--;
                        this.timer.innerText = this.current_time + '';
                        if (this.current_time <= 0) {
                            clearInterval(this.running_timer);
                            this.progress_tutorial();
                        }
                    }, 1e3);
                }
                else {
                    this.timer.innerText = '';
                }
                this.progress.innerText = 'Step ' + (this.current_step + 1) + ' of ' + t.n_steps;
                this.dialog.innerText = step.description;
                this.current_step++;
                this.waiting = false;
                this.focuser = setTimeout(() => this.continue.focus(), 0);
            }
        }
        end_tutorial() {
            this.in_progress = '';
            this.current_step = 0;
            this.container.classList.add('hidden');
            this.waiting = false;
            clearTimeout(this.focuser);
        }
    }

    function make_variable_reference(c) {
        if (!Array.isArray(c.author))
            c.author = [c.author];
        const e = document.createElement('li'), n = c.author.length;
        let s = '', j = 1 === n ? '' : 2 === n ? ' & ' : ', & ', span = document.createElement('span');
        for (let i = n; i--;) {
            const a = c.author[i];
            s =
                (i ? j : '') + ('string' === typeof a ? a : a.family + (a.given ? ', ' + a.given.substring(0, 1) + '.' : '')) + s;
            j = ', ';
        }
        e.innerText = s + ' (' + c.year + '). ' + c.title + '.';
        if (c.journal) {
            e.appendChild(span);
            span.innerText = ' ' + c.journal + (c.volume ? ', ' + c.volume : '');
            span.style.fontStyle = 'italic';
            e.appendChild((span = document.createElement('span')));
            span.innerText = (c.page ? ', ' + c.page : '') + '.';
        }
        if (c.version) {
            e.appendChild((span = document.createElement('span')));
            span.innerText = ' Version ' + c.version + '.';
        }
        if (c.doi || c.url) {
            e.appendChild((span = document.createElement('span')));
            span.innerText = c.doi ? ' doi: ' : ' url: ';
            const a = document.createElement('a');
            e.appendChild(a);
            a.rel = 'noreferrer';
            a.target = '_blank';
            a.href = c.doi ? 'https://doi.org/' + c.doi : c.url;
            a.innerText = c.doi || c.url.replace(patterns.http, '');
        }
        return e;
    }
    class PageMenu {
        constructor(e, page) {
            this.timeout = -1;
            this.e = e;
            this.wrapper = e.parentElement;
            this.page = page;
            this.hide = this.hide.bind(this);
            this.toggle = this.toggle.bind(this);
            const has_toggler = e.lastElementChild.tagName === 'BUTTON';
            if (has_toggler)
                this.toggler = e.lastElementChild;
            if (e.classList.contains('menu-top')) {
                this.side = 'top';
                page.top_menu = this;
                e.style.left = page.content_bounds.left + 'px';
                e.style.right = page.content_bounds.right + 'px';
                if (has_toggler) {
                    this.toggler.addEventListener('click', this.toggle);
                    this.toggler.style.top = page.content_bounds.top + 'px';
                }
            }
            else if (e.classList.contains('menu-right')) {
                this.side = 'right';
                page.right_menu = this;
                e.style.right = page.content_bounds.right + 'px';
                if (has_toggler) {
                    this.toggler.addEventListener('click', this.toggle);
                    this.toggler.style.top = page.content_bounds.top + 'px';
                }
            }
            else if (e.classList.contains('menu-bottom')) {
                this.side = 'bottom';
                page.bottom_menu = this;
                page.content_bounds.bottom = 40;
                page.bottom_menu.e.style.left = page.content_bounds.left + 'px';
                page.bottom_menu.e.style.right = page.content_bounds.right + 'px';
                if (has_toggler) {
                    this.toggler.addEventListener('click', this.toggle);
                }
            }
            else if (e.classList.contains('menu-left')) {
                this.side = 'left';
                page.left_menu = this;
                e.style.left = page.content_bounds.left + 'px';
                if (has_toggler) {
                    this.toggler.addEventListener('click', this.toggle);
                    this.toggler.style.top = page.content_bounds.top + 'px';
                }
            }
        }
        hide() {
            this.timeout = -1;
            this.e.firstElementChild.classList.add('hidden');
            this.page.resize();
        }
        toggle() {
            if (this.timeout !== -1)
                clearTimeout(this.timeout);
            this.timeout = -1;
            if ('closed' === this.e.dataset.state) {
                this.e.dataset.state = 'open';
                this.e.firstElementChild.classList.remove('hidden');
                this.e.style[this.side] = '0px';
                this.page.content.style[this.side] =
                    this.e.getBoundingClientRect()['left' === this.side || 'right' === this.side ? 'width' : 'height'] + 'px';
                if ('top' === this.side || 'bottom' === this.side)
                    this.toggler.style[this.side] = this.page.content_bounds[this.side] + 'px';
                setTimeout(this.page.trigger_resize, 300);
            }
            else {
                this.e.dataset.state = 'closed';
                if ('left' === this.side || 'right' === this.side) {
                    this.e.style[this.side] = -this.e.getBoundingClientRect().width + 'px';
                    this.page.content.style[this.side] = this.page.content_bounds[this.side] + 'px';
                }
                else {
                    const b = this.e.getBoundingClientRect();
                    this.page.content.style[this.side] = this.page.content_bounds[this.side] + ('top' === this.side ? 40 : 0) + 'px';
                    this.e.style[this.side] = -b.height + ('top' === this.side ? this.page.content_bounds.top : 0) + 'px';
                    if ('top' === this.side || 'bottom' === this.side)
                        this.toggler.style[this.side] = b.height + 'px';
                }
                this.timeout = setTimeout(this.hide, 300);
            }
        }
    }
    class Page {
        constructor(site) {
            this.menus = [];
            this.overlay = document.createElement('div');
            this.selection = document.createElement('span');
            this.script_style = document.createElement('style');
            this.modal = {
                info: {
                    init: false,
                    e: document.createElement('div'),
                    header: document.createElement('div'),
                    body: document.createElement('div'),
                    title: document.createElement('div'),
                    description: document.createElement('div'),
                    name: document.createElement('tr'),
                    type: document.createElement('tr'),
                    sources: document.createElement('div'),
                    references: document.createElement('div'),
                    origin: document.createElement('div'),
                    source_file: document.createElement('div'),
                },
                filter: {
                    init: false,
                    e: document.createElement('div'),
                    header: document.createElement('div'),
                    body: document.createElement('div'),
                    conditions: document.createElement('table'),
                    variable_filters: document.createElement('div'),
                    entity_filters: document.createElement('div'),
                    entity_inputs: {},
                    time_range: document.createElement('div'),
                },
            };
            this.tooltip = {
                showing: '',
                e: document.createElement('div'),
            };
            this.content_bounds = {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                outer_right: 0,
            };
            this.elementCount = 0;
            this.site = site;
            this.render_credits = this.render_credits.bind(this);
            this.show_variable_info = this.show_variable_info.bind(this);
            this.tooltip_clear = this.tooltip_clear.bind(this);
            this.site.page = this;
            this.load_screen = document.getElementById('load_screen') || document.createElement('div');
            this.wrap = document.getElementById('site_wrap') || document.createElement('div');
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.querySelectorAll('button').forEach(b => {
                    const panel = document.querySelector(b.getAttribute('data-bs-target'));
                    if (panel && 'false' === panel.getAttribute('data-bs-backdrop')) {
                        panel.addEventListener('show.bs.offcanvas', function () {
                            this.content_bounds.outer_right = panel.getBoundingClientRect().width;
                            this.resize(true);
                            setTimeout(this.trigger_resize, 200);
                        }.bind(this));
                        panel.addEventListener('hide.bs.offcanvas', function () {
                            this.content_bounds.outer_right = 0;
                            this.resize(true);
                            setTimeout(this.trigger_resize, 200);
                        }.bind(this));
                    }
                });
                if ('navcolor' in site.url_options) {
                    if ('' === site.url_options.navcolor)
                        site.url_options.navcolor = window.location.hash;
                    navbar.style.backgroundColor = site.url_options.navcolor.replace('%23', '#');
                }
                if (site.url_options.hide_logo && site.url_options.hide_title && site.url_options.hide_navcontent) {
                    navbar.classList.add('hidden');
                }
                else {
                    const brand = document.querySelector('.navbar-brand');
                    if (brand) {
                        if (site.url_options.hide_logo && 'IMG' === brand.firstElementChild.tagName)
                            brand.firstElementChild.classList.add('hidden');
                        if (site.url_options.hide_title && 'IMG' !== brand.lastElementChild.tagName)
                            brand.lastElementChild.classList.add('hidden');
                    }
                    if (site.url_options.hide_navcontent) {
                        document.querySelector('.navbar-toggler').classList.add('hidden');
                        const nav = document.querySelector('.navbar-nav');
                        if (nav)
                            nav.classList.add('hidden');
                    }
                }
                if (site.url_options.hide_panels && this.panels.length) {
                    this.panels.forEach(p => p.classList.add('hidden'));
                }
            }
            this.navbar = { height: 0 };
            this.content = document.querySelector('.content') || document.createElement('div');
            this.panels = document.querySelectorAll('.panel');
            this.init_panel = this.init_panel.bind(this);
            this.resize = this.resize.bind(this);
            window.addEventListener('resize', this.resize);
            this.tooltip.e.className = 'tooltip hidden';
            this.tooltip.e.appendChild(document.createElement('p'));
            document.head.appendChild(this.script_style);
            document.body.appendChild(this.tooltip.e);
            document.body.addEventListener('mouseover', this.tooltip_clear);
            this.overlay.className = 'content-overlay';
            document.body.appendChild(this.overlay);
            document.body.className =
                this.site.storage.get('theme_dark') || this.site.spec.settings.theme_dark ? 'dark-theme' : 'light-theme';
            this.init_variable_info();
            this.init_filter();
            document.querySelectorAll('[data-autotype=credits]').forEach(this.render_credits);
            if (site.spec.tutorials) {
                this.tutorials = new TutorialManager(site.spec.tutorials, site.inputs, site.global_reset);
                this.overlay.appendChild(this.tutorials.container);
            }
        }
        init() {
            this.panels.length && this.panels.forEach(this.init_panel);
            document.querySelectorAll('.menu-wrapper').forEach((m) => {
                const menu = new PageMenu(m, this);
                this.menus.push(menu);
                if (this.site.url_options.close_menus && 'open' === menu.wrapper.dataset.state)
                    menu.toggler.click();
            });
            if (this.content) {
                this.content.style.top =
                    (this.top_menu ? this.top_menu.e.getBoundingClientRect().height : this.navbar.height) + 'px';
            }
            const navbar = document.querySelector('.navbar');
            if (navbar)
                this.navbar = navbar.getBoundingClientRect();
            this.content_bounds.top = this.navbar.height;
            Object.keys(this.site.data.loaded)
                .reverse()
                .forEach(d => {
                const u = InputCombobox.create(this.site, d, void 0, { search: true, multi: true, clearable: true }, 'filter.' + d), div = document.createElement('div');
                this.modal.filter.entity_inputs[d] = u;
                this.modal.filter.entity_filters.lastElementChild.appendChild(div);
                div.className = 'col-sm';
                div.appendChild(u.e.parentElement);
                u.e.parentElement.classList.add('form-floating');
                u.listbox.classList.add('multi');
                u.dataset = d;
                u.loader = () => {
                    u.site.data.retrieve(u.dataset, u.site.data.info[u.dataset].site_file);
                    u.e.removeEventListener('click', u.loader);
                };
                if (!u.site.data.loaded[d]) {
                    u.e.addEventListener('click', u.loader);
                }
                u.onchange = () => {
                    this.site.view.id_filter();
                    this.site.request_queue('view.id');
                };
                fill_ids_options(u, d, u.option_sets, function () {
                    this.set_current();
                    toggle_input(u, !!this.options.length);
                    Object.keys(this.values).forEach(id => {
                        this.site.view.entities.set(id, this.site.data.entities[id]);
                    });
                    this.site.view.registered[d] = true;
                    this.set(this.id in this.site.url_options ? this.site.url_options[this.id].split(',') : -1);
                }.bind(u));
                toggle_input(u, !!u.options.length);
                this.site.registered_inputs.set(u.id, u);
                this.site.inputs[u.id] = u;
            });
        }
        init_panel(p) {
            const side = p.classList.contains('panel-left') ? 'left' : 'right';
            this.content_bounds[side] = p.getBoundingClientRect().width;
            p.style.marginTop = this.content_bounds.top + 'px';
            p.lastElementChild.addEventListener('click', () => {
                const w = p.getBoundingClientRect().width, bw = p.lastElementChild.getBoundingClientRect().width;
                if ('true' === p.lastElementChild.getAttribute('aria-expanded')) {
                    this.content_bounds[side] = bw;
                    if (this.top_menu)
                        this.top_menu.e.style[side] = bw + 'px';
                    if (this.bottom_menu)
                        this.bottom_menu.e.style[side] = bw + 'px';
                    p.style[side] = -w + bw + 'px';
                    p.lastElementChild.setAttribute('aria-expanded', 'false');
                }
                else {
                    this.content_bounds[side] = w;
                    if (this.top_menu)
                        this.top_menu.e.style[side] = w + 'px';
                    if (this.bottom_menu)
                        this.bottom_menu.e.style[side] = w + 'px';
                    p.style[side] = '0px';
                    p.lastElementChild.setAttribute('aria-expanded', 'true');
                }
                this.resize();
                setTimeout(this.trigger_resize, 200);
            });
        }
        init_variable_info() {
            const e = this.modal.info, button = document.createElement('button'), a = document.createElement('a');
            let th = document.createElement('th'), p = document.createElement('p'), div = document.createElement('div'), ul = document.createElement('ul');
            document.body.appendChild(e.e);
            this.modal.info.init = true;
            e.e.id = 'variable_info_display';
            e.e.className = 'modal fade';
            e.e.setAttribute('tabindex', '-1');
            e.e.setAttribute('aria-labelledby', 'variable_info_title');
            e.e.setAttribute('aria-hidden', 'true');
            e.e.appendChild(div);
            div.className = 'modal-dialog modal-dialog-scrollable';
            div.appendChild((div = document.createElement('div')));
            div.className = 'modal-content';
            div.appendChild(e.header);
            e.header.className = 'modal-header';
            e.header.appendChild(document.createElement('p'));
            e.header.firstElementChild.className = 'h5 modal-title';
            e.header.firstElementChild.id = 'variable_info_title';
            e.header.appendChild(button);
            button.type = 'button';
            button.className = 'btn-close';
            button.setAttribute('data-bs-dismiss', 'modal');
            button.title = 'close';
            e.header.insertAdjacentElement('afterend', e.body);
            e.body.className = 'modal-body';
            e.body.appendChild((e.title = document.createElement('p')));
            e.title.className = 'h4';
            e.body.appendChild((e.description = document.createElement('p')));
            e.body.appendChild(document.createElement('table'));
            e.body.lastElementChild.className = 'info-feature-table';
            e.body.lastElementChild.appendChild((e.name = document.createElement('tr')));
            e.name.appendChild(th);
            th.innerText = 'Name';
            e.name.appendChild(document.createElement('td'));
            e.body.lastElementChild.appendChild((e.type = document.createElement('tr')));
            e.type.appendChild((th = document.createElement('th')));
            th.innerText = 'Type';
            e.type.appendChild(document.createElement('td'));
            e.body.appendChild(e.sources);
            e.sources.appendChild(p);
            p.innerText = 'Sources';
            p.className = 'h3';
            e.sources.appendChild((div = document.createElement('div')));
            div.className = 'sources-cards';
            e.body.appendChild(e.references);
            e.references.appendChild((p = document.createElement('p')));
            p.className = 'h3';
            p.innerText = 'References';
            e.references.appendChild(ul);
            ul.className = 'reference-list';
            e.body.appendChild(e.origin);
            e.origin.appendChild((p = document.createElement('p')));
            p.className = 'h3';
            p.innerText = 'Origin';
            e.origin.appendChild((ul = document.createElement('ul')));
            ul.className = 'origin-list';
            e.body.appendChild(e.source_file);
            e.source_file.className = 'info-source-file';
            e.source_file.appendChild(a);
            a.innerText = 'source';
            a.target = '_blank';
            a.rel = 'noreferrer';
        }
        show_variable_info(e) {
            const v = this.site.dataviews[this.site.defaults.dataview], name = this.site.valueOf((e.target && e.target.dataset.variable) || v.y), info = this.site.data.variable_info[name];
            this.modal.info.header.firstElementChild.innerText = info.short_name;
            this.modal.info.title.innerText = info.long_name;
            set_description(this.modal.info.description, info);
            this.modal.info.name.lastElementChild.innerText = name;
            this.modal.info.type.lastElementChild.innerText =
                info.unit || info.aggregation_method || info.type || '';
            if (info.sources && info.sources.length) {
                this.modal.info.sources.lastElementChild.innerHTML = '';
                this.modal.info.sources.classList.remove('hidden');
                info.sources.forEach(s => {
                    this.modal.info.sources.lastElementChild.appendChild(make_variable_source(s));
                });
            }
            else
                this.modal.info.sources.classList.add('hidden');
            if (info.citations && info.citations.length) {
                this.modal.info.references.lastElementChild.innerHTML = '';
                this.modal.info.references.classList.remove('hidden');
                if ('string' === typeof info.citations)
                    info.citations = [info.citations];
                if ('references' in this.site.data) {
                    delete this.site.data.variable_info._references;
                    delete this.site.data.references;
                }
                if (!('_references' in this.site.data.variable_info)) {
                    const r = {};
                    this.site.data.variable_info._references_parsed = r;
                    Object.keys(this.site.data.info).forEach(d => {
                        const m = this.site.data.info[d];
                        if ('_references' in m) {
                            Object.keys(m._references).forEach(t => {
                                if (!(t in r))
                                    r[t] = {
                                        reference: m._references[t],
                                        element: make_variable_reference(m._references[t]),
                                    };
                            });
                        }
                    });
                }
                const r = this.site.data.variable_info._references_parsed;
                info.citations.forEach(c => {
                    if (c in r)
                        this.modal.info.references.lastElementChild.appendChild(r[c].element);
                });
            }
            else
                this.modal.info.references.classList.add('hidden');
            if ('origin' in info) {
                this.modal.info.origin.classList.remove('hidden');
                const l = this.modal.info.origin.lastElementChild;
                l.innerHTML = '';
                if ('string' === typeof info.origin)
                    info.origin = [info.origin];
                info.origin.forEach(url => {
                    const c = document.createElement('li'), repo = patterns.repo.exec(url)[1];
                    let link = document.createElement('a');
                    link.href = 'https://github.com/' + repo;
                    link.target = '_blank';
                    link.rel = 'noreferrer';
                    link.innerText = repo;
                    c.appendChild(link);
                    c.appendChild(document.createElement('span'));
                    c.lastElementChild.innerText = ' / ';
                    link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noreferrer';
                    link.innerText = url.replace(patterns.basename, '');
                    c.appendChild(link);
                    l.appendChild(c);
                });
            }
            else
                this.modal.info.origin.classList.add('hidden');
            if (info.source_file) {
                this.modal.info.source_file.classList.remove('hidden');
                this.modal.info.source_file.firstElementChild.href = info.source_file;
            }
            else
                this.modal.info.source_file.classList.add('hidden');
        }
        init_filter() {
            // set up filter's time range
            const e = this.modal.filter, button = document.createElement('button');
            let p = document.createElement('p'), div = document.createElement('div'), input = document.createElement('input'), label = document.createElement('label'), span = document.createElement('span'), tr = document.createElement('tr');
            document.body.appendChild(e.e);
            this.modal.filter.init = true;
            e.e.id = 'filter_display';
            e.e.className = 'modal fade';
            e.e.setAttribute('aria-labelledby', 'filter_title');
            e.e.setAttribute('aria-hidden', 'true');
            e.e.appendChild(div);
            div.className = 'modal-dialog';
            div.appendChild((div = document.createElement('div')));
            div.className = 'modal-content';
            div.appendChild(e.header);
            e.header.className = 'modal-header';
            e.header.appendChild(p);
            p.className = 'h5 modal-title';
            p.id = 'filter_title';
            p.innerText = 'Filter';
            e.header.appendChild(button);
            button.type = 'button';
            button.className = 'btn-close';
            button.setAttribute('data-bs-dismiss', 'modal');
            button.title = 'close';
            e.header.insertAdjacentElement('afterend', e.body);
            e.body.className = 'filter-dialog';
            e.body.appendChild((p = document.createElement('p')));
            p.className = 'h6';
            p.innerText = 'Time Range';
            e.body.appendChild(e.time_range);
            e.time_range.className = 'row';
            e.time_range.appendChild((div = document.createElement('div')));
            div.className = 'col';
            div.appendChild((div = document.createElement('div')));
            div.className = 'form-floating text-wrapper wrapper';
            div.appendChild(input);
            input.className = 'form-control auto-input';
            input.setAttribute('data-autoType', 'number');
            input.setAttribute('data-default', 'min');
            input.max = 'filter.time_max';
            input.type = 'number';
            input.id = 'filter.time_min';
            div.appendChild(label);
            label.innerText = 'First Time';
            label.setAttribute('for', 'filter.time_min');
            e.time_range.appendChild((div = document.createElement('div')));
            div.className = 'col';
            div.appendChild((div = document.createElement('div')));
            div.className = 'form-floating text-wrapper wrapper';
            div.appendChild((input = document.createElement('input')));
            input.className = 'form-control auto-input';
            input.setAttribute('data-autoType', 'number');
            input.setAttribute('data-default', 'max');
            input.min = 'filter.time_min';
            input.type = 'number';
            input.id = 'filter.time_max';
            div.appendChild((label = document.createElement('label')));
            label.innerText = 'Last Time';
            label.setAttribute('for', 'filter.time_max');
            // entity filter
            e.body.appendChild(e.entity_filters);
            e.entity_filters.appendChild((p = document.createElement('p')));
            p.className = 'h6';
            p.innerText = 'Select Entities';
            span.className = 'note';
            span.innerText = '(click disabled selectors to load)';
            p.appendChild(span);
            e.entity_filters.appendChild((div = document.createElement('div')));
            div.className = 'row';
            e.entity_inputs = {};
            e.body.appendChild(e.variable_filters);
            e.variable_filters.appendChild((p = document.createElement('p')));
            p.className = 'h6';
            p.innerText = 'Variable Conditions';
            // variable filter dropdown
            e.variable_filters.appendChild((div = document.createElement('div')));
            div.className = 'row';
            div.appendChild((div = document.createElement('div')));
            div.className = 'col';
            div.appendChild((div = document.createElement('div')));
            const filter_select = InputCombobox.create(this.site, 'Add Variable Condition', void 0, { strict: true, search: true, clearable: true, floating: true, accordion: true }, 'filter_variable_dropdown');
            filter_select.input = false;
            filter_select.settings.filter_table = document.querySelector('.filter-body');
            filter_select.onchange = () => {
                const value = filter_select.value();
                if (value in this.site.data.variables) {
                    this.add_filter_condition(value);
                    filter_select.selection.innerText = '';
                    const input = document.querySelectorAll('.filter-body .combobox-input');
                    if (input && input.length)
                        input[input.length - 1].focus();
                }
            };
            filter_select.view = this.site.defaults.dataview;
            filter_select.optionSource = 'variables';
            this.site.add_dependency(this.site.defaults.dataview, { type: 'options', id: filter_select.id });
            div.appendChild(filter_select.e.parentElement);
            // variable filter table
            e.variable_filters.appendChild((div = document.createElement('div')));
            div.className = 'hidden';
            div.appendChild(e.conditions);
            e.conditions.className = 'filter-conditions-table table';
            e.conditions.appendChild(document.createElement('thead'));
            e.conditions.lastElementChild.className = 'filter-header';
            e.conditions.appendChild(document.createElement('tbody'));
            e.conditions.lastElementChild.className = 'filter-body';
            e.conditions.firstElementChild.appendChild(tr);
            ['Variable', 'Result', 'Active', 'Component', 'Operator', 'Value', 'Remove'].forEach(h => {
                const th = document.createElement('th');
                tr.appendChild(th);
                if ('Component' === h || 'Result' === h) {
                    const l = {
                        id: '',
                        note: '',
                        site: this.site,
                        wrapper: document.createElement('label'),
                    };
                    if ('Component' === h) {
                        l.id = 'filter_component_header';
                        l.note =
                            'Component refers to which single value to filter on for each entity; select a dynamic time reference, or enter a time.';
                    }
                    else {
                        l.id = 'filter_result_header';
                        l.note = 'Passing / total entities across loaded datasets.';
                    }
                    th.appendChild(l.wrapper);
                    th.className = 'has-note';
                    l.wrapper.innerText = h;
                    l.wrapper.id = l.id;
                    l.wrapper.setAttribute('data-of', l.id);
                    l.wrapper.setAttribute('aria-description', l.note);
                    th.addEventListener('mouseover', tooltip_trigger.bind(l));
                }
                else {
                    th.innerText = h;
                }
            });
            e.variable_filters.lastElementChild.appendChild((p = document.createElement('p')));
            p.className = 'note';
            p.innerText = 'Summaries are across time within each unfiltered dataset.';
        }
        resize(e) {
            const full = e && 'boolean' === typeof e, f = this[full ? 'wrap' : 'content'];
            if (!full) {
                f.style.top =
                    (this.top_menu && 'open' === this.top_menu.e.dataset.state
                        ? this.top_menu.e.getBoundingClientRect().height
                        : this.content_bounds.top +
                            ((!this.top_menu && !this.left_menu && !this.right_menu) ||
                                (this.right_menu && 'open' === this.right_menu.e.dataset.state) ||
                                (this.left_menu && 'open' === this.left_menu.e.dataset.state)
                                ? 0
                                : 40)) + 'px';
                f.style.bottom =
                    this.content_bounds.bottom +
                        (!this.bottom_menu || 'closed' === this.bottom_menu.e.dataset.state
                            ? 0
                            : this.bottom_menu.e.getBoundingClientRect().height) +
                        'px';
                f.style.left =
                    this.content_bounds.left +
                        (!this.left_menu || 'closed' === this.left_menu.e.dataset.state
                            ? 0
                            : this.left_menu.e.getBoundingClientRect().width) +
                        'px';
            }
            f.style.right =
                this.content_bounds[full ? 'outer_right' : 'right'] +
                    (!this.right_menu || 'closed' === this.right_menu.e.dataset.state
                        ? 0
                        : this.right_menu.e.getBoundingClientRect().width) +
                    'px';
        }
        tooltip_clear(e) {
            const target = e.target;
            if (this.tooltip.showing && ('blur' === e.type || this.tooltip.showing !== (target.dataset.of || target.id))) {
                this.tooltip.showing = '';
                this.tooltip.e.classList.add('hidden');
            }
        }
        add_filter_condition(variable, presets) {
            presets = presets || { operator: '>=', value: 0 };
            let tr = document.createElement('tr'), td = document.createElement('td'), p = document.createElement('p'), label = document.createElement('label'), div = document.createElement('div'), input = document.createElement('input'), select = document.createElement('select'), button = document.createElement('button');
            const f = {
                e: tr,
                variable: variable,
                component: presets.component || 'last',
                operator: presets.operator || '>=',
                value: presets.value || 0,
                active: true,
                id: variable + '_' + Date.now(),
                passed: 0,
                failed: 0,
                info: this.site.data.variables[variable].info,
                view: this.site.dataviews[this.site.defaults.dataview],
            }, d = f.view.get.dataset(), range = f.info[d].time_range, times = this.site.data.meta.overall.value, formatter = this.site.data.format_value.bind(this.site.data);
            this.site.view.filters.set(f.id, f);
            if ('number' === typeof f.component)
                f.component = times[f.component] + '';
            // variable name
            tr.appendChild(td);
            td.appendChild(p);
            p.id = f.id;
            p.className = 'cell-text';
            p.innerText = f.info[d].info.short_name;
            td.appendChild(p);
            td.appendChild((p = document.createElement('p')));
            f.summary = {
                f,
                update: function () {
                    const d = f.view.get.dataset(), range = f.info[d].time_range;
                    if (d !== this.add.Dataset) {
                        this.add.Dataset = d;
                        this.add.First = this.times[range[0]] + '' || 'NA';
                        this.add.Last = this.times[range[1]] + '' || 'NA';
                        const s = this.f.info[d], heads = this.table.firstElementChild.firstElementChild.children, cells = this.table.lastElementChild.firstElementChild.children;
                        for (let i = cells.length; i--;) {
                            const h = heads[i].innerText, n = h.toLowerCase();
                            cells[i].innerText = n in s ? this.format(s[n]) + '' : this.add[h];
                        }
                    }
                },
                add: {
                    Dataset: d,
                    First: times[range[0]] + '' || 'NA',
                    Last: times[range[1]] + '' || 'NA',
                },
                times: this.site.data.meta.overall.value,
                format: formatter,
            };
            f.summary.table = make_summary_table(formatter, p, f.info[d], f.summary.add);
            // filter result
            tr.appendChild((td = document.createElement('td')));
            td.appendChild((p = document.createElement('p')));
            p.setAttribute('aria-describedby', f.id);
            p.className = 'cell-text';
            p.innerText = '0/0';
            // active switch
            tr.appendChild((td = document.createElement('td')));
            td.appendChild(label);
            label.innerText = 'Active';
            label.className = 'filter-label';
            label.id = f.id + '_switch';
            td.appendChild(div);
            div.className = 'form-check form-switch filter-form-input';
            div.appendChild(input);
            input.className = 'form-check-input';
            input.type = 'checkbox';
            input.role = 'switch';
            input.setAttribute('aria-labelledby', f.id + '_switch');
            input.setAttribute('aria-describedby', f.id);
            input.checked = true;
            input.addEventListener('change', () => {
                f.active = !f.active;
                this.site.request_queue('view.filter');
            });
            // component combobox
            tr.appendChild((td = document.createElement('td')));
            td.appendChild((label = document.createElement('label')));
            label.innerText = 'Component';
            label.className = 'filter-label';
            label.id = f.id + '_component';
            const comp_select = InputCombobox.create(this.site, 'component', filter_components.Time);
            comp_select.default = f.component;
            comp_select.set(f.component);
            tr.lastElementChild.appendChild(comp_select.e.parentElement);
            comp_select.e.parentElement.removeChild(comp_select.e.parentElement.lastElementChild);
            comp_select.e.parentElement.classList.add('filter-form-input');
            comp_select.e.setAttribute('aria-labelledby', f.id + '_component');
            comp_select.input_element.setAttribute('aria-labelledby', f.id + '_component');
            comp_select.input_element.setAttribute('aria-describedby', f.id);
            comp_select.listbox.setAttribute('aria-labelledby', f.id + '_component');
            comp_select.onchange = () => {
                f.component = comp_select.value();
                this.site.request_queue('view.filter');
            };
            // operator select
            tr.appendChild((td = document.createElement('td')));
            td.appendChild((label = document.createElement('label')));
            label.innerText = 'Operator';
            label.className = 'filter-label';
            label.id = f.id + '_operator';
            tr.lastElementChild.appendChild(select);
            select.className = 'form-select filter-form-input';
            select.setAttribute('aria-labelledby', f.id + '_operator');
            select.setAttribute('aria-describedby', f.id);
            select.addEventListener('change', e => {
                f.operator = e.target.selectedOptions[0].value;
                this.site.request_queue('view.filter');
            });
            ['>=', '=', '!=', '<='].forEach(k => {
                const option = document.createElement('option');
                select.appendChild(option);
                option.value = option.innerText = k;
                if (k === f.operator)
                    option.selected = true;
            });
            // value input
            tr.appendChild((td = document.createElement('td')));
            td.appendChild((label = document.createElement('label')));
            label.innerText = 'Value';
            label.className = 'filter-label';
            label.id = f.id + '_value';
            const value_select = InputCombobox.create(this.site, 'component', ['min', 'q1', 'median', 'mean', 'q3', 'max']);
            value_select.value_type = 'number';
            value_select.default = f.value;
            value_select.set(f.value);
            td.appendChild(value_select.e.parentElement);
            value_select.e.parentElement.removeChild(value_select.e.parentElement.lastElementChild);
            value_select.e.parentElement.classList.add('filter-form-input');
            value_select.e.setAttribute('aria-labelledby', f.id + '_value');
            value_select.input_element.setAttribute('aria-labelledby', f.id + '_value');
            value_select.input_element.setAttribute('aria-describedby', f.id);
            value_select.listbox.setAttribute('aria-labelledby', f.id + '_value');
            value_select.onchange = function (f) {
                return __awaiter(this, void 0, void 0, function* () {
                    f.value = this.value();
                    if (this.site.patterns.number.test(f.value + '')) {
                        f.value = +f.value;
                        f.value_source = '';
                    }
                    else {
                        f.view.reparse();
                        const v = yield this.site.data.get_variable(f.variable, f.view), s = v && v.views[f.view.id].summaries[f.view.parsed.dataset];
                        if (s && f.value in s) {
                            const a = f.view.parsed.variable_values.get(f.id), k = f.value, time = a.comp_fun(a, f.view.parsed);
                            f.value_source = f.value;
                            f.value = s[k][time];
                        }
                    }
                    this.site.request_queue('view.filter');
                });
            }.bind(value_select, f);
            // remove button
            tr.appendChild((td = document.createElement('td')));
            td.appendChild((label = document.createElement('label')));
            label.innerText = 'Remove';
            label.className = 'filter-label';
            label.id = f.id + '_remove';
            td.appendChild(button);
            button.className = 'btn-close filter-form-input';
            button.type = 'button';
            button.setAttribute('aria-labelledby', f.id + '_remove');
            button.setAttribute('aria-describedby', f.id);
            button.addEventListener('mouseup', function (e) {
                if (!e.button) {
                    this.filter.e.parentElement.removeChild(this.filter.e);
                    this.site.view.filters.delete(this.filter.id);
                    if (!this.site.view.filters.size)
                        this.site.page.modal.filter.variable_filters.lastElementChild.classList.add('hidden');
                    this.site.request_queue('view.filter');
                }
            }.bind({ filter: f, site: this.site }));
            this.site.request_queue('view.filter');
            this.modal.filter.conditions.lastElementChild.appendChild(tr);
            this.modal.filter.variable_filters.lastElementChild.classList.remove('hidden');
        }
        trigger_resize() {
            window.dispatchEvent(new Event('resize'));
        }
        render_credits(e) {
            const s = this.site.spec.credit_output && this.site.spec.credit_output[e.id], exclude = (s && s.exclude) || [], add = (s && s.add) || {}, credits = Object.assign(Object.assign({}, this.site.spec.credits), add);
            e.appendChild(document.createElement('ul'));
            Object.keys(credits).forEach(k => {
                if (-1 === exclude.indexOf(k)) {
                    const c = credits[k], li = document.createElement('li');
                    e.lastElementChild.appendChild(li);
                    if ('url' in c) {
                        const a = document.createElement('a');
                        li.appendChild(a);
                        a.href = c.url;
                        a.target = '_blank';
                        a.rel = 'noreferrer';
                        a.innerText = c.name;
                    }
                    else {
                        li.innerText = c.name;
                    }
                    if ('version' in c) {
                        const span = document.createElement('span');
                        li.appendChild(span);
                        span.className = 'version-tag';
                        span.innerText = c.version;
                    }
                    if ('description' in c) {
                        const p = document.createElement('p');
                        li.parentElement.appendChild(p);
                        p.innerText = c.description;
                    }
                }
            });
        }
    }

    class InputVirtual extends BaseInput {
        constructor(spec, site) {
            const e = document.createElement('input');
            e.id = spec.id;
            super(e, site);
            this.type = 'virtual';
            this.states = [];
            this.values = [];
            this.source = this.default = spec.default;
            if (this.source)
                this.values.push(this.source);
            if (spec.states)
                this.states = spec.states;
            if (spec.display)
                this.display = spec.display;
            const p = {};
            this.states.forEach(si => {
                this.values.push(si.value);
                si.condition.forEach(c => {
                    p[c.id] = { type: 'update', id: this.id };
                    this.site.add_dependency(c.id, p[c.id]);
                });
            });
            this.update();
        }
        init() {
            this.values.forEach(id => {
                if ('string' === typeof id && id in this.site.inputs)
                    this.site.add_dependency(id, { type: 'update', id: this.id });
            });
        }
        update() {
            this.source = void 0;
            for (let p, i = this.states.length; i--;) {
                p = true;
                for (let c = this.states[i].condition.length; c--;) {
                    const r = this.states[i].condition[c];
                    if (DataHandler.checks[r.type](this.site.valueOf(r.id), this.site.valueOf(r.value))) {
                        if (r.any) {
                            p = true;
                            break;
                        }
                    }
                    else
                        p = false;
                }
                if (p) {
                    this.source = this.states[i].value;
                    break;
                }
            }
            if (!this.source)
                this.source = this.default;
            if (this.source !== this.previous) {
                this.previous = this.source;
                this.site.request_queue(this.id);
            }
            else if (this.source in this.site.inputs) {
                const r = this.site.inputs[this.source].value();
                if (r !== this.previous) {
                    this.previous = r;
                    this.site.request_queue(this.id);
                }
            }
        }
        value() {
            return this.site.valueOf(this.source);
        }
        set(v) {
            if (-1 !== this.values.indexOf(v)) {
                this.previous = this.source;
                this.source = v;
            }
            else if (this.source in this.site.inputs) {
                const c = this.site.inputs[this.source];
                if ('values' in c &&
                    (Array.isArray(c.values) ? -1 !== c.values.indexOf(v) : v in c.values || ('display' in c && v in c.display))) {
                    c.set(v);
                }
            }
            this.site.request_queue(this.id);
        }
    }

    class InputButton extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'button';
            this.update = this.update.bind(this);
            this.target = this.e.dataset.target;
            if ('copy' === this.target)
                this.settings.endpoint = site.spec.endpoint;
            if ('filter' === this.target) {
                e.setAttribute('data-bs-toggle', 'modal');
                e.setAttribute('data-bs-target', '#filter_display');
                this.notification = document.createElement('span');
                this.notification.className = 'filter-notification hidden';
                e.parentElement.appendChild(this.notification);
                site.add_dependency('view.filter', { type: 'update', id: this.id });
                site.add_dependency('view.id', { type: 'update', id: this.id });
                if (site.data)
                    this.update();
            }
            else
                e.addEventListener('click', this.settings.effects
                    ? 'export' === this.target || 'copy' === this.target
                        ? () => {
                            const f = {}, s = this.settings, v = site.dataviews[s.dataview], d = v && v.parsed.dataset;
                            Object.keys(s.query).forEach(k => (f[k] = site.valueOf(s.query[k])));
                            if (v) {
                                if (!('include' in f) && v.y)
                                    f.include = site.valueOf(v.y);
                                if (!('id' in f) && v.ids)
                                    f.id = site.valueOf(v.ids);
                            }
                            if ('copy' === this.target || this.api) {
                                let q = [];
                                if ('id' in f && '' !== f.id && -1 != f.id) {
                                    q.push('id=' + f.id);
                                }
                                else {
                                    if (site.view.selected.length)
                                        q.push('id=' + site.view.selected.join(','));
                                }
                                if (v) {
                                    if (!f.time_range && v.time_range.filtered_index + '' !== v.time_range.index + '') {
                                        q.push('time_range=' +
                                            site.data.meta.times[d].value[v.time_range.filtered_index[0]] +
                                            ',' +
                                            site.data.meta.times[d].value[v.time_range.filtered_index[1]]);
                                    }
                                    if (!v.features)
                                        v.features = {};
                                    Object.keys(v.features).forEach(k => {
                                        if (!(k in f)) {
                                            let fv = site.valueOf(v.features[k]);
                                            if (Array.isArray(fv))
                                                fv = fv.join(',');
                                            f[k] = fv;
                                            q.push(k + '=' + fv);
                                        }
                                    });
                                    if (site.view.filters.size)
                                        site.view.filter_state(q, v.parsed.time_agg);
                                }
                                Object.keys(f).forEach(k => {
                                    if (!patterns.exclude_query.test(k) && !(k in v.features))
                                        q.push(k + '=' + f[k]);
                                });
                                const k = s.endpoint + (q.length ? '?' + q.join('&') : '');
                                if (this.api) {
                                    window.location.href = k;
                                }
                                else {
                                    navigator.clipboard.writeText(k).then(() => {
                                        if ('Copied!' !== e.innerText) {
                                            this.text = e.innerText;
                                            e.innerText = 'Copied!';
                                            setTimeout(() => {
                                                e.innerText = this.text;
                                            }, 500);
                                            site.gtag('event', 'export', { event_category: 'api link' });
                                        }
                                    }, e => {
                                        if (e !== this.e.innerText) {
                                            this.text = this.e.innerText;
                                            this.e.innerText = e;
                                            setTimeout(() => {
                                                this.e.innerText = this.text;
                                            }, 1500);
                                        }
                                    });
                                }
                            }
                            else {
                                if (v && 'selection' in v) {
                                    if (!f.time_range)
                                        f.time_range =
                                            site.data.meta.times[d].value[v.time_range.filtered_index[0]] +
                                                ',' +
                                                site.data.meta.times[d].value[v.time_range.filtered_index[1]];
                                    site.data.export(f, v.selection.all, true);
                                }
                                else
                                    site.data.export(f, site.data.entities, true, true);
                                site.gtag('event', 'export', { event_category: 'download' });
                            }
                        }
                        : () => {
                            Object.keys(this.settings.effects).forEach(k => {
                                this.settings.effects[k] === '' || -1 == this.settings.effects[k]
                                    ? site.inputs[k].reset()
                                    : site.inputs[k].set(this.settings.effects[k]);
                            });
                        }
                    : 'refresh' === this.target
                        ? site.global_update
                        : 'reset_selection' === this.target
                            ? site.global_reset
                            : 'reset_storage' === this.target
                                ? site.clear_storage
                                : () => {
                                    if (this.target in site.inputs)
                                        site.inputs[this.target].reset();
                                });
        }
        update() {
            let n = +(0 !== this.site.view.selected.length);
            this.site.view.filters.forEach(f => (n += +f.active));
            if (n) {
                this.notification.innerText = n + '';
                this.notification.classList.remove('hidden');
            }
            else {
                this.notification.classList.add('hidden');
            }
        }
    }

    class InputRadio extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'radio';
            this.values = [];
            this.listen = this.listen.bind(this);
            this.options = e.querySelectorAll('input');
            this.options.forEach(o => {
                this.values.push(o.value);
                o.addEventListener('click', this.listen);
            });
            if ('number' === typeof this.default && this.options[this.default])
                this.default = this.values[this.default];
        }
        get() {
            for (let i = this.options.length; i--;) {
                if (this.options[i].checked) {
                    this.set(i);
                    break;
                }
            }
        }
        set(v) {
            this.current_index = 'string' === typeof v ? this.values.indexOf(v) : v;
            if (-1 !== this.current_index) {
                this.source =
                    this.values[this.current_index] in this.site.inputs
                        ? this.site.valueOf(this.values[this.current_index])
                        : this.values[this.current_index];
                this.options[this.current_index].checked = true;
            }
            else
                this.source = undefined;
            this.site.request_queue(this.id);
        }
        listen(e) {
            this.set(e.target.value);
        }
        add(value, display, noadd) {
            const e = document.createElement('div'), s = 'TRUE' === this.e.dataset.switch, input = document.createElement('input'), label = document.createElement('label');
            e.className = 'form-check' + (s ? ' form-switch' : '');
            e.appendChild(input);
            e.appendChild(label);
            input.autocomplete = 'off';
            input.className = 'form-check-input';
            if (s)
                input.role = 'switch';
            input.type = 'radio';
            input.name = this.e.id + '_options';
            input.id = this.e.id + '_option' + this.e.childElementCount;
            input.value = value;
            label.innerText = display || this.site.data.format_label(value);
            label.className = 'form-check-label';
            label.setAttribute('for', e.firstElementChild.id);
            if (!noadd)
                this.e.appendChild(e);
            return input;
        }
    }

    class InputCheckbox extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'checkbox';
            this.values = [];
            this.listen = this.listen.bind(this);
            this.options = e.querySelectorAll('input');
            this.options.forEach(o => {
                this.values.push(o.value);
                o.addEventListener('click', this.listen);
            });
            if ('string' === typeof this.default)
                this.default = this.default.split(',');
            this.get();
        }
        get() {
            this.source = [];
            this.current_index = [];
            this.off_default = false;
            this.options.forEach((o, i) => {
                if (o.checked) {
                    this.source.push(this.values[i]);
                    this.current_index.push(i);
                }
                else {
                    this.off_default = true;
                }
            });
            this.site.request_queue(this.id);
        }
        set(v) {
            if (Array.isArray(v)) {
                this.source = [];
                this.current_index = [];
                this.off_default = false;
                this.values.forEach((cv, i) => {
                    if (-1 !== v.indexOf(cv)) {
                        this.source.push(cv);
                        this.current_index.push(i);
                        this.options[i].checked = true;
                    }
                    else {
                        this.off_default = true;
                        this.options[i].checked = false;
                    }
                });
            }
            else {
                if ('string' === typeof v) {
                    this.set('' === v ? this.values : v.split(','));
                    return;
                }
                else {
                    if (-1 !== v) {
                        this.options[v].checked = true;
                        this.off_default = false;
                        this.options.forEach(o => {
                            if (!o.checked)
                                this.off_default = true;
                        });
                    }
                }
            }
            this.site.request_queue(this.id);
        }
        listen(e) {
            const input = e.target;
            if (input.checked) {
                this.source.push(input.value);
                this.current_index.push(this.values.indexOf(input.value));
                this.off_default = false;
                this.options.forEach(o => {
                    if (!o.checked)
                        this.off_default = true;
                });
            }
            else {
                let i = this.source.indexOf(input.value);
                if (i !== -1) {
                    this.off_default = true;
                    this.source.splice(i, 1);
                    this.current_index.splice(i, 1);
                }
            }
            this.site.request_queue(this.id);
        }
        add(value, display, noadd) {
            const e = document.createElement('div'), s = 'TRUE' === this.e.dataset.switch, input = document.createElement('input'), label = document.createElement('label');
            e.className = 'form-check' + (s ? ' form-switch' : '');
            e.appendChild(input);
            e.appendChild(label);
            input.autocomplete = 'off';
            input.className = 'form-check-input';
            if (s)
                input.role = 'switch';
            input.type = 'checkbox';
            input.name = this.e.id + '_options';
            input.id = this.e.id + '_option' + this.e.childElementCount;
            input.value = value;
            label.innerText = display || this.site.data.format_label(value);
            label.className = 'form-check-label';
            label.setAttribute('for', e.firstElementChild.id);
            if (!noadd)
                this.e.appendChild(e);
            return input;
        }
    }

    const value_types = {
        percent: function (v) {
            return v + '%';
        },
        minute: function (v) {
            return v + ' minutes';
        },
        minutes: function (v) {
            return v + ' minutes';
        },
        dollars: function (v) {
            return '$' + v;
        },
        'Mb/s': function (v) {
            return v + ' Mbps';
        },
    };

    class BaseOutput {
        constructor(e, site) {
            this.input = false;
            this.spec = {};
            this.deferred = false;
            this.e = e;
            this.tab = 'tabpanel' === e.parentElement.getAttribute('role') ? e.parentElement : void 0;
            this.site = site;
            this.view = e.dataset.view || site.defaults.dataview;
            this.id = e.id || 'ui' + site.page.elementCount++;
            this.note = e.getAttribute('aria-description') || '';
            this.type = e.dataset.autotype;
            if (this.type in site.spec) {
                const spec = site.spec[this.type];
                if (this.id in spec)
                    this.spec = spec[this.id];
            }
        }
    }

    class InfoPart {
        constructor(parent, text) {
            this.parsed = {};
            this.ref = true;
            this.selection = false;
            this.parent = parent;
            this.text = text;
            if ('value' === text) {
                this.parsed.data = parent.spec.variable;
            }
            else if ('summary' === text) {
                parent.spec.show_summary = true;
            }
            else if ('filter' === text) {
                const e = document.createElement('table');
                e.className = 'info-filter';
                this.parsed.filter = e;
            }
            const patterns = parent.site.patterns;
            if (patterns.features.test(text)) {
                this.parsed.features = text.replace(patterns.features, '');
            }
            else if (parent.site.patterns.data.test(text)) {
                this.parsed.data = text.replace(patterns.data, '');
            }
            else if (patterns.variables.test(text)) {
                this.parsed.variables = text.replace(patterns.variables, '');
            }
            else
                this.ref = false;
        }
        get(entity, caller) {
            if (this.ref && this.parent.site.data) {
                if (entity)
                    if ('features' in this.parsed) {
                        return entity.features[this.parsed.features];
                    }
                    else if ('data' in this.parsed) {
                        if ('value' === this.text) {
                            this.parsed.data = this.parent.site.valueOf(this.parent.spec.variable ||
                                (caller && (caller.color || caller.y)) ||
                                this.parent.site.dataviews[this.parent.view].y);
                        }
                        else if (this.text in this.parent.site.inputs)
                            this.parsed.data = this.parent.site.valueOf(this.text);
                        if (!(this.parsed.data in this.parent.site.data.variables))
                            return this.parsed.data;
                        const info = this.parent.site.data.variables[this.parsed.data], v = this.parent.site.data.format_value(entity.get_value(this.parsed.data, this.parent.time), info && info.info[entity.group] && 'integer' === info.info[entity.group].type);
                        let type = info.meta.unit || info.meta.type;
                        if (info.meta.aggregation_method && !(type in value_types))
                            type = info.meta.aggregation_method;
                        return (!isNaN(v) && type in value_types ? value_types[type](v) : v) + '';
                    }
                const info = this.parent.site.data.variable_info;
                if ('data' in this.parsed) {
                    return this.parent.site.data.meta.times[this.parent.dataset].value[this.parent.time_agg] + '';
                }
                else if ('variables' in this.parsed && (this.value_source || this.parent.v in info)) {
                    const v = this.parent.site.valueOf(this.value_source || this.parent.v), i = info[v];
                    return (this.parsed.variables in i ? i[this.parsed.variables] : this.text);
                }
                return this.text;
            }
            else
                return this.text;
        }
    }
    class OutputInfo extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'info';
            this.showing = false;
            this.has_default = false;
            this.selection = false;
            this.processed = false;
            this.depends = {};
            this.parts = {};
            this.update = this.update.bind(this);
            this.has_default = this.spec.default && (!!this.spec.default.title || !!this.spec.default.body);
            this.site.subs.add(this.view, this);
            if (this.spec.floating) {
                document.body.appendChild(this.e);
                this.e.classList.add('hidden');
                document.addEventListener('mousemove', function (e) {
                    if (this.showing) {
                        const f = this.site.page.content.getBoundingClientRect();
                        this.e.style.top = (e.y > f.height / 2 ? e.y - this.e.getBoundingClientRect().height - 10 : e.y + 10) + 'px';
                        this.e.style.left = (e.x > f.width / 2 ? e.x - this.e.getBoundingClientRect().width - 10 : e.x + 10) + 'px';
                    }
                }.bind(this));
            }
            if (this.spec.title) {
                this.parts.title = new InfoPart(this, this.spec.title);
                if (this.spec.variable_info &&
                    'variables' in this.parts.title.parsed &&
                    this.site.patterns.measure_name.test(this.parts.title.parsed.variables)) {
                    this.parts.title.base = document.createElement('button');
                    this.parts.title.base.type = 'button';
                    this.parts.title.base.setAttribute('data-bs-toggle', 'modal');
                    this.parts.title.base.setAttribute('data-bs-target', '#variable_info_display');
                    this.parts.title.base.addEventListener('click', this.site.page.show_variable_info);
                }
                else
                    this.parts.title.base = document.createElement('p');
                this.parts.title.base.appendChild(document.createElement('span'));
                this.parts.title.temp = document.createElement('p');
                this.parts.title.default = document.createElement('p');
                this.parts.title.temp.className =
                    this.parts.title.base.className =
                        this.parts.title.default.className =
                            'info-title hidden';
                if (this.has_default && this.spec.default.title) {
                    this.e.appendChild(this.parts.title.default);
                    this.parts.title.default.innerText = this.spec.default.title;
                }
                if (!this.parts.title.ref)
                    this.parts.title.base.firstElementChild.innerText = this.parts.title.get();
                this.e.appendChild(this.parts.title.base);
                this.e.appendChild(this.parts.title.temp);
                this.parts.title.base.classList.add('hidden');
                this.parts.title.temp.classList.add('hidden');
            }
            if (this.spec.body || (this.has_default && this.spec.default.body)) {
                this.parts.body = {
                    base: document.createElement('div'),
                    temp: document.createElement('div'),
                    default: document.createElement('div'),
                    rows: [],
                };
                this.parts.body.temp.className =
                    this.parts.body.base.className =
                        this.parts.body.default.className =
                            'info-body hidden';
                if (this.has_default && this.spec.default.body)
                    this.parts.body.default.innerText = this.spec.default.body;
                let h = 0;
                this.spec.body &&
                    this.spec.body.forEach((op, i) => {
                        const p = {
                            name: new InfoPart(this, op.name),
                            value: new InfoPart(this, op.value),
                            base: document.createElement('div'),
                            temp: document.createElement('div'),
                        }, base = document.createElement('div'), temp = document.createElement('div');
                        this.parts.body.rows[i] = p;
                        this.parts.body.base.appendChild(p.base);
                        this.parts.body.temp.appendChild(p.temp);
                        p.temp.className = p.base.className = 'info-body-row-' + op.style;
                        h += 24 + ('stack' === op.style ? 24 : 0);
                        if (p.name) {
                            if (this.spec.variable_info &&
                                'variables' in p.name.parsed &&
                                this.site.patterns.measure_name.test(p.name.parsed.variables)) {
                                p.base.appendChild(document.createElement('button'));
                                p.base.lastElementChild.role = 'button';
                                p.base.lastElementChild.setAttribute('data-bs-toggle', 'modal');
                                p.base.lastElementChild.setAttribute('data-bs-target', '#variable_info_display');
                                p.base.lastElementChild.addEventListener('click', this.site.page.show_variable_info);
                            }
                            else
                                p.base.appendChild(base);
                            p.temp.appendChild(temp);
                            base.className = temp.className = 'info-body-row-name';
                            base.innerText = temp.innerText = p.name.get();
                        }
                        if (p.value) {
                            p.base.appendChild(document.createElement('div'));
                            p.temp.appendChild(document.createElement('div'));
                        }
                    });
                this.e.style.minHeight = h + 'px';
                this.e.appendChild(this.parts.body.base);
                this.e.appendChild(this.parts.body.default);
                this.e.appendChild(this.parts.body.temp);
            }
        }
        init() {
            if (this.spec.title && 'summary' === this.spec.title) {
                this.parts.title.parsed.summary = make_summary_table(this.site.data.format_value, this.e);
            }
            if (this.parts.body && this.parts.body.rows)
                this.parts.body.rows.forEach(r => {
                    if (r.name && 'summary' === r.name.text)
                        r.name.parsed.summary = make_summary_table(this.site.data.format_value, this.e);
                    if (r.value) {
                        if ('summary' === r.value.text) {
                            r.value.parsed.summary = make_summary_table(this.site.data.format_value, this.e);
                            r.base.lastElementChild.appendChild(r.value.parsed.summary);
                        }
                        else if ('filter' in r.value.parsed) {
                            r.base.lastElementChild.appendChild(r.value.parsed.filter);
                        }
                        else {
                            const base = r.base.lastElementChild, temp = r.temp.lastElementChild;
                            temp.className = base.className =
                                'info-body-row-value' + ('statement' === r.value.parsed.variables ? ' statement' : '');
                            if (r.name.ref && 'value' === r.value.text)
                                r.value.ref = true;
                            if (!r.value.ref)
                                temp.innerText = base.innerText = r.value.get();
                        }
                    }
                });
            this.update();
        }
        show(e, u) {
            this.update(e, u);
            this.showing = true;
            if (this.spec.floating)
                this.e.classList.remove('hidden');
            if (this.parts.title) {
                if (this.selection) {
                    this.parts.title.base.classList.add('hidden');
                }
                else
                    this.parts.title.default.classList.add('hidden');
                this.parts.title.temp.classList.remove('hidden');
            }
            if (this.parts.body) {
                if (this.selection) {
                    this.parts.body.base.classList.add('hidden');
                }
                else
                    this.parts.body.default.classList.add('hidden');
                this.parts.body.temp.classList.remove('hidden');
            }
        }
        revert() {
            this.showing = false;
            if (this.spec.floating) {
                this.e.classList.add('hidden');
            }
            else {
                if (this.parts.title) {
                    if (this.selection) {
                        this.parts.title.base.classList.remove('hidden');
                    }
                    else if (this.has_default)
                        this.parts.title.default.classList.remove('hidden');
                    this.parts.title.temp.classList.add('hidden');
                }
                if (this.parts.body) {
                    if (this.selection) {
                        this.parts.body.base.classList.remove('hidden');
                    }
                    else if (this.has_default)
                        this.parts.body.default.classList.remove('hidden');
                    this.parts.body.temp.classList.add('hidden');
                }
            }
        }
        update(entity, caller, pass) {
            return __awaiter(this, void 0, void 0, function* () {
                const v = this.site.dataviews[this.view];
                if (!v)
                    return;
                const y = this.site.inputs[v.time_agg];
                this.v = this.site.valueOf(this.spec.variable || (caller && (caller.color || caller.y)) || v.y);
                this.dataset = v.get.dataset();
                if (y && !(this.dataset in this.site.data.meta.times)) {
                    if (!(this.id in this.site.data.data_queue[this.dataset]))
                        this.site.data.data_queue[this.dataset][this.id] = this.update;
                    return;
                }
                this.time_agg = y ? y.value() - this.site.data.meta.times[this.dataset].range[0] : 0;
                const time_range = this.v in this.site.data.variables && this.site.data.variables[this.v].time_range[this.dataset];
                this.time = time_range ? this.time_agg - time_range[0] : 0;
                if (this.spec.show_summary) {
                    this.var = this.v && (yield this.site.data.get_variable(this.v, this.site.dataviews[this.view]));
                    this.summary = this.view in this.var.views && this.var.views[this.view].summaries[this.dataset];
                }
                if (!this.processed) {
                    this.processed = true;
                    if (!this.spec.floating) {
                        this.site.add_dependency(this.view, { type: 'update', id: this.id });
                        if (v.y in this.site.inputs)
                            this.site.add_dependency(v.y, { type: 'update', id: this.id });
                        if (y)
                            this.site.add_dependency(v.time_agg, { type: 'update', id: this.id });
                        if (this.spec.variable in this.site.inputs)
                            this.site.add_dependency(this.spec.variable, { type: 'update', id: this.id });
                    }
                    if (this.parts.body)
                        this.parts.body.rows.forEach(p => {
                            if (!p.value.ref && p.value.text in this.site.inputs && 'variables' in p.name.parsed) {
                                p.name.value_source = p.value.value_source = p.value.text;
                                p.value.ref = true;
                                p.value.parsed.data = '';
                            }
                        });
                }
                if (entity) {
                    // hover information
                    if (this.parts.title) {
                        this.parts.title.temp.innerText = this.parts.title.get(entity, caller);
                    }
                    if (this.parts.body) {
                        this.parts.body.rows.forEach(p => {
                            if (p.name.ref) {
                                if (p.name.value_source)
                                    p.name.value_source = p.value.text;
                                const e = p.name.get(entity, caller);
                                if ('object' !== typeof e) {
                                    p.temp.firstElementChild.innerText = this.parse_variables(e, p.value.parsed.variables, entity);
                                }
                            }
                            if (p.value.ref) {
                                if (p.value.value_source)
                                    p.value.value_source = p.value.text;
                                const e = p.value.get(entity, caller);
                                if ('object' !== typeof e) {
                                    p.temp.lastElementChild.innerText = this.parse_variables(e, p.value.parsed.variables, entity);
                                }
                            }
                        });
                    }
                }
                else if (!this.spec.floating) {
                    if (this.queue > 0)
                        clearTimeout(this.queue);
                    this.queue = -1;
                    if (!pass) {
                        if (!this.tab || this.tab.classList.contains('show'))
                            this.queue = setTimeout(() => this.update(void 0, void 0, true), 50);
                    }
                    else {
                        // base information
                        entity = this.site.data.entities[v.get.single_id()];
                        if (entity) {
                            // when showing a selected region
                            this.selection = true;
                            if (this.parts.title) {
                                this.parts.title.base.classList.remove('hidden');
                                this.parts.title.default.classList.add('hidden');
                            }
                            if (this.parts.body && this.has_default)
                                this.parts.body.default.classList.add('hidden');
                        }
                        else {
                            // when no ID is selected
                            this.selection = false;
                            if (this.parts.title) {
                                if (this.has_default) {
                                    this.parts.title.base.classList.add('hidden');
                                    this.parts.title.default.classList.remove('hidden');
                                }
                                else if (!this.parts.title.ref || !('features' in this.parts.title.parsed))
                                    this.parts.title.base.classList.remove('hidden');
                            }
                            if (this.parts.body) {
                                this.parts.body.base.classList.add('hidden');
                                if (this.has_default)
                                    this.parts.body.default.classList.remove('hidden');
                            }
                        }
                        if (this.parts.title) {
                            this.parts.title.base.firstElementChild.innerText = this.parts.title.get(entity, caller);
                        }
                        if (this.parts.body) {
                            if (!this.spec.subto)
                                this.parts.body.base.classList.remove('hidden');
                            this.parts.body.rows.forEach(p => {
                                if ('summary' in p.value.parsed) {
                                    this.fill_summary_table(p.value.parsed.summary, this.summary, this.time);
                                }
                                else if ('filter' in p.value.parsed) {
                                    const e = p.value.parsed.filter;
                                    let n = 0;
                                    e.innerHTML = '';
                                    if (this.site.view.selected.length) {
                                        n++;
                                        const s = document.createElement('tr');
                                        s.className = 'filter-display';
                                        let ss = document.createElement('td'), span = document.createElement('span');
                                        s.appendChild(ss);
                                        ss.appendChild(span);
                                        span.className = 'syntax-variable';
                                        span.innerText = 'Select Entities';
                                        s.appendChild((ss = document.createElement('td')));
                                        ss.appendChild((span = document.createElement('span')));
                                        span.className = 'syntax-operator';
                                        span.innerText = ':';
                                        s.appendChild((ss = document.createElement('td')));
                                        ss.setAttribute('colspan', '2');
                                        ss.appendChild((span = document.createElement('span')));
                                        span.className = 'syntax-value';
                                        let ids = '';
                                        this.site.view.selected.forEach(id => {
                                            const entity = this.site.data.entities[id];
                                            ids += (ids ? ', ' : '') + (entity && entity.features ? entity.features.name : id);
                                        });
                                        span.innerText = ids;
                                        e.appendChild(s);
                                    }
                                    this.site.view.filters.forEach(f => {
                                        const checked = f.passed + f.failed;
                                        if (f.active && checked) {
                                            const result = f.passed + '/' + checked;
                                            f.e.children[1].lastElementChild.innerText = result;
                                            n++;
                                            const s = document.createElement('tr'), info = this.site.data.variable_info[f.variable];
                                            s.className = 'filter-display';
                                            let ss = document.createElement('td'), span = document.createElement('span');
                                            s.appendChild(ss);
                                            ss.appendChild(span);
                                            span.className = 'syntax-variable';
                                            span.title = f.variable;
                                            span.innerText = info.short_name;
                                            ss.appendChild((span = document.createElement('span')));
                                            span.innerText = ' (';
                                            ss.appendChild((span = document.createElement('span')));
                                            span.className = 'syntax-component';
                                            span.innerText = f.component;
                                            ss.appendChild((span = document.createElement('span')));
                                            span.innerText = ')';
                                            ss = document.createElement('td');
                                            s.appendChild(ss);
                                            ss.appendChild((span = document.createElement('span')));
                                            span.className = 'syntax-operator';
                                            span.innerText = f.operator;
                                            ss = document.createElement('td');
                                            s.appendChild(ss);
                                            ss.appendChild((span = document.createElement('span')));
                                            span.className = 'syntax-value';
                                            span.innerText = ('number' === typeof f.value ? this.site.data.format_value(f.value) : f.value);
                                            ss = document.createElement('td');
                                            s.appendChild(ss);
                                            ss.appendChild((span = document.createElement('span')));
                                            span.innerText = '(' + (f.value_source ? f.value_source + '; ' : '') + result + ')';
                                            e.appendChild(s);
                                        }
                                    });
                                    this.e.classList[n ? 'remove' : 'add']('hidden');
                                }
                                if (('variables' in p.value.parsed || 'summary' in p.value.parsed) && !(v.y in this.depends)) {
                                    this.depends[v.y] = true;
                                    this.site.add_dependency(v.y, { type: 'update', id: this.id });
                                }
                                else if ('filter' in p.value.parsed && !('viewFilter' in this.depends)) {
                                    this.depends.viewFilter = true;
                                    this.site.add_dependency('view.filter', { type: 'update', id: this.id });
                                }
                                if (p.name.ref) {
                                    if (p.name.value_source)
                                        p.name.value_source = p.value.text;
                                    const e = p.name.get(entity, caller);
                                    if ('object' !== typeof e) {
                                        p.base.firstElementChild.innerText = e;
                                    }
                                }
                                if (p.value.ref) {
                                    const e = p.value.get(entity, caller);
                                    if (Array.isArray(e)) {
                                        if ('sources' === p.value.parsed.variables) {
                                            p.base.innerHTML = '';
                                            p.base.appendChild(document.createElement('table'));
                                            p.base.lastElementChild.className = 'source-table';
                                            p.base.firstElementChild.appendChild(document.createElement('thead'));
                                            p.base.firstElementChild.firstElementChild.appendChild(document.createElement('tr'));
                                            p.base.firstElementChild.firstElementChild.firstElementChild.appendChild(document.createElement('th'));
                                            p.base.firstElementChild.firstElementChild.firstElementChild.appendChild(document.createElement('th'));
                                            p.base.firstElementChild.firstElementChild.firstElementChild.firstElementChild.innerText = 'Source';
                                            p.base.firstElementChild.firstElementChild.firstElementChild.lastElementChild.innerText = 'Accessed';
                                            p.base.firstElementChild.appendChild(document.createElement('tbody'));
                                            e.forEach(ei => {
                                                p.base.firstElementChild.lastElementChild.appendChild(make_variable_source(ei, true));
                                            });
                                        }
                                    }
                                    else {
                                        p.base.lastElementChild.innerText = this.parse_variables(e, p.value.parsed.variables, entity);
                                    }
                                }
                            });
                        }
                    }
                }
                this.revert();
            });
        }
        parse_variables(s, type, entity) {
            if ('statement' === type) {
                const patterns = this.site.patterns;
                for (let m, v; (m = patterns.mustache.exec(s));) {
                    if ('value' === m[1]) {
                        v = entity
                            ? this.site.data.format_value(entity.get_value(this.v, this.time), this.dataset in this.site.data.variables[this.v].info &&
                                'integer' === this.site.data.variables[this.v].info[this.dataset].type)
                            : NaN;
                        const info = this.site.data.variable_info[this.v];
                        let type = info.unit || info.type;
                        if (info.aggregation_method && !(type in value_types))
                            type = info.aggregation_method;
                        s = s.replace(m[0], !isNaN(v) && type in value_types ? value_types[type](v) : v);
                        patterns.mustache.lastIndex = 0;
                    }
                    else if (entity) {
                        if ('region_name' === m[1]) {
                            s = s.replace(m[0], entity.features.name);
                            patterns.mustache.lastIndex = 0;
                        }
                        else if (patterns.features.test(m[1])) {
                            s = s.replace(m[0], entity.features[m[1].replace(patterns.features, '')]);
                            patterns.mustache.lastIndex = 0;
                        }
                        else if (patterns.variables.test(m[1])) {
                            s = s.replace(m[0], entity.variables[this.v][m[1].replace(patterns.variables, '')]);
                            patterns.mustache.lastIndex = 0;
                        }
                        else if (patterns.data.test(m[1])) {
                            s = s.replace(m[0], entity.get_value(m[1].replace(patterns.data, ''), this.time));
                            patterns.mustache.lastIndex = 0;
                        }
                    }
                }
            }
            return s;
        }
        fill_summary_table(table, summary, time) {
            const e = table.lastElementChild.firstElementChild.children;
            filter_components.summary.forEach((c, i) => {
                e[i].innerText = this.site.data.format_value(summary[c][time], 0 === i);
            });
        }
    }

    class OutputMap extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'map';
            this.parsed = {};
            this.layers = {};
            this.overlays = [];
            this.tiles = {};
            this.fresh_shapes = false;
            this.has_time = false;
            this.by_time = [];
            this.triggers = {};
            this.vstate = '';
            this.cstate = '';
            this.reference_options = {};
            this.queue_init = this.queue_init.bind(this);
            this.mouseover = this.mouseover.bind(this);
            this.mouseout = this.mouseout.bind(this);
            this.click = this.click.bind(this);
            this.show_overlay = this.show_overlay.bind(this);
            this.color = this.e.dataset.color;
            this.options = this.spec.options;
            Object.keys(this.options).forEach(k => {
                const opt = this.options[k];
                if ('string' === typeof opt && opt in site.inputs)
                    this.reference_options[k] = opt;
            });
            if (!this.e.style.height)
                this.e.style.height = this.options.height ? this.options.height : '400px';
        }
        init() {
            const dep = { type: 'update', id: this.id }, view = this.site.dataviews[this.view];
            if (view) {
                if (view.time_agg in this.site.inputs)
                    this.site.add_dependency(view.time_agg, dep);
                if (view.y)
                    this.site.add_dependency(view.y, dep);
            }
            else
                this.view = this.site.defaults.dataview;
            this.site.add_dependency(this.view, dep);
            if (this.color in this.site.inputs)
                this.site.add_dependency(this.color, dep);
            if (this.time)
                this.site.add_dependency(this.time, dep);
            const click_ref = this.e.dataset.click;
            if (click_ref in this.site.inputs)
                this.clickto = this.site.inputs[click_ref];
            if (this.options.overlays_from_measures && this.site.data.variable_info) {
                if (Array.isArray(this.spec.overlays))
                    this.overlays = this.spec.overlays;
                Object.keys(this.site.data.variable_info).forEach(variable => {
                    const info = this.site.data.variable_info[variable];
                    if (info.layer && info.layer.source) {
                        const source = [], layer = { variable: variable, source: source };
                        if ('string' === typeof info.layer.source && this.site.patterns.time_ref.test(info.layer.source)) {
                            const temp = info.layer.source;
                            for (let range = this.site.data.meta.ranges[variable], y = range[0], max = range[1] + 1, time; y < max; y++) {
                                time = this.site.data.meta.overall.value[y];
                                source.push({ url: temp.replace(this.site.patterns.time_ref, time + ''), time: time });
                            }
                        }
                        this.site.patterns.time_ref.lastIndex = 0;
                        if (info.layer.filter && (Array.isArray(info.layer.filter) || 'feature' in info.layer.filter))
                            layer.filter = info.layer.filter;
                        this.overlays.push(layer);
                    }
                });
            }
            this.queue_init();
        }
        queue_init() {
            const theme = this.site.spec.settings.theme_dark ? 'dark' : 'light', showing = this.deferred || !this.tab || this.tab.classList.contains('show');
            if (showing && window.L) {
                this.map = window.L.map(this.e, this.options);
                this.overlay = window.L.featureGroup().addTo(this.map);
                this.displaying = window.L.featureGroup().addTo(this.map);
                this.overlay_control = window.L.control
                    .layers()
                    .setPosition('topleft')
                    .addOverlay(this.overlay, 'Overlay')
                    .addTo(this.map);
                const tiles = this.spec.tiles;
                if (tiles) {
                    if ('url' in tiles) {
                        this.tiles[theme] = window.L.tileLayer(tiles.url, tiles.options);
                        this.tiles[theme].addTo(this.map);
                    }
                    else {
                        Object.keys(tiles).forEach((k) => {
                            this.tiles[k] = window.L.tileLayer(tiles[k].url, tiles[k].options);
                            if (theme === k)
                                this.tiles[k].addTo(this.map);
                        });
                    }
                }
                const time = this.site.data.meta.overall.value[this.site.dataviews[this.view].parsed.time_agg];
                this.spec.shapes.forEach((shape, i) => {
                    const has_time = 'time' in shape;
                    if (has_time) {
                        if (!this.has_time) {
                            this.has_time = true;
                            this.site.add_dependency(this.view, { type: 'update', id: this.id });
                        }
                        this.by_time.push(+shape.time);
                    }
                    let k = shape.name;
                    if (!k)
                        shape.name = k = this.site.spec.metadata.datasets[i < this.site.spec.metadata.datasets.length ? i : 0];
                    const mapId = k + (has_time ? shape.time : '');
                    if (!(mapId in this.site.maps.queue))
                        this.site.maps.queue[mapId] = shape;
                    this.site.data.inited[mapId + this.id] = false;
                    if ((this.site.data.loaded[k] || k === this.site.spec.settings.background_shapes) &&
                        (k === mapId || (time && this.by_time.length && shape.time == this.match_time(time))))
                        this.retrieve_layer(shape);
                });
                if (this.has_time)
                    this.by_time.sort();
                if (Array.isArray(this.overlays)) {
                    this.overlays.forEach(l => {
                        if ('string' === typeof l.source)
                            l.source = [{ url: l.source }];
                        const source = l.source;
                        source.forEach(s => {
                            s.processed = false;
                            s.property_summaries = {};
                            this.site.maps.queue[s.url] = s;
                        });
                        this.triggers[l.variable] = { source };
                        const fs = l.filter;
                        if (fs) {
                            const fa = Array.isArray(fs) ? fs : [fs];
                            this.triggers[l.variable].filter = fa;
                            fa.forEach(f => {
                                f.check = DataHandler.checks[f.operator];
                            });
                        }
                    });
                }
                this.update();
            }
            else {
                this.deferred = true;
                setTimeout(this.queue_init, showing ? 0 : 2000);
            }
        }
        match_time(time) {
            let i = this.by_time.length;
            for (; i--;)
                if (!i || this.by_time[i] <= time)
                    break;
            return this.by_time[i];
        }
        show(e) {
            if (e.layer && e.layer[this.id]) {
                const highlight_style = {
                    color: 'var(--border-highlight)',
                    weight: this.site.spec.settings.polygon_outline + 1,
                    fillOpacity: 1,
                }, layer = e.layer[this.id];
                if ('has_time' in layer) {
                    if (!this.site.data.inited[this.parsed.dataset + this.id]) {
                        const time = this.match_time(this.site.data.meta.overall.value[this.site.data.variables[this.parsed.color].time_range[this.parsed.dataset][0] + this.parsed.time]);
                        if (layer[time])
                            layer[time].setStyle(highlight_style);
                    }
                }
                else if (layer.setStyle) {
                    layer.setStyle(highlight_style);
                }
            }
        }
        revert(e) {
            if (e.layer && e.layer[this.id]) {
                const default_style = {
                    color: 'var(--border)',
                    weight: this.site.spec.settings.polygon_outline,
                    fillOpacity: 0.7,
                }, layer = e.layer[this.id];
                if ('has_time' in layer) {
                    if (!this.site.data.inited[this.parsed.dataset + this.id]) {
                        const time = this.match_time(this.site.data.meta.overall.value[this.site.data.variables[this.parsed.color].time_range[this.parsed.dataset][0] + this.parsed.time]);
                        if (layer[time])
                            layer[time].setStyle(default_style);
                    }
                }
                else {
                    layer.setStyle(default_style);
                }
            }
        }
        mouseover(e) {
            e.target.setStyle({
                color: 'var(--border-highlight)',
            });
            this.site.subs.update(this.id, 'show', this.site.data.entities[e.target.feature.properties[e.target.source.id_property]]);
        }
        mouseout(e) {
            this.site.subs.update(this.id, 'revert', this.site.data.entities[e.target.feature.properties[e.target.source.id_property]]);
            e.target.setStyle({
                color: 'var(--border)',
            });
        }
        click(e) {
            if (this.clickto)
                this.clickto.set(e.target.feature.properties[e.target.source.id_property]);
        }
        update(entity, caller, pass) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.queue > 0)
                    clearTimeout(this.queue);
                this.queue = -1;
                if (!pass) {
                    if (!this.tab || this.tab.classList.contains('show'))
                        this.queue = setTimeout(() => this.update(void 0, void 0, true), 50);
                }
                else {
                    if (this.view && this.displaying) {
                        const parsed = this.parsed, view = this.site.dataviews[this.view], d = view.get.dataset(), time = this.site.valueOf(view.time_agg), map_time = this.has_time ? this.match_time(time) : '', inited = d + map_time + this.id in this.site.data.inited, mapId = inited ? d + map_time : d;
                        if (this.site.maps.queue && mapId in this.site.maps.queue && !this.site.data.inited[mapId + this.id]) {
                            if (!inited || null !== time)
                                this.retrieve_layer(this.site.maps.queue[mapId], () => this.update(void 0, void 0, true));
                            return;
                        }
                        if (!view.valid[d] && this.site.data.inited[d]) {
                            view.state = '';
                            view.update();
                        }
                        parsed.view = view;
                        parsed.dataset = d;
                        const vstate = view.value() +
                            mapId +
                            this.site.spec.settings.background_shapes +
                            this.site.spec.settings.background_top +
                            this.site.spec.settings.background_polygon_outline +
                            this.site.data.inited[this.options.background_shapes], a = view.selection.all, s = view.selection[this.site.spec.settings.background_shapes && this.options.background_shapes ? 'ids' : 'all'], c = this.site.valueOf(this.color || view.y);
                        if (this.site.spec.settings.map_overlay && c in this.triggers) {
                            this.show_overlay(this.triggers[c], this.site.data.meta.overall.value[view.parsed.time_agg]);
                        }
                        else {
                            this.overlay_control.remove();
                            this.overlay.clearLayers();
                        }
                        if (this.site.data.inited[mapId + this.id] && view.valid[d]) {
                            const ys = this.time
                                ? this.site.inputs[this.time]
                                : view.time_agg
                                    ? view.time_agg in this.site.inputs
                                        ? this.site.inputs[view.time_agg]
                                        : parseInt(view.time_agg)
                                    : 0, time_input = 'number' !== typeof ys;
                            parsed.palette = (this.site.valueOf(view.palette) || this.site.spec.settings.palette);
                            if (!(parsed.palette in palettes))
                                parsed.palette = this.site.defaults.palette;
                            const varc = yield this.site.data.get_variable(c, this.site.dataviews[this.view]), summary = varc.views[this.view].summaries[d], time = (time_input && ys.parsed ? ys.value() - this.site.data.meta.times[d].range[0] : 0) -
                                varc.time_range[d][0];
                            parsed.summary = summary;
                            parsed.time = time;
                            parsed.color = c;
                            const subset = !time_input && summary.n[ys] === view.n_selected.dataset ? 'rank' : 'subset_rank';
                            if (vstate !== this.vstate) {
                                this.map._zoomAnimated = 'none' !== this.site.spec.settings.map_animations;
                                Object.keys(this.reference_options).forEach(k => {
                                    this.options[k] = this.site.valueOf(this.reference_options[k]);
                                    if ('zoomAnimation' === k)
                                        this.map._zoomAnimated = this.options[k];
                                });
                                this.displaying.clearLayers();
                                this.fresh_shapes = true;
                                this.vstate = '';
                                let n = 0;
                                Object.keys(s).forEach(k => {
                                    const skl = s[k].layer && s[k].layer[this.id];
                                    if (skl) {
                                        const fg = k in a, cl = 'has_time' in skl ? skl[map_time] : skl;
                                        if (cl && (fg || this.options.background_shapes === this.site.data.entities[k].group)) {
                                            n++;
                                            cl.options.interactive = fg;
                                            cl.addTo(this.displaying);
                                            if (fg) {
                                                if (this.site.spec.settings.background_top)
                                                    cl.bringToBack();
                                            }
                                            else {
                                                if (!this.site.spec.settings.background_top)
                                                    cl.bringToBack();
                                                cl.setStyle({
                                                    fillOpacity: 0,
                                                    color: 'var(--border-highlight)',
                                                    weight: this.site.spec.settings.background_polygon_outline,
                                                });
                                            }
                                            if (!this.vstate)
                                                this.vstate = vstate;
                                        }
                                    }
                                });
                                this.overlay.bringToFront();
                                if (n)
                                    if ('fly' === this.site.spec.settings.map_animations) {
                                        setTimeout(() => this.map.flyToBounds(this.displaying.getBounds()), 400);
                                    }
                                    else {
                                        this.map.fitBounds(this.displaying.getBounds());
                                    }
                            }
                            // coloring
                            const k = c +
                                this.vstate +
                                parsed.palette +
                                time +
                                this.site.spec.settings.polygon_outline +
                                this.site.spec.settings.color_by_order +
                                this.site.spec.settings.color_scale_center;
                            if (k !== this.cstate) {
                                this.cstate = k;
                                const ls = this.displaying._layers;
                                const n = summary.n[time];
                                Object.keys(ls).forEach(id => {
                                    const lsi = ls[id];
                                    if (d === lsi.entity.group) {
                                        const e = a[lsi.entity.features.id], es = e && e.views[this.view][subset];
                                        lsi.setStyle({
                                            fillOpacity: 0.7,
                                            color: 'var(--border)',
                                            fillColor: e && c in es
                                                ? this.site.get_color(e.get_value(c, time), parsed.palette, summary, time, es[c][time], n)
                                                : this.site.defaults.missing,
                                            weight: this.site.spec.settings.polygon_outline,
                                        });
                                    }
                                });
                            }
                        }
                    }
                }
            });
        }
        retrieve_layer(source, callback) {
            return __awaiter(this, void 0, void 0, function* () {
                const mapId = source.name ? source.name + (source.time || '') : source.url;
                if (!('_raw' in this.site.spec.map))
                    this.site.spec.map._raw = {};
                if (source.url in this.site.spec.map._raw) {
                    this.process_layer(source);
                    this.site.maps.queue[mapId].retrieved = true;
                    callback && callback();
                }
                else {
                    if (this.site.maps.queue[mapId] && 'retrieved' in this.site.maps.queue[mapId]) {
                        if (callback) {
                            if (!this.site.maps.queue[mapId].callbacks)
                                this.site.maps.queue[mapId].callbacks = [];
                            this.site.maps.queue[mapId].callbacks.push(callback);
                        }
                    }
                    else {
                        this.site.maps.queue[mapId].retrieved = false;
                        const f = new window.XMLHttpRequest();
                        f.onreadystatechange = () => {
                            if (4 === f.readyState && 200 === f.status) {
                                this.site.spec.map._raw[source.url] = f.responseText;
                                if (source.name) {
                                    this.site.maps.queue[mapId].retrieved = true;
                                }
                                if (this.site.maps.queue[mapId].callbacks) {
                                    if (callback)
                                        this.site.maps.queue[mapId].callbacks.push(callback);
                                    this.site.maps.queue[mapId].callbacks.forEach(f => f());
                                }
                                else
                                    callback && callback();
                            }
                        };
                        f.open('GET', source.url, true);
                        f.send();
                    }
                }
            });
        }
        process_layer(source) {
            const has_time = 'time' in source, layerId = source.name + (has_time ? source.time : '');
            this.layers[layerId] = window.L.geoJSON(JSON.parse(this.site.spec.map._raw[source.url]), {
                onEachFeature: (f, l) => {
                    l.on({
                        mouseover: this.mouseover,
                        mouseout: this.mouseout,
                        click: this.click,
                    });
                    l.setStyle({ weight: 0, fillOpacity: 0 });
                    l.source = source;
                    const p = l.feature.properties;
                    let id = p[source.id_property];
                    if (!(id in this.site.data.entities) && this.site.patterns.leading_zeros.test(id))
                        id = p[source.id_property] = id.replace(this.site.patterns.leading_zeros, '');
                    if (!(id in this.site.data.entities)) {
                        this.site.data.entities[id] = { layer: {}, features: { id: id } };
                    }
                    const entity = this.site.data.entities[id];
                    if (!('layer' in entity))
                        entity.layer = {};
                    if (has_time) {
                        if (!(this.id in entity.layer))
                            entity.layer[this.id] = { has_time: true };
                        entity.layer[this.id][source.time] = l;
                    }
                    else
                        entity.layer[this.id] = l;
                    l.entity = entity;
                    if (entity.features)
                        Object.keys(p).forEach(f => {
                            if (!(f in entity.features)) {
                                if ('name' === f.toLowerCase() &&
                                    (!('name' in entity.features) || entity.features.id === entity.features.name)) {
                                    entity.features[f.toLowerCase()] = p[f];
                                }
                                else {
                                    entity.features[f] = p[f];
                                }
                            }
                        });
                },
            });
            this.site.data.inited[layerId + this.id] = true;
            if (this.site.maps.waiting && this.site.maps.waiting[source.name]) {
                for (let i = this.site.maps.waiting[source.name].length; i--;) {
                    this.site.request_queue(this.site.maps.waiting[source.name][i]);
                }
            }
        }
        show_overlay(o, time) {
            let i = 0, source = '';
            if ('string' === typeof o.source) {
                source = o.source;
            }
            else {
                for (i = o.source.length; i--;) {
                    if (!o.source[i].time || time === o.source[i].time) {
                        if (o.source[i].name)
                            delete o.source[i].name;
                        source = o.source[i].url;
                        break;
                    }
                }
            }
            if (source) {
                if (source in this.site.spec.map._raw) {
                    if (!(source in this.layers)) {
                        const property_summaries = {};
                        if (!this.site.maps.queue[source].processed) {
                            this.site.maps.queue[source].property_summaries = property_summaries;
                        }
                        this.layers[source] = window.L.geoJSON(JSON.parse(this.site.spec.map._raw[source]), {
                            pointToLayer: (point, coords) => window.L.circleMarker(coords),
                            onEachFeature: l => {
                                const props = l.properties;
                                if (props) {
                                    Object.keys(props).forEach(f => {
                                        const v = props[f];
                                        if ('number' === typeof v) {
                                            if (!(f in property_summaries))
                                                property_summaries[f] = [Infinity, -Infinity, 0];
                                            if (v < property_summaries[f][0])
                                                property_summaries[f][0] = v;
                                            if (v > property_summaries[f][1])
                                                property_summaries[f][1] = v;
                                        }
                                    });
                                }
                            },
                        }).on('mouseover', (l) => {
                            const layer = l.propagatedFrom;
                            if (layer && !layer._tooltip) {
                                const props = layer.feature && layer.feature.properties;
                                if (props) {
                                    const e = document.createElement('table');
                                    Object.keys(props).forEach(f => {
                                        const v = props[f], tr = document.createElement('tr');
                                        let td = document.createElement('td');
                                        tr.appendChild(td);
                                        td.innerText = f;
                                        tr.appendChild((td = document.createElement('td')));
                                        td.innerText = v;
                                        e.appendChild(tr);
                                    });
                                    layer.bindTooltip(e);
                                    layer.openTooltip();
                                }
                            }
                        });
                        Object.keys(property_summaries).forEach(f => {
                            property_summaries[f][2] = property_summaries[f][1] - property_summaries[f][0];
                            if (!property_summaries[f][2])
                                delete property_summaries[f];
                        });
                        this.site.maps.overlay_property_selectors.forEach(u => {
                            if (!(source in u.option_sets)) {
                                fill_overlay_properties_options(u, source, u.option_sets);
                                u.dataset = source;
                                u.variable = '';
                            }
                        });
                    }
                    this.site.maps.overlay_property_selectors.forEach(u => {
                        u.dataset = source;
                        this.site.conditionals.options(u);
                    });
                    this.overlay.clearLayers();
                    let n = 0;
                    const summaries = this.site.spec.settings.circle_property && this.site.maps.queue[source].property_summaries, prop_summary = summaries && summaries[this.site.spec.settings.circle_property];
                    this.layers[source].eachLayer((l) => {
                        if (o.filter) {
                            for (let i = o.filter.length; i--;) {
                                if (!o.filter[i].check(l.feature.properties[o.filter[i].feature], o.filter[i].value))
                                    return;
                            }
                        }
                        n++;
                        l.setRadius(prop_summary
                            ? ((l.feature.properties[this.site.spec.settings.circle_property] - prop_summary[0]) /
                                prop_summary[2] +
                                0.5) *
                                this.site.spec.settings.circle_radius
                            : this.site.spec.settings.circle_radius).setStyle({
                            weight: this.site.spec.settings.polygon_outline,
                            color: 'white',
                            opacity: 0.5,
                            fillOpacity: 0.5,
                            fillColor: 'black',
                        });
                        l.addTo(this.overlay);
                    });
                    if (n)
                        this.overlay_control.addTo(this.map);
                }
                else
                    return this.retrieve_layer(o.source[i], () => this.show_overlay(o, time));
            }
        }
    }

    class OutputPlotly extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'plotly';
            this.previous_span = 1;
            this.traces = {};
            this.parsed = {};
            this.queue = -1;
            this.state = '';
            this.reference_options = {};
            this.queue_init = this.queue_init.bind(this);
            this.mouseover = this.mouseover.bind(this);
            this.mouseout = this.mouseout.bind(this);
            this.click = this.click.bind(this);
            this.x = e.dataset.x;
            this.y = e.dataset.y;
            this.color = e.dataset.color;
            this.time = e.dataset.colorTime;
            Object.keys(this.spec).forEach(k => {
                const opt = this.spec[k];
                if ('string' === typeof opt && opt in site.inputs)
                    this.reference_options[k] = opt;
            });
            if (this.tab) {
                document.getElementById(e.parentElement.getAttribute('aria-labelledby')).addEventListener('click', function () {
                    if (!this.e.parentElement.classList.contains('active')) {
                        setTimeout(this.update, 155);
                        setTimeout(this.site.page.trigger_resize, 155);
                    }
                }.bind(this));
            }
        }
        init() {
            if (this.x && !(this.x in this.site.data.variables)) {
                this.site.add_dependency(this.x, { type: 'update', id: this.id });
            }
            if (this.y && !(this.y in this.site.data.variables)) {
                this.site.add_dependency(this.y, { type: 'update', id: this.id });
            }
            if (this.color && !(this.color in this.site.data.variables)) {
                this.site.add_dependency(this.color, { type: 'update', id: this.id });
            }
            if (this.time in this.site.inputs) {
                this.site.add_dependency(this.time, { type: 'update', id: this.id });
            }
            if (this.view) {
                this.site.add_dependency(this.view, { type: 'update', id: this.id });
                this.site.add_dependency(this.view + '_filter', { type: 'update', id: this.id });
                if (this.site.dataviews[this.view].time_agg in this.site.dataviews)
                    this.site.add_dependency(this.site.dataviews[this.view].time_agg, { type: 'update', id: this.id });
            }
            else
                this.view = this.site.defaults.dataview;
            this.spec.data.forEach((p, i) => {
                Object.keys(p).forEach((k) => {
                    if (this.site.patterns.period.test(k)) {
                        const es = k.split('.'), n = es.length - 1;
                        let pl;
                        es.forEach((e, ei) => {
                            pl = pl ? (pl[e] = ei === n ? p[k] : {}) : (p[e] = {});
                        });
                    }
                });
                if (!('textfont' in p))
                    p.textfont = {};
                if (!('color' in p.textfont))
                    p.textfont.color = this.site.defaults.background_highlight;
                if (!('line' in p))
                    p.line = {};
                if (!('color' in p.line))
                    p.line.color = this.site.defaults.background_highlight;
                if (!('marker' in p))
                    p.marker = {};
                p.marker.size = 8;
                if (!('color' in p.marker))
                    p.marker.color = this.site.defaults.background_highlight;
                if (!('line' in p.marker))
                    p.marker.line = {};
                if (!('color' in p.marker.line))
                    p.marker.line.color = this.site.defaults.background_highlight;
                if (!('text' in p))
                    p.text = [];
                if (!('x' in p))
                    p.x = [];
                if ('box' === p.type) {
                    p.hoverinfo = 'none';
                }
                else if (!('y' in p))
                    p.y = [];
                this.traces[p.type] = JSON.stringify(p);
                if (!i) {
                    this.base_trace = p.type;
                    if (this.base_trace in this.site.inputs)
                        this.site.add_dependency(this.base_trace, { type: 'update', id: this.id });
                }
            });
            const click_ref = this.e.dataset.click;
            if (click_ref in this.site.inputs)
                this.clickto = this.site.inputs[click_ref];
            this.queue_init();
        }
        show(e) {
            this.revert();
            let trace = this.make_data_entry(e, 0, 0, 'hover_line', this.site.defaults['border_highlight_' + this.site.spec.settings.theme_dark]);
            if (trace) {
                trace.line.width = 4;
                trace.marker.size = 12;
                Plotly.addTraces(this.e, trace, this.e.data.length);
            }
        }
        revert() {
            const data = this.e.data;
            if (data.length && 'hover_line' === data[data.length - 1].name)
                Plotly.deleteTraces(this.e, data.length - 1);
        }
        queue_init() {
            const showing = this.deferred || !this.tab || this.tab.classList.contains('show');
            if (showing && 'Plotly' in window) {
                Plotly.newPlot(this.e, this.spec.data, this.spec.layout, this.spec.config);
                this.e.on('plotly_hover', this.mouseover);
                this.e.on('plotly_unhover', this.mouseout);
                this.e.on('plotly_click', this.click);
                this.update_theme();
                this.update();
            }
            else {
                this.deferred = true;
                setTimeout(this.queue_init, showing ? 0 : 2000);
            }
        }
        mouseover(d) {
            if (d.points && 1 === d.points.length && this.e.data[d.points[0].fullData.index]) {
                Plotly.restyle(this.e, { 'line.width': 5 }, d.points[0].fullData.index);
                this.site.subs.update(this.id, 'show', this.site.data.entities[d.points[0].data.id]);
            }
        }
        mouseout(d) {
            if (d.points && 1 === d.points.length && this.e.data[d.points[0].fullData.index]) {
                Plotly.restyle(this.e, { 'line.width': 2 }, d.points[0].fullData.index);
                this.site.subs.update(this.id, 'revert', this.site.data.entities[d.points[0].data.id]);
            }
        }
        click(d) {
            this.clickto && this.clickto.set(d.points[0].data.id);
        }
        update(pass) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.queue > 0)
                    clearTimeout(this.queue);
                this.queue = -1;
                if (!pass) {
                    if (!this.tab || this.tab.classList.contains('show'))
                        this.queue = setTimeout(() => this.update(true), 50);
                }
                else {
                    if (this.e.layout) {
                        const v = this.site.dataviews[this.view], s = v.selection && v.selection.all, d = v.get.dataset(), y = this.site.inputs[this.time || v.time_agg], parsed = this.parsed;
                        if (this.site.data.inited[d] && v.valid[d] && v.time_range.filtered.length) {
                            parsed.base_trace = this.site.valueOf(this.base_trace);
                            parsed.x = this.site.valueOf(this.x);
                            parsed.y = this.site.valueOf(this.y);
                            parsed.color = this.site.valueOf(this.color || v.y || parsed.y);
                            const varx = yield this.site.data.get_variable(parsed.x, v), vary = yield this.site.data.get_variable(parsed.y, v), varcol = yield this.site.data.get_variable(parsed.color, v);
                            parsed.x_range = varx.time_range[d];
                            parsed.y_range = vary.time_range[d];
                            parsed.view = v;
                            parsed.dataset = d;
                            parsed.palette = (this.site.valueOf(v.palette) || this.site.spec.settings.palette);
                            if (!(parsed.palette in this.site.palettes))
                                parsed.palette = this.site.defaults.palette;
                            parsed.time =
                                (y ? y.value() - this.site.data.meta.times[d].range[0] : 0) - varcol.time_range[d][0];
                            parsed.summary = varcol.views[this.view].summaries[d];
                            const ns = parsed.summary.n, display_time = ns[parsed.time] ? parsed.time : 0, summary = vary.views[this.view].summaries[d], n = ns[display_time], subset = n !== v.n_selected.dataset, rank = subset ? 'subset_rank' : 'rank', order = subset ? varcol.views[this.view].order[d][display_time] : varcol.info[d].order[display_time], traces = [];
                            let i = parsed.summary.missing[display_time], k, b, fn = order ? order.length : 0, settings = this.site.spec.settings, lim = settings.trace_limit || 0, jump, state = v.value() +
                                v.get.time_filters() +
                                d +
                                parsed.x +
                                parsed.y +
                                parsed.time +
                                parsed.palette +
                                parsed.color +
                                settings.summary_selection +
                                settings.color_scale_center +
                                settings.color_by_order +
                                settings.trace_limit +
                                settings.show_empty_times;
                            lim = jump = lim && lim < n ? Math.ceil(Math.min(lim / 2, n / 2)) : 0;
                            Object.keys(this.reference_options).forEach((k) => (this.spec[k] = this.site.valueOf(this.reference_options[k])));
                            for (; i < fn; i++) {
                                if (order[i][0] in s) {
                                    k = order[i][0];
                                    const e = s[k];
                                    state += k;
                                    traces.push(this.make_data_entry(e, e.views[this.view][rank][parsed.color][parsed.time], n));
                                    if (lim && !--jump)
                                        break;
                                }
                            }
                            if (lim && i < fn) {
                                for (jump = i, i = fn - 1; i > jump; i--) {
                                    if (order[i][0] in s) {
                                        k = order[i][0];
                                        const e = s[k];
                                        state += k;
                                        traces.push(this.make_data_entry(e, e.views[this.view][rank][parsed.color][parsed.time], n));
                                        if (!--lim)
                                            break;
                                    }
                                }
                            }
                            state += traces.length && traces[0].type;
                            if (settings.boxplots && 'box' in this.traces && s[k]) {
                                state += 'box' + settings.iqr_box;
                                b = JSON.parse(this.traces.box);
                                traces.push(b);
                                b.line.color = this.site.defaults.border;
                                b.median = summary.median;
                                b.q3 = summary.q3;
                                b.q1 = summary.q1;
                                if (settings.iqr_box) {
                                    b.upperfence = [];
                                    b.lowerfence = [];
                                    b.q1.forEach((q1, i) => {
                                        if (isNaN(b.median[i]))
                                            b.median[i] = 0;
                                        const n = (b.q3[i] - q1) * 1.5, med = b.median[i];
                                        b.q3[i] = isNaN(b.q3[i]) ? med : Math.max(med, b.q3[i]);
                                        b.upperfence[i] = b.q3[i] + n;
                                        b.q1[i] = isNaN(b.q1[i]) ? med : Math.min(med, q1);
                                        b.lowerfence[i] = q1 - n;
                                    });
                                }
                                else {
                                    b.upperfence = summary.max;
                                    b.lowerfence = summary.min;
                                }
                                if (settings.show_empty_times) {
                                    b.x = b.q1.map((_, i) => s[k].get_value(parsed.x, i + parsed.y_range[0]));
                                }
                                else {
                                    b.x = [];
                                    for (i = b.q1.length; i--;) {
                                        if (ns[i]) {
                                            b.x[i] = s[k].get_value(parsed.x, i + parsed.y_range[0]);
                                        }
                                    }
                                }
                            }
                            if (state !== this.state) {
                                if ('boolean' !== typeof this.e.layout.yaxis.title)
                                    this.e.layout.yaxis.title =
                                        this.site.data.format_label(parsed.y) +
                                            (settings.trace_limit < v.n_selected.all ? ' (' + settings.trace_limit + ' extremes)' : '');
                                if ('boolean' !== typeof this.e.layout.xaxis.title)
                                    this.e.layout.xaxis.title = this.site.data.format_label(parsed.x);
                                this.e.layout.yaxis.autorange = false;
                                this.e.layout.yaxis.range = [Infinity, -Infinity];
                                if (!b)
                                    b = { upperfence: summary.max, lowerfence: summary.min };
                                let any_skipped = false;
                                summary.min.forEach((min, i) => {
                                    if (settings.show_empty_times || ns[i]) {
                                        const l = Math.min(b.lowerfence[i], min), u = Math.max(b.upperfence[i], summary.max[i]);
                                        if (this.e.layout.yaxis.range[0] > l)
                                            this.e.layout.yaxis.range[0] = l;
                                        if (this.e.layout.yaxis.range[1] < u)
                                            this.e.layout.yaxis.range[1] = u;
                                    }
                                    else
                                        any_skipped = true;
                                });
                                const r = (this.e.layout.yaxis.range[1] - this.e.layout.yaxis.range[0]) / 10;
                                this.e.layout.yaxis.range[0] -= r;
                                this.e.layout.yaxis.range[1] += r;
                                if (this.e.layout.yaxis.range[1] > 100) {
                                    const yinfo = vary.info[d].info;
                                    if (yinfo && 'percent' === (yinfo.aggregation_method || yinfo.type))
                                        this.e.layout.yaxis.range[1] = 100;
                                }
                                if (this.site.data.variables[parsed.x].is_time) {
                                    const start = v.time_range.filtered[0], end = v.time_range.filtered[1], adj = any_skipped && end > start ? Math.log(end - start) : 0.5;
                                    if (this.e.layout.xaxis.autorange) {
                                        this.e.layout.xaxis.autorange = false;
                                        this.e.layout.xaxis.type = 'linear';
                                        this.e.layout.xaxis.dtick = 1;
                                        this.e.layout.xaxis.range = [start - adj, end + adj];
                                    }
                                    else {
                                        this.e.layout.xaxis.range[0] = start - adj;
                                        this.e.layout.xaxis.range[1] = end + adj;
                                    }
                                }
                                if (b.lowerfence.length < this.previous_span) {
                                    Plotly.newPlot(this.e, traces, this.e.layout, this.e.config);
                                    this.e
                                        .on('plotly_hover', this.mouseover)
                                        .on('plotly_unhover', this.mouseout)
                                        .on('plotly_click', this.click);
                                }
                                else {
                                    Plotly.react(this.e, traces, this.e.layout, this.e.config);
                                }
                                setTimeout(this.site.page.trigger_resize, 300);
                                this.previous_span = b.lowerfence.length;
                                this.state = state;
                            }
                        }
                    }
                }
            });
        }
        make_data_entry(e, rank, total, name, color) {
            const data = this.site.data;
            if (e.data && this.parsed.x in data.variables) {
                const x = data.get_value({ variable: this.parsed.x, entity: e }), y = data.get_value({ variable: this.parsed.y, entity: e }), t = JSON.parse(this.traces[this.base_trace]), yr = data.variables[this.parsed.y].time_range[this.parsed.dataset], xr = data.variables[this.parsed.x].time_range[this.parsed.dataset], n = Math.min(yr[1], xr[1]) + 1, ns = this.parsed.summary.n;
                for (let i = Math.max(yr[0], xr[0]); i < n; i++) {
                    if (this.site.spec.settings.show_empty_times || ns[i - this.parsed.y_range[0]]) {
                        t.text.push(e.features.name);
                        t.x.push(this.parsed.x_range[0] <= i && i <= this.parsed.x_range[1] ? x[i - this.parsed.x_range[0]] : NaN);
                        t.y.push(this.parsed.y_range[0] <= i && i <= this.parsed.y_range[1] ? y[i - this.parsed.y_range[0]] : NaN);
                    }
                }
                t.type = this.parsed.base_trace;
                t.color =
                    t.line.color =
                        t.marker.color =
                            t.textfont.color =
                                color ||
                                    this.site.get_color(e.get_value(this.parsed.color, this.parsed.time), this.parsed.palette, this.parsed.summary, this.parsed.time, rank, total) ||
                                    this.site.defaults.border;
                if ('bar' === t.type)
                    t.marker.line.width = 0;
                t.name = name || e.features.name;
                t.id = e.features.id;
                return t;
            }
        }
        update_theme() {
            if (this.dark_theme !== this.site.spec.settings.theme_dark) {
                this.dark_theme = this.site.spec.settings.theme_dark;
                const s = getComputedStyle(document.body);
                if (!('style' in this)) {
                    this.style = this.spec.layout;
                    if (!('font' in this.style))
                        this.style.font = {};
                    if (!('modebar' in this.style))
                        this.style.modebar = {};
                }
                this.style.paper_bgcolor = s.backgroundColor;
                this.style.plot_bgcolor = s.backgroundColor;
                this.style.font.color = s.color;
                this.style.modebar.bgcolor = s.backgroundColor;
                this.style.modebar.color = s.color;
                if (this.e._fullLayout.xaxis.showgrid)
                    this.style.xaxis.gridcolor = s.borderColor;
                if (this.e._fullLayout.yaxis.showgrid)
                    this.style.yaxis.gridcolor = s.borderColor;
                Plotly.relayout(this.e, this.spec.layout);
            }
        }
    }

    class InputButtonGroup extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'buttongroup';
            this.values = [];
            this.listen = this.listen.bind(this);
            e.addEventListener('click', this.listen);
            this.options = e.querySelectorAll('input');
        }
        get() {
            for (let i = this.options.length; i--;) {
                if (this.options[i].checked) {
                    this.set(i);
                    break;
                }
            }
        }
        set(v) {
            this.previous = this.value();
            this.current_index = 'string' === typeof v ? this.values.indexOf(v) : v;
            if (-1 !== this.current_index) {
                this.source =
                    this.values[this.current_index] in this.site.inputs
                        ? this.site.valueOf(this.values[this.current_index])
                        : this.values[this.current_index];
                this.options[this.current_index].checked = true;
            }
            else
                this.source = undefined;
            this.site.request_queue(this.id);
        }
        listen(e) {
            this.set(e.target.value);
        }
        add(value, display, noadd) {
            const input = document.createElement('input'), label = document.createElement('label');
            input.autocomplete = 'off';
            input.className = 'btn-check';
            input.type = 'radio';
            input.name = this.e.id + '_options';
            input.id = this.e.id + '_option' + this.e.childElementCount;
            input.value = value;
            label.innerText = display || this.site.data.format_label(value);
            label.className = 'btn btn-primary';
            label.dataset.for = this.e.firstElementChild.id;
            if (!noadd) {
                this.e.appendChild(input);
                this.e.appendChild(label);
            }
            return input;
        }
    }

    class InputSwitch extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'switch';
            this.listen = this.listen.bind(this);
            e.addEventListener('change', this.listen);
        }
        get() {
            this.set(this.e.checked);
        }
        set(v) {
            if ('string' === typeof v)
                v = 'on' === v || 'true' === v;
            if (v !== this.source) {
                this.previous = this.e.checked;
                this.e.checked = this.source = v;
                this.site.request_queue(this.id);
            }
        }
        listen(e) {
            this.set(this.e.checked);
        }
    }

    class InputText extends BaseInput {
        constructor(e, site) {
            super(e, site);
            this.type = 'text';
            this.listen = this.listen.bind(this);
            e.addEventListener('change', this.listen);
        }
        get() {
            this.set(this.e.value);
        }
        set(v) {
            this.previous = this.e.checked;
            this.e.value = this.source = v;
            this.site.request_queue(this.id);
        }
        listen(e) {
            this.set(this.e.value);
        }
    }

    class OutputDataTable extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'datatable';
            this.parsed = { time: 0, color: '', time_index: {} };
            this.queue = -1;
            this.pending = -1;
            this.state = '';
            this.reference_options = {};
            this.header = [];
            this.rows = {};
            this.rowIds = {};
            this.variable_header = false;
            this.current_filter = {};
            this.queue_init = this.queue_init.bind(this);
            this.mouseover = this.mouseover.bind(this);
            this.mouseout = this.mouseout.bind(this);
            this.click = this.click.bind(this);
            e.appendChild(document.createElement('thead'));
            e.appendChild(document.createElement('tbody'));
            this.style = document.head.appendChild(document.createElement('style'));
            e.addEventListener('mouseover', this.mouseover);
            e.addEventListener('mouseout', this.mouseout);
            Object.keys(this.spec).forEach(k => {
                const opt = this.spec[k];
                if ('string' === typeof opt && opt in site.inputs)
                    this.reference_options[k] = opt;
            });
            if ('string' === typeof this.spec.variables)
                this.spec.variable_source = this.spec.variables;
            if (this.tab) {
                document.getElementById(e.parentElement.getAttribute('aria-labelledby')).addEventListener('click', function () {
                    if (!this.e.parentElement.classList.contains('active')) {
                        setTimeout(this.update, 155);
                        setTimeout(this.site.page.trigger_resize, 155);
                    }
                }.bind(this));
            }
        }
        init() {
            this.parsed.dataset = this.site.dataviews[this.view].get.dataset();
            if (this.spec.variables) {
                if ('string' === typeof this.spec.variables) {
                    if (this.spec.variables in this.site.inputs) {
                        this.site.add_dependency(this.spec.variables, { type: 'update', id: this.id });
                        this.spec.variables = this.site.valueOf(this.spec.variables);
                        this.spec.single_variable = 'string' === typeof this.spec.variables;
                    }
                    else if (!this.spec.single_variable) {
                        this.spec.variables = [{ name: this.spec.variables }];
                    }
                }
            }
            else
                this.spec.variables = Object.keys(this.site.data.variables);
            if (Array.isArray(this.spec.variables)) {
                const vars = this.spec.variables;
                if (vars.length && 'string' === typeof vars[0]) {
                    this.variables = vars.map((v) => {
                        return {
                            name: v,
                        };
                    });
                }
            }
            else if ('string' === typeof this.spec.variables) {
                this.variables = { name: this.spec.variables };
            }
            const time = this.site.data.meta.times[this.parsed.dataset];
            if (this.spec.single_variable) {
                const c = this.variables;
                this.header.push({ title: 'Name', data: 'entity.features.name' });
                if (time && time.is_single)
                    this.variable_header = true;
                const t = c.name in this.site.data.variables && this.site.data.variables[c.name].time_range[this.parsed.dataset];
                if (t)
                    for (let n = t[1] - t[0] + 1; n--;) {
                        this.header[n + 1] = {
                            title: this.variable_header ? c.title || this.site.data.format_label(c.name) : time.value[n + t[0]] + '',
                            data: this.site.data.get_value,
                            render: DataHandler.retrievers.row_time.bind({
                                i: n,
                                o: t[0],
                                format_value: this.site.data.format_value.bind(this.site.data),
                            }),
                        };
                    }
                this.spec.order = [[this.header.length - 1, 'dsc']];
            }
            else if (this.spec.wide) {
                if (this.spec.features) {
                    if ('string' === typeof this.spec.features)
                        this.spec.features = [{ name: this.spec.features }];
                    this.spec.features.forEach(f => {
                        this.header.push({
                            title: f.title || f.name,
                            data: 'entity.features.' + f.name.replace(this.site.patterns.all_periods, '\\.'),
                        });
                    });
                }
                const vars = this.variables;
                for (let i = vars.length; i--;) {
                    const c = vars[i];
                    if (!c.source)
                        c.source = c.name in this.site.data.variables ? 'data' : 'features';
                    this.header.push('features' === c.source
                        ? {
                            title: c.title || this.site.data.format_label(c.name),
                            data: 'entity.features.' + c.name.toLowerCase().replace(this.site.patterns.all_periods, '\\.'),
                        }
                        : {
                            title: c.title || this.site.data.format_label(c.name),
                            render: function (d, type, row) {
                                return __awaiter(this, void 0, void 0, function* () {
                                    if ('data' === this.c.source) {
                                        if (this.c.name in this.o.site.data.variables) {
                                            const v = yield this.o.site.data.get_variable(this.c.name, this.o.site.dataviews[this.o.view]);
                                            const i = row.time - v.time_range[this.o.parsed.dataset][0];
                                            return i < 0 ? NaN : row.entity.get_value(this.c.name, i);
                                        }
                                        else
                                            return NaN;
                                    }
                                    else
                                        return this.c.source in row.entity && this.c.name in row.entity[this.c.source]
                                            ? row.entity[this.c.source][this.c.name]
                                            : NaN;
                                });
                            }.bind({ o: this, c }),
                        });
                }
            }
            else {
                if (!time.is_single) {
                    this.header.push({
                        title: 'Year',
                        data: 'entity.time.value',
                        render: function (d, type, row) {
                            const t = row.time + row.offset;
                            return d && t >= 0 && t < d.length ? d[t] : NaN;
                        },
                    });
                }
                if (this.spec.features) {
                    if ('string' === typeof this.spec.features)
                        this.spec.features = [{ name: this.spec.features }];
                    this.spec.features.forEach(f => {
                        this.header.splice(0, 0, {
                            title: f.title || f.name,
                            data: 'entity.features.' + f.name.replace(this.site.patterns.all_periods, '\\.'),
                        });
                    });
                }
                this.header.push({
                    title: 'Variable',
                    data: function (row) {
                        return row.variable in row.entity.variables
                            ? row.entity.variables[row.variable].meta.short_name
                            : row.variable;
                    },
                });
                this.header.push({
                    title: 'Value',
                    data: this.site.data.get_value,
                    render: (d, type, row) => {
                        return d
                            ? 'number' === typeof d[row.time]
                                ? this.site.data.format_value(d[row.time], row.int)
                                : d[row.time]
                            : '';
                    },
                });
            }
            if (this.view) {
                this.site.add_dependency(this.view, { type: 'update', id: this.id });
                this.site.add_dependency(this.view + '_filter', { type: 'update', id: this.id });
                this.site.add_dependency(this.site.dataviews[this.view].time_agg, { type: 'update', id: this.id });
            }
            else
                this.view = this.site.defaults.dataview;
            const click_ref = this.e.dataset.click;
            if (click_ref in this.site.inputs) {
                this.clickto = this.site.inputs[click_ref];
                this.e.addEventListener('click', this.click);
            }
            this.queue_init();
        }
        show(e) {
            if (e.features && e.features.id in this.rows) {
                if (this.site.spec.settings.table_autoscroll) {
                    this.rows[e.features.id].scrollTo('smooth' === this.site.spec.settings.table_scroll_behavior);
                }
                if (this.pending > 0)
                    clearTimeout(this.pending);
                this.pending = -1;
                const row = this.rows[e.features.id].node();
                if (row) {
                    row.classList.add('highlighted');
                }
                else {
                    this.pending = setTimeout(function () {
                        const row = this.node();
                        if (row)
                            row.classList.add('highlighted');
                    }.bind(this.rows[e.features.id]), 0);
                }
            }
        }
        revert() {
            if (this.pending > 0)
                clearTimeout(this.pending);
            this.e.querySelectorAll('tr.highlighted').forEach(e => e.classList.remove('highlighted'));
        }
        queue_init() {
            const showing = this.deferred || !this.tab || this.tab.classList.contains('show');
            if (showing && 'jQuery' in window && 'DataTable' in window && 'get' in this.site.dataviews[this.view]) {
                this.spec.columns = this.header;
                this.table = $(this.e).DataTable(this.spec);
                this.update();
            }
            else {
                this.deferred = true;
                setTimeout(this.queue_init, showing ? 0 : 2000);
            }
        }
        update(pass) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.queue > 0)
                    clearTimeout(this.queue);
                this.queue = -1;
                if (!pass) {
                    if (!this.tab || this.tab.classList.contains('show'))
                        this.queue = setTimeout(() => this.update(true), 50);
                }
                else {
                    if (this.table) {
                        let vn = this.spec.variable_source &&
                            this.site.valueOf(this.spec.variable_source).replace(this.site.patterns.all_periods, '\\.');
                        const v = this.site.dataviews[this.view], d = v.get.dataset();
                        if (!this.site.data.inited[d])
                            return;
                        const settings = this.site.spec.settings, times = this.site.data.meta.times[d], state = d +
                            v.value() +
                            v.get.time_filters() +
                            settings.digits +
                            vn +
                            settings.theme_dark +
                            settings.show_empty_times, update = state !== this.state, time = this.site.valueOf(v.time_agg), variable = yield this.site.data.get_variable(vn, v);
                        this.parsed.time_range = variable ? variable.time_range[d] : times.info.time_range[d];
                        this.parsed.time = ('number' === typeof time ? time - times.range[0] : 0) - this.parsed.time_range[0];
                        if (update) {
                            this.rows = {};
                            this.rowIds = {};
                            this.table.clear();
                            if (v.valid[d]) {
                                this.state = state;
                                Object.keys(this.reference_options).forEach(k => (this.spec[k] = this.site.valueOf(this.reference_options[k])));
                                if (!Array.isArray(this.variables)) {
                                    this.parsed.time_index = {};
                                    this.parsed.dataset = d;
                                    this.parsed.color = vn;
                                    this.parsed.summary = this.view in variable.views ? variable.views[this.view].summaries[d] : undefined;
                                    this.parsed.order =
                                        this.view in variable.views ? variable.views[this.view].order[d][this.parsed.time] : undefined;
                                    if (this.header.length < 2 || d !== this.header[1].dataset || vn !== this.header[1].variable) {
                                        this.table.destroy();
                                        $(this.e).empty();
                                        this.header = [{ title: 'Name', data: 'entity.features.name', type: 'string' }];
                                        if (-1 !== this.parsed.time_range[0]) {
                                            for (let n = this.parsed.time_range[2]; n--;) {
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
                                                };
                                            }
                                        }
                                        else
                                            this.state = '';
                                        this.spec.order[0][0] = this.header.length - 1;
                                        this.spec.columns = this.header;
                                        this.table = $(this.e).DataTable(this.spec);
                                    }
                                    const n = this.header.length, ns = this.parsed.summary.n;
                                    let reset;
                                    for (let i = 1, show = false, nshowing = 0; i < n; i++) {
                                        show =
                                            v.times[i - 1 + this.parsed.time_range[0]] && (settings.show_empty_times || !!ns[i - 1]);
                                        this.table.column(i).visible(show, false);
                                        if (show) {
                                            this.parsed.time_index[times.value[i - 1 + this.parsed.time_range[0]]] = ++nshowing;
                                            reset = false;
                                        }
                                    }
                                    if (reset)
                                        this.state = '';
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
                                                    int: d in this.site.data.variables[vn].info &&
                                                        'integer' === this.site.data.variables[vn].info[d].type,
                                                });
                                                this.rowIds[this.rows[k].selector.rows] = k;
                                            }
                                        }
                                        else {
                                            for (let i = times.n; i--;) {
                                                this.rows[k] = this.table.row.add({
                                                    time: i,
                                                    entity: v.selection.all[k],
                                                });
                                                this.rowIds[this.rows[k].selector.rows] = k;
                                            }
                                        }
                                    });
                                }
                                else if (Array.isArray(this.variables)) {
                                    if (this.spec.filters)
                                        Object.keys(this.spec.filters).forEach(f => {
                                            this.current_filter[f] = this.site.valueOf(f);
                                        });
                                    const va = [];
                                    let varstate = '' + this.parsed.dataset + v.get.single_id() + v.get.features() + settings.digits;
                                    for (let i = this.variables.length; i--;) {
                                        vn = this.variables[i].name;
                                        pass = !this.spec.filters;
                                        const variable = yield this.site.data.get_variable(vn, v);
                                        if (vn in this.site.data.variables && 'meta' in variable) {
                                            if (this.spec.filters) {
                                                for (const c in this.current_filter)
                                                    if (c in variable.meta) {
                                                        pass = variable.meta[c] === this.current_filter[c];
                                                        if (!pass)
                                                            break;
                                                    }
                                            }
                                            else
                                                pass = true;
                                        }
                                        if (pass) {
                                            varstate += vn;
                                            va.push({
                                                variable: vn,
                                                int: this.site.patterns.int_types.test(this.site.data.variables[vn].type),
                                                time_range: variable.time_range[d],
                                                renderer: function (o, e) {
                                                    const k = e.features.id, r = this.time_range, n = r[1];
                                                    for (let i = r[0]; i <= n; i++) {
                                                        o.rows[k] = o.table.row.add({
                                                            offset: this.time_range[0],
                                                            time: i - this.time_range[0],
                                                            dataset: d,
                                                            variable: this.variable,
                                                            entity: e,
                                                            int: this.int,
                                                        });
                                                        o.rowIds[o.rows[k].selector.rows] = k;
                                                    }
                                                },
                                            });
                                        }
                                    }
                                    if (varstate === this.varstate)
                                        return;
                                    this.varstate = varstate;
                                    Object.keys(v.selection.all).forEach(k => {
                                        const e = v.selection.all[k];
                                        if (this.spec.single_variable) {
                                            if (vn in e.views[this.view].summary && variable.code in e.data) {
                                                this.rows[k] = this.table.row.add({
                                                    offset: this.parsed.time_range[0],
                                                    dataset: d,
                                                    variable: vn,
                                                    entity: e,
                                                    int: this.site.patterns.int_types.test(this.site.data.variables[vn].type),
                                                });
                                                this.rowIds[this.rows[k].selector.rows] = k;
                                            }
                                        }
                                        else {
                                            va.forEach(v => {
                                                if (this.site.data.variables[v.variable].code in e.data)
                                                    v.renderer(this, e);
                                            });
                                        }
                                    });
                                }
                            }
                            this.table.draw() ;
                        }
                        if (this.parsed.time > -1 && this.header.length > 1 && v.time_range.filtered_index) {
                            if (this.style.sheet.cssRules.length)
                                this.style.sheet.deleteRule(0);
                            if (this.parsed.time_index[time])
                                this.style.sheet.insertRule('#' +
                                    this.id +
                                    ' td:nth-child(' +
                                    (this.parsed.time_index[time] + 1) +
                                    '){background-color: var(--background-highlight)}', 0);
                            if (!update && this.site.spec.settings.table_autosort) {
                                this.table
                                    .column(this.parsed.time + 1)
                                    .order('dsc')
                                    .draw();
                            }
                            if (this.site.spec.settings.table_autoscroll) {
                                const w = this.e.parentElement.getBoundingClientRect().width, col = this.table.column(this.parsed.time + 1), h = col.header().getBoundingClientRect();
                                if (h)
                                    this.e.parentElement.scroll({
                                        left: h.x - this.e.getBoundingClientRect().x + h.width + 16 - w,
                                        behavior: this.site.spec.settings.table_scroll_behavior || 'smooth',
                                    });
                            }
                        }
                    }
                }
            });
        }
        mouseover(e) {
            if (e.target._DT_CellIndex && e.target._DT_CellIndex.row in this.rowIds) {
                const id = this.rowIds[e.target._DT_CellIndex.row], row = this.rows[id].node();
                if (row)
                    row.classList.add('highlighted');
                if (id in this.site.data.entities) {
                    this.site.subs.update(this.id, 'show', this.site.data.entities[id]);
                }
            }
        }
        mouseout(e) {
            if (e.target._DT_CellIndex && e.target._DT_CellIndex.row in this.rowIds) {
                const id = this.rowIds[e.target._DT_CellIndex.row], row = this.rows[id].node();
                if (row)
                    row.classList.remove('highlighted');
                if (id in this.site.data.entities) {
                    this.site.subs.update(this.id, 'revert', this.site.data.entities[id]);
                }
            }
        }
        click(e) {
            if (this.clickto && e.target._DT_CellIndex && e.target._DT_CellIndex.row in this.rowIds) {
                const id = this.rowIds[e.target._DT_CellIndex.row];
                if (id in this.site.data.entities)
                    this.clickto.set(id);
            }
        }
    }

    class OutputTable extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'table';
            this.parsed = {};
            this.queue = -1;
            this.state = '';
            this.reference_options = {};
            this.header = [];
            this.rows = {};
            this.parts = {
                head: document.createElement('thead'),
                body: document.createElement('tbody'),
            };
            this.current_variable = '';
            this.mouseover = this.mouseover.bind(this);
            this.mouseout = this.mouseout.bind(this);
            this.click = this.click.bind(this);
            this.parts.head.appendChild(document.createElement('tr'));
            e.appendChild(this.parts.head);
            e.appendChild(this.parts.body);
            Object.keys(this.spec).forEach(k => {
                const opt = this.spec[k];
                if ('string' === typeof opt && opt in site.inputs)
                    this.reference_options[k] = opt;
            });
            if ('string' === typeof this.spec.variables)
                this.spec.variable_source = this.spec.variables;
            e.addEventListener('mouseover', this.mouseover);
            e.addEventListener('mouseout', this.mouseout);
            if (this.tab) {
                document.getElementById(e.parentElement.getAttribute('aria-labelledby')).addEventListener('click', function () {
                    if (!e.parentElement.classList.contains('active')) {
                        setTimeout(this.update, 155);
                        setTimeout(this.site.page.trigger_resize, 155);
                    }
                }.bind(this));
            }
        }
        init() {
            if (this.spec.variable_source in this.site.inputs)
                this.site.add_dependency(this.spec.variable_source, { type: 'update', id: this.id });
            if (this.view) {
                this.site.add_dependency(this.view, { type: 'update', id: this.id });
                this.site.add_dependency(this.view + '_filter', { type: 'update', id: this.id });
                this.site.add_dependency(this.site.dataviews[this.view].time_agg, { type: 'update', id: this.id });
            }
            else
                this.view = this.site.defaults.dataview;
            const click_ref = this.e.dataset.click;
            if (click_ref in this.site.inputs) {
                if (this.e.dataset.click)
                    this.e.classList.add('interactive');
                this.clickto = this.site.inputs[click_ref];
                this.e.addEventListener('click', this.click);
            }
            this.update();
        }
        show(e) {
            if (e.features) {
                const row = this.rows[e.features.id];
                if (row && row.parentElement) {
                    row.classList.add('highlighted');
                    if (this.site.spec.settings.table_autoscroll) {
                        const h = this.e.parentElement.getBoundingClientRect().height, top = row.getBoundingClientRect().y - row.parentElement.getBoundingClientRect().y;
                        this.e.parentElement.scroll({
                            top: h > this.e.scrollHeight - top ? this.e.parentElement.scrollHeight : top,
                            behavior: this.site.spec.settings.table_scroll_behavior || 'smooth',
                        });
                    }
                }
            }
        }
        revert(e) {
            if (e.features && e.features.id in this.rows) {
                this.rows[e.features.id].classList.remove('highlighted');
            }
        }
        createHeader(v) {
            const dataset = this.parsed.dataset, time = this.site.data.meta.times[dataset], tr = this.parts.head.firstElementChild, range = this.parsed.variable.time_range[dataset], start = range[0], end = range[1] + 1, ns = this.parsed.summary.n;
            let th = document.createElement('th'), span = document.createElement('span');
            this.parsed.time_index = {};
            tr.innerHTML = '';
            tr.appendChild(th);
            th.appendChild(span);
            span.innerText = 'Name';
            for (let i = start, nshowing = 0; i < end; i++) {
                if (v.times[i] && (this.site.spec.settings.show_empty_times || ns[i - start])) {
                    this.parsed.time_index[time.value[i]] = nshowing++;
                    tr.appendChild((th = document.createElement('th')));
                    th.appendChild((span = document.createElement('span')));
                    span.innerText = time.value[i] + '';
                }
            }
        }
        appendRows(v) {
            const es = this.parsed.order, variable = this.parsed.variable, times = this.site.data.meta.times[this.parsed.dataset].value, range = variable.time_range[this.parsed.dataset], start = range[0], dn = range[1] - start + 1, selection = v.selection.all;
            this.current_variable = variable.code + this.parsed.dataset;
            this.parts.body.innerHTML = '';
            for (let n = es.length; n--;) {
                const id = es[n][0];
                if (id in selection) {
                    const e = this.site.data.entities[id], d = e.data[variable.code], tr = document.createElement('tr');
                    this.rows[id] = tr;
                    tr.dataset.entityId = id;
                    let td = document.createElement('td');
                    td.innerText = e.features.name;
                    tr.appendChild(td);
                    if (Array.isArray(d)) {
                        for (let i = 0; i < dn; i++) {
                            if (v.times[i + start] && times[i + start] in this.parsed.time_index) {
                                tr.appendChild((td = document.createElement('td')));
                                td.innerText = this.site.data.format_value(d[i]);
                                if (i === this.parsed.time)
                                    td.classList.add('highlighted');
                            }
                        }
                    }
                    else {
                        tr.appendChild((td = document.createElement('td')));
                        td.innerText = this.site.data.format_value(d);
                        td.dataset.entityId = id;
                        td.classList.add('highlighted');
                    }
                    this.parts.body.appendChild(tr);
                }
            }
            if (this.site.spec.settings.table_autoscroll &&
                this.parts.head.firstElementChild.childElementCount > 2 &&
                this.parts.head.firstElementChild.childElementCount > this.parsed.time + 1) {
                const w = this.e.parentElement.getBoundingClientRect().width, col = this.parts.head.firstElementChild.children[this.parsed.time + 1].getBoundingClientRect();
                this.e.parentElement.scroll({
                    left: col.x - this.e.getBoundingClientRect().x + col.width + 16 - w,
                    behavior: this.site.spec.settings.table_scroll_behavior || 'smooth',
                });
            }
        }
        update(pass) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.queue > 0)
                    clearTimeout(this.queue);
                this.queue = -1;
                if (!pass) {
                    if (!this.tab || this.tab.classList.contains('show'))
                        this.queue = setTimeout(() => this.update(true), 50);
                }
                else {
                    let vn = this.spec.variable_source &&
                        this.site.valueOf(this.spec.variable_source).replace(this.site.patterns.all_periods, '\\.');
                    const v = this.site.dataviews[this.view], d = v.get.dataset(), time = this.site.valueOf(v.time_agg), state = d +
                        v.value() +
                        v.get.time_filters() +
                        this.site.spec.settings.digits +
                        vn +
                        time +
                        this.site.spec.settings.show_empty_times;
                    if (!this.site.data.inited[d])
                        return;
                    if (state !== this.state) {
                        this.state = state;
                        Object.keys(this.reference_options).forEach(k => (this.spec[k] = this.site.valueOf(this.reference_options[k])));
                        const variable = yield this.site.data.get_variable(vn, v);
                        this.parsed.dataset = d;
                        this.parsed.color = vn;
                        this.parsed.variable = variable;
                        this.parsed.time_range = variable.time_range[d];
                        this.parsed.time =
                            ('number' === typeof time ? time - this.site.data.meta.times[d].range[0] : 0) - this.parsed.time_range[0];
                        this.parsed.summary = variable.views[this.view].summaries[d];
                        this.parsed.order = variable.views[this.view].order[d][this.parsed.time];
                        this.createHeader(v);
                        this.appendRows(v);
                    }
                }
            });
        }
        mouseover(e) {
            const target = e.target, row = 'TD' === target.tagName ? target.parentElement : target, id = row.dataset.entityId;
            if (id) {
                row.classList.add('highlighted');
                this.site.subs.update(this.id, 'show', this.site.data.entities[id]);
            }
        }
        mouseout(e) {
            const target = e.target, row = 'TD' === target.tagName ? target.parentElement : target, id = row.dataset.entityId;
            if (id) {
                row.classList.remove('highlighted');
                this.site.subs.update(this.id, 'revert', this.site.data.entities[id]);
            }
        }
        click(e) {
            const target = e.target, row = 'TD' === target.tagName ? target.parentElement : target, id = row.dataset.entityId;
            if (this.clickto && id)
                this.clickto.set(id);
        }
    }

    const summary_levels = {
        dataset: 'Overall',
        filtered: 'Filtered',
        children: 'Unfiltered selection',
        all: 'Selection',
    };
    class OutputLegend extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'legend';
            this.state = '';
            this.parsed = { time: 0, color: '', bins: 0, rank: false };
            this.queue = {
                lock: false,
                cooldown: -1,
                reset: function () {
                    this.lock = false;
                },
            };
            this.integer = false;
            this.ticks = {
                center: document.createElement('div'),
                min: document.createElement('div'),
                max: document.createElement('div'),
                entity: document.createElement('div'),
            };
            this.current_palette = '';
            this.mouseover = this.mouseover.bind(this);
            this.mouseout = this.mouseout.bind(this);
            this.click = this.click.bind(this);
            this.update = this.update.bind(this);
            e.addEventListener('mousemove', this.mouseover);
            e.addEventListener('mouseout', this.mouseout);
            e.addEventListener('click', this.click);
            this.variable = this.e.dataset.variable;
            this.queue.trigger = function () {
                this.mouseover(this.queue.e);
            }.bind(this);
            this.queue.reset = this.queue.reset.bind(this.queue);
            this.parts = {
                ticks: this.e.querySelector('.legend-ticks'),
                scale: this.e.querySelector('.legend-scale'),
                summary: this.e.querySelector('.legend-summary'),
            };
            this.parts.ticks.dataset.of = this.parts.scale.dataset.of = this.parts.summary.dataset.of = this.id;
            this.parts.summary.appendChild(this.ticks.center);
            this.parts.summary.appendChild(this.ticks.min);
            this.parts.summary.appendChild(this.ticks.max);
            this.parts.ticks.appendChild(this.ticks.entity);
        }
        init() {
            this.site.add_dependency(this.view, { type: 'update', id: this.id });
            const view = this.site.dataviews[this.view];
            if ('string' === typeof view.time_agg && view.time_agg in this.site.inputs)
                this.site.add_dependency(view.time_agg, { type: 'update', id: this.id });
            if (!this.palette) {
                if (view.palette) {
                    this.palette = view.palette;
                    if (view.palette in this.site.inputs)
                        this.site.add_dependency(view.palette, { type: 'update', id: this.id });
                }
                else {
                    this.palette =
                        'settings.palette' in this.site.inputs ? 'settings.palette' : this.site.spec.settings.palette;
                }
            }
            if (this.variable) {
                if (this.variable in this.site.inputs)
                    this.site.add_dependency(this.variable, { type: 'update', id: this.id });
            }
            else if (view.y in this.site.inputs)
                this.site.add_dependency(view.y, { type: 'update', id: this.id });
            if (this.palette in this.site.inputs) {
                const palette = this.site.inputs[this.palette];
                if (palette.e) {
                    palette.e.addEventListener('change', this.update);
                }
            }
            const click_ref = this.e.dataset.click;
            if (click_ref in this.site.inputs)
                this.clickto = this.site.inputs[click_ref];
            Object.keys(this.ticks).forEach((t) => {
                const div = document.createElement('div');
                let p = document.createElement('p');
                this.ticks[t].dataset.of = this.id;
                this.ticks[t].className = 'legend-tick';
                this.ticks[t].appendChild(div);
                div.dataset.of = p.dataset.of = this.id;
                div.appendChild(p);
                if ('m' !== t.substring(0, 1)) {
                    div.appendChild((p = document.createElement('p')));
                    p.dataset.of = this.id;
                    div.appendChild((p = document.createElement('p')));
                    p.dataset.of = this.id;
                    if ('entity' === t) {
                        this.ticks[t].firstElementChild.lastElementChild.classList.add('entity');
                    }
                    else {
                        this.ticks[t].firstElementChild.firstElementChild.classList.add('summary');
                    }
                }
            });
            this.ticks.entity.firstElementChild.classList.add('hidden');
            this.ticks.max.className = 'legend-tick-end max';
            this.ticks.min.className = 'legend-tick-end min';
            this.ticks.center.style.left = '50%';
            this.update();
        }
        show(e) {
            if (e && e.features.name) {
                const view = this.site.dataviews[this.view], summary = this.parsed.summary, time = this.parsed.time, color = this.parsed.color, string = summary && 'string' === summary.type, min = summary && !string ? summary.min[time] : 0, range = summary ? (string ? summary.levels.length - min : summary.range[time]) : 1, n = summary.n[time], subset = n === view.n_selected.dataset ? 'rank' : 'subset_rank', es = this.site.data.entities[e.features.id].views[this.view], value = e.get_value(color, time), p = ((string ? value in summary.level_ids : 'number' === typeof value)
                    ? this.site.spec.settings.color_by_order
                        ? NaN
                        : Math.max(0, Math.min(1, range ? ((string ? summary.level_ids[value] : value) - min) / range : 0.5))
                    : NaN) * 100, container = this.ticks.entity, t = container.firstElementChild.children[1];
                if (isFinite(p)) {
                    t.parentElement.classList.remove('hidden');
                    t.innerText = this.site.data.format_value(value, this.integer);
                    container.style.left = p + '%';
                    container.firstElementChild.firstElementChild.innerText =
                        (p > 96 || p < 4) && e.features.name.length > 13 ? e.features.name.substring(0, 12) + '…' : e.features.name;
                }
                else if (this.site.spec.settings.color_by_order && color in es[subset]) {
                    const i = es[subset][color][time], po = n > 1 ? (i / (n - 1)) * 100 : 0;
                    container.firstElementChild.firstElementChild.innerText =
                        i > -1 && (po > 96 || po < 4) && e.features.name.length > 13
                            ? e.features.name.substring(0, 12) + '…'
                            : e.features.name;
                    if (i > -1) {
                        t.parentElement.classList.remove('hidden');
                        t.innerText = '# ' + (n - i);
                        container.style.left = po + '%';
                    }
                }
                container.style.marginLeft = -container.getBoundingClientRect().width / 2 + 'px';
            }
        }
        revert() {
            this.ticks.entity.firstElementChild.classList.add('hidden');
        }
        update() {
            return __awaiter(this, void 0, void 0, function* () {
                const view = this.site.dataviews[this.view], variable = this.site.valueOf(this.variable || view.y), d = view.get.dataset(), var_info = yield this.site.data.get_variable(variable, view), time = this.site.valueOf(view.time_agg), palettes = this.site.palettes;
                if (null !== time && view.valid[d] && var_info && this.view in var_info.views) {
                    const y = ('number' === typeof time ? time - this.site.data.meta.times[d].range[0] : 0) - var_info.time_range[d][0], summary = var_info.views[this.view].summaries[d], ep = this.site.valueOf(this.palette).toLowerCase(), pn = ep in palettes
                        ? ep
                        : this.site.spec.settings.palette in palettes
                            ? this.site.spec.settings.palette
                            : this.site.defaults.palette, p = palettes[pn], nc = p.colors.length, s = this.parts.scale, ticks = this.ticks;
                    this.parsed.summary = summary;
                    this.parsed.order = var_info.views[this.view].order[d][y];
                    this.parsed.time = y;
                    this.parsed.color = variable;
                    if (summary && y < summary.n.length) {
                        this.integer = d in var_info.info && 'integer' === var_info.info[d].type;
                        const refresh = this.site.spec.settings.color_by_order !== this.parsed.rank, bins = s.querySelectorAll('span'), odd = p.odd, remake = 'discrete' === p.type
                            ? !bins.length || nc !== this.parsed.bins
                            : !s.firstElementChild || 'SPAN' !== s.firstElementChild.tagName;
                        this.parsed.bins = nc;
                        if (pn + this.site.spec.settings.color_scale_center !== this.current_palette || refresh) {
                            this.current_palette = pn + this.site.spec.settings.color_scale_center;
                            this.parsed.rank = this.site.spec.settings.color_by_order;
                            if (remake)
                                s.innerHTML = '';
                            if ('discrete' === p.type) {
                                const n = Math.ceil(nc / 2);
                                let i = 0, div = document.createElement('div'), span;
                                if (remake) {
                                    s.appendChild(div);
                                    div.dataset.of = this.id;
                                    div.style.left = '0';
                                    const prop = (1 / (n - odd / 2)) * 100 + '%';
                                    for (; i < n; i++) {
                                        div.appendChild((span = document.createElement('span')));
                                        span.dataset.of = this.id;
                                        span.style.backgroundColor = p.colors[i];
                                        span.style.width = prop;
                                    }
                                    if (odd)
                                        span.style.width = ((1 / (n - odd / 2)) * 100) / 2 + '%';
                                    s.appendChild((div = document.createElement('div')));
                                    div.dataset.of = this.id;
                                    div.style.right = '0';
                                    for (i = Math.floor(nc / 2); i < nc; i++) {
                                        div.appendChild((span = document.createElement('span')));
                                        span.dataset.of = this.id;
                                        span.style.backgroundColor = p.colors[i];
                                        span.style.width = prop;
                                    }
                                    if (odd)
                                        div.firstElementChild.style.width =
                                            ((1 / (Math.ceil(nc / 2) - odd / 2)) * 100) / 2 + '%';
                                }
                                else {
                                    for (; i < n; i++) {
                                        bins[i].style.backgroundColor = p.colors[i];
                                    }
                                    for (i = Math.floor(nc / 2); i < nc; i++) {
                                        bins[i + odd].style.backgroundColor = p.colors[i];
                                    }
                                }
                            }
                            else if ('continuous-polynomial' !== p.type) {
                                if (remake) {
                                    s.appendChild(document.createElement('span'));
                                    s.appendChild(document.createElement('span'));
                                }
                                s.firstElementChild.style.background =
                                    'linear-gradient(0.25turn, rgb(' +
                                        p.colors[2][0][0] +
                                        ', ' +
                                        p.colors[2][0][1] +
                                        ', ' +
                                        p.colors[2][0][2] +
                                        '), rgb(' +
                                        p.colors[1][0] +
                                        ', ' +
                                        p.colors[1][1] +
                                        ', ' +
                                        p.colors[1][2] +
                                        '))';
                                s.lastElementChild.style.background =
                                    'linear-gradient(0.25turn, rgb(' +
                                        p.colors[1][0] +
                                        ', ' +
                                        p.colors[1][1] +
                                        ', ' +
                                        p.colors[1][2] +
                                        '), rgb(' +
                                        p.colors[0][0][0] +
                                        ', ' +
                                        p.colors[0][0][1] +
                                        ', ' +
                                        p.colors[0][0][2] +
                                        '))';
                            }
                        }
                        const center = this.site.spec.settings.color_scale_center;
                        if ('string' === var_info.type) {
                            ticks.center.classList.remove('hidden');
                            ticks.min.firstElementChild.firstElementChild.innerText = var_info.levels[0];
                            ticks.max.firstElementChild.firstElementChild.innerText =
                                var_info.levels[var_info.levels.length - 1];
                        }
                        else if (this.site.spec.settings.color_by_order) {
                            ticks.center.classList.add('hidden');
                            ticks.min.firstElementChild.firstElementChild.innerText =
                                '# ' + (summary.n[y] ? summary.n[y] : 0);
                            ticks.max.firstElementChild.firstElementChild.innerText = '# ' + (summary.n[y] ? 1 : 0);
                        }
                        else {
                            const state = '' +
                                summary.n[y] +
                                summary.min[y] +
                                summary.max[y] +
                                this.site.spec.settings.digits +
                                center +
                                this.site.spec.settings.summary_selection;
                            if (remake || refresh || state !== this.state) {
                                this.state = state;
                                ticks.center.classList.remove('hidden');
                                ticks.min.firstElementChild.firstElementChild.innerText =
                                    (summary.n[y]
                                        ? isFinite(summary.min[y])
                                            ? this.site.data.format_value(summary.min[y], this.integer)
                                            : NaN
                                        : NaN) + '';
                                ticks.max.firstElementChild.firstElementChild.innerText =
                                    (summary.n[y]
                                        ? isFinite(summary.max[y])
                                            ? this.site.data.format_value(summary.max[y], this.integer)
                                            : NaN
                                        : NaN) + '';
                                if ('none' === center) {
                                    ticks.center.firstElementChild.lastElementChild.innerText =
                                        summary_levels[this.site.spec.settings.summary_selection] + ' median';
                                    ticks.center.firstElementChild.children[1].innerText = this.site.data.format_value(summary.median[y]);
                                    ticks.center.style.left = summary.norm_median[y] * 100 + '%';
                                }
                                else {
                                    ticks.center.firstElementChild.lastElementChild.innerText =
                                        summary_levels[this.site.spec.settings.summary_selection] + ' ' + center;
                                    ticks.center.firstElementChild.children[1].innerText = this.site.data.format_value(summary[center][y]);
                                    ticks.center.style.left = summary[('norm_' + center)][y] * 100 + '%';
                                }
                                ticks.center.style.marginLeft = -ticks.center.getBoundingClientRect().width / 2 + 'px';
                            }
                        }
                        if (this.site.spec.settings.color_by_order || 'none' === center) {
                            s.firstElementChild.style.width = '50%';
                            s.lastElementChild.style.width = '50%';
                        }
                        else {
                            s.firstElementChild.style.width = summary[('norm_' + center)][y] * 100 + '%';
                            s.lastElementChild.style.width =
                                100 - summary[('norm_' + center)][y] * 100 + '%';
                        }
                    }
                }
            });
        }
        mouseover(e) {
            if (!this.queue.lock && 'clientX' in e) {
                this.queue.lock = true;
                const s = this.parts.scale.getBoundingClientRect(), p = (Math.max(s.x, Math.min(s.x + s.width, e.clientX)) - s.x) / s.width;
                let entity;
                if (this.site.spec.settings.color_by_order) {
                    if (this.parsed.order && this.parsed.order.length)
                        entity =
                            this.site.data.entities[this.parsed.order[Math.max(this.parsed.summary.missing[this.parsed.time], Math.min(this.parsed.order.length - 1, Math.floor((this.parsed.order.length - 1) * p)))][0]];
                }
                else if ('min' in this.parsed.summary) {
                    const min = this.parsed.summary.min[this.parsed.time], max = this.parsed.summary.max[this.parsed.time], tv = min + p * (max - min);
                    let i, n;
                    if (this.parsed.order && this.parsed.order.length) {
                        n = this.parsed.summary.missing[this.parsed.time];
                        if (n < this.parsed.order.length) {
                            if (1 === this.parsed.order.length || !p) {
                                entity = this.site.data.entities[this.parsed.order[n][0]];
                            }
                            else {
                                for (i = this.parsed.order.length - 2; i >= n; --i) {
                                    if ((this.parsed.order[i][1] + this.parsed.order[i + 1][1]) / 2 <= tv)
                                        break;
                                }
                                i++;
                                entity = this.site.data.entities[this.parsed.order[i][0]];
                            }
                        }
                    }
                }
                if (entity) {
                    this.show(entity);
                    if (!this.entity || entity.features.id !== this.entity.features.id) {
                        if (!this.entity) {
                            this.entity = entity;
                        }
                        else
                            this.site.subs.update(this.id, 'revert', this.entity);
                        this.site.subs.update(this.id, 'show', entity);
                        this.entity = entity;
                    }
                }
                setTimeout(this.queue.reset, 200);
            }
            else {
                if (this.queue.cooldown > 0)
                    clearTimeout(this.queue.cooldown);
                this.queue.e = e;
                this.queue.cooldown = setTimeout(this.queue.trigger, 100);
            }
        }
        mouseout(e) {
            const target = e.relatedTarget;
            if (target && this.id !== target.dataset.of) {
                if (this.queue.cooldown > 0)
                    clearTimeout(this.queue.cooldown);
                this.queue.cooldown = -1;
                this.revert();
                if (this.entity) {
                    this.site.subs.update(this.id, 'revert', this.entity);
                    this.entity = undefined;
                }
            }
        }
        click() {
            if (this.clickto && this.entity) {
                this.revert();
                this.clickto.set(this.entity.features.id);
            }
        }
    }

    class OutputText extends BaseOutput {
        constructor(e, site) {
            super(e, site);
            this.type = 'text';
            this.depends = new Map();
            this.update = this.update.bind(this);
            this.prep = this.prep.bind(this);
            this.text = this.spec.text;
            this.condition = this.spec.condition || [];
        }
        init() {
            this.text.forEach(oi => {
                if (Array.isArray(oi)) {
                    this.e.appendChild(document.createElement('span'));
                    oi.forEach(this.prep);
                }
                else {
                    this.prep(oi);
                    this.e.appendChild(oi.parts);
                }
            });
            this.condition.forEach(c => {
                if (c.id in this.site.inputs)
                    this.site.add_dependency(c.id, { type: 'display', id: this.id });
            });
            this.depends.forEach(d => this.site.add_dependency(d.id, { type: 'update', id: this.id }));
            this.update();
        }
        update() {
            this.depends.forEach(d => {
                d.parsed = this.site.valueOf(d.id);
                const u = this.site.inputs[d.id];
                if (u) {
                    if ('values' in u && 'options' in u && !Array.isArray(u.values) && d.parsed in u.values) {
                        d.parsed = u.options[u.values[d.parsed]].innerText;
                    }
                    else {
                        d.parsed =
                            'display' in u && d.parsed in u.display
                                ? u.display[d.parsed]
                                : this.site.data.format_label(d.parsed);
                    }
                }
            });
            this.text.forEach((o, i) => {
                let pass = true, s;
                if (Array.isArray(o)) {
                    for (let t = o.length; t--;) {
                        if ('condition' in o[t]) {
                            for (let c = o[t].condition.length; c--;) {
                                pass = o[t].condition[c].check();
                                if (!pass)
                                    break;
                            }
                        }
                        if (pass) {
                            s = o[t];
                            break;
                        }
                    }
                }
                else {
                    if ('condition' in o) {
                        for (let t = o.condition.length; t--;) {
                            pass = o.condition[t].check();
                            if (!pass)
                                break;
                        }
                    }
                    if (pass)
                        s = o;
                }
                if (pass) {
                    s.text.forEach((k, i) => {
                        if (Array.isArray(k)) {
                            k.forEach(ki => {
                                if ('default' === ki.id ||
                                    DataHandler.checks[ki.type](this.site.valueOf(ki.id), this.site.valueOf(ki.value)))
                                    k = ki.text;
                            });
                        }
                        if (this.depends.has(k)) {
                            s.parts.children[i].innerText = this.depends.get(k).parsed;
                        }
                        else if (k in s.button) {
                            let text = '';
                            s.button[k].text.forEach(b => {
                                text = (this.depends.has(b) ? this.depends.get(b).parsed : b) + text;
                            });
                            s.parts.children[i].innerText = text;
                        }
                        else
                            s.parts.children[i].innerText = k;
                    });
                    if (Array.isArray(this.text[i])) {
                        this.e.children[i].innerHTML = '';
                        this.e.children[i].appendChild(s.parts);
                    }
                    else
                        s.parts.classList.remove('hidden');
                }
                else {
                    if (Array.isArray(o)) {
                        o.forEach(p => p.parts.classList.add('hidden'));
                    }
                    else {
                        o.parts.classList.add('hidden');
                    }
                }
            });
        }
        prep(text) {
            if (!('button' in text))
                text.button = {};
            if ('string' === typeof text.text)
                text.text = [text.text];
            text.parts = document.createElement('span');
            text.text.forEach(k => {
                if (k in text.button) {
                    const p = text.button[k], button = document.createElement('button');
                    text.parts.appendChild(button);
                    button.type = 'button';
                    p.trigger = tooltip_trigger.bind({ id: this.id + p.text, note: p.target, wrapper: button });
                    if ('note' === p.type) {
                        button.setAttribute('aria-description', p.target);
                        button.dataset.of = this.id + p.text;
                        button.className = 'has-note';
                        button.addEventListener('mouseover', p.trigger);
                        button.addEventListener('focus', p.trigger);
                        button.addEventListener('blur', this.site.page.tooltip_clear);
                    }
                    else {
                        button.className = 'btn btn-link';
                        if (!Array.isArray(p.target))
                            p.target = [p.target];
                        const m = new Map();
                        p.target.forEach(t => {
                            const u = this.site.inputs[t], k = p.type;
                            if (u && 'function' === typeof u[k])
                                m.set(t, u[k]);
                        });
                        if (m.size) {
                            button.setAttribute('aria-label', p.text.join(''));
                            button.addEventListener('click', function () {
                                this.forEach(f => f());
                            }.bind(m));
                        }
                    }
                }
                else {
                    text.parts.appendChild(document.createElement('span'));
                }
                if (k in this.site.inputs)
                    this.depends.set(k, { id: k, parsed: '' });
            });
            if ('condition' in text) {
                for (let i = text.condition.length; i--;) {
                    const c = text.condition[i];
                    if (c.id) {
                        if ('default' === c.id) {
                            c.check = function () {
                                return true;
                            };
                        }
                        else {
                            this.depends.set(c.id, c);
                            c.site = this.site;
                            c.check = function () {
                                return ('default' === this.id ||
                                    DataHandler.checks[this.type](this.site.valueOf(this.id), this.site.valueOf(this.value)));
                            }.bind(c);
                        }
                    }
                }
            }
        }
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
    };
    const outputs = {
        info: OutputInfo,
        map: OutputMap,
        plotly: OutputPlotly,
        datatable: OutputDataTable,
        table: OutputTable,
        legend: OutputLegend,
        text: OutputText,
    };
    class Community {
        constructor(spec) {
            this.storage = storage;
            this.patterns = patterns;
            this.palettes = palettes;
            this.conditionals = {};
            this.registered_inputs = new Map();
            this.registered_outputs = new Map();
            this.defaults = defaults;
            this.dataviews = {};
            this.inputs = {};
            this.outputs = {};
            this.dependencies = {};
            this.url_options = {};
            this.queue = { timeout: 0, elements: new Map() };
            this.tree = {};
            this.maps = {
                queue: {},
                waiting: {},
                overlay_property_selectors: [],
            };
            this.meta = {
                retain_state: true,
                lock_after: '',
            };
            this.state = '';
            this.query = '';
            this.parsed_query = {};
            this.rule_conditions = {};
            if (spec) {
                this.spec = spec;
                spec.active = this;
            }
            if (!spec.settings)
                spec.settings = {};
            if (!('dataLayer' in window))
                window.dataLayer = [];
            storage.copy = storage.get();
            if (storage.copy)
                for (const k in spec.settings) {
                    if (k in storage.copy) {
                        let c = storage.copy[k];
                        if ('string' === typeof c) {
                            if (patterns.bool.test(c)) {
                                c = !!c || 'true' === c;
                            }
                            else if (patterns.number.test(c))
                                c = parseFloat(c);
                        }
                        spec.settings[k] = c;
                    }
                }
            function poly_channel(ch, pos, coefs) {
                const n = coefs.length;
                let v = coefs[0][ch] + pos * coefs[1][ch], i = 2;
                for (; i < n; i++) {
                    v += Math.pow(pos, i) * coefs[i][ch];
                }
                return Math.max(0, Math.min(255, v));
            }
            Object.keys(palettes).forEach(k => {
                const n = 255;
                let p = palettes[k];
                if ('continuous-polynomial' === p.type) {
                    const c = p.colors, r = { name: k, type: 'discrete', colors: [] };
                    for (let i = 0; i < n; i++) {
                        const v = i / n;
                        r.colors.push('rgb(' + poly_channel(0, v, c) + ', ' + poly_channel(1, v, c) + ', ' + poly_channel(2, v, c) + ')');
                    }
                    p = palettes[k] = r;
                }
                p.odd = p.colors.length % 2;
            });
            this.query = window.location.search.replace('?', '');
            if (this.query) {
                this.query.split('&').forEach(a => {
                    const c = a.split('='); c[0];
                    let v;
                    if (c.length < 2)
                        c.push('true');
                    v = patterns.bool.test(c[1]) ? !!c[1] || 'true' === c[1] : c[1].replace(patterns.url_spaces, ' ');
                    this.url_options[c[0]] = v;
                    if (patterns.settings.test(c[0]))
                        storage.set(c[0].replace(patterns.settings, ''), v);
                });
            }
            if ('embedded' in this.url_options || 'hide_navbar' in this.url_options) {
                if (!('hide_logo' in this.url_options))
                    this.url_options.hide_logo = true;
                if (!('hide_title' in this.url_options))
                    this.url_options.hide_title = true;
                if (!('hide_navcontent' in this.url_options))
                    this.url_options.hide_navcontent = true;
                if (!('hide_panels' in this.url_options))
                    this.url_options.hide_panels = true;
                if ('embedded' in this.url_options && !('close_menus' in this.url_options))
                    this.url_options.close_menus = true;
            }
            this.init = this.init.bind(this);
            this.request_queue = this.request_queue.bind(this);
            this.run_queue = this.run_queue.bind(this);
            this.global_reset = this.global_reset.bind(this);
            Object.keys(conditionals).forEach((k) => (this.conditionals[k] = conditionals[k].bind(this)));
            if (this.spec.dataviews) {
                this.defaults.dataview = Object.keys(this.spec.dataviews)[0];
            }
            else {
                this.spec.dataviews = {};
                this.spec.dataviews[this.defaults.dataview] = {};
            }
            if (!this.maps.overlay_property_selectors)
                this.maps.overlay_property_selectors = [];
            this.view = new GlobalView(this);
            new Page(this);
            document.querySelectorAll('.auto-input').forEach((e) => {
                if (e.dataset.autotype in inputs && !(e.id in this.inputs)) {
                    const u = new inputs[e.dataset.autotype](e, this);
                    this.registered_inputs.set(u.id, u);
                    this.inputs[u.id] = u;
                }
            });
            this.subs = new Subscriptions(this);
            document.querySelectorAll('.auto-output').forEach((e) => {
                if (e.dataset.autotype in outputs && !(e.id in this.outputs)) {
                    const u = new outputs[e.dataset.autotype](e, this);
                    this.registered_outputs.set(u.id, u);
                    this.outputs[u.id] = u;
                    const opt = 'options' in u ? u.options : u.spec;
                    if ('subto' in opt) {
                        if ('string' === typeof opt.subto)
                            opt.subto = [opt.subto];
                        if (Array.isArray(opt.subto))
                            opt.subto.forEach(v => this.subs.add(v, u));
                    }
                }
            });
            if (spec.variables && spec.variables.length)
                spec.variables.forEach(v => {
                    const u = new InputVirtual(v, this);
                    this.registered_inputs.set(v.id, u);
                    this.inputs[v.id] = u;
                });
            this.defaults.dataset = this.spec.dataviews[defaults.dataview].dataset;
            if (!this.spec.metadata)
                this.spec.metadata = { datasets: [] };
            const sets = this.spec.metadata.datasets;
            if (sets && sets.length && -1 === sets.indexOf(this.defaults.dataset)) {
                if (1 === sets.length) {
                    this.defaults.dataset = sets[0];
                }
                else {
                    this.registered_inputs.forEach(u => {
                        if (!this.defaults.dataset) {
                            const d = u.default;
                            if (-1 !== sets.indexOf(u.dataset)) {
                                this.defaults.dataset = u.dataset;
                            }
                            else if ('string' === typeof d && -1 !== sets.indexOf(d)) {
                                this.defaults.dataset = d;
                            }
                            else if ('select' === u.type &&
                                'number' === typeof d &&
                                u.options[d] &&
                                -1 !== sets.indexOf(u.options[d].value)) {
                                this.defaults.dataset = u.options[d].value;
                            }
                            else if (('select' === u.type || 'combobox' === u.type) &&
                                Array.isArray(u.values) &&
                                u.values[u.default] &&
                                -1 !== sets.indexOf(u.values[u.default])) {
                                this.defaults.dataset = u.values[u.default];
                            }
                        }
                    });
                    if (!this.defaults.dataset)
                        this.defaults.dataset = sets[sets.length - 1];
                }
                this.defaults.dataset = this.valueOf(this.defaults.dataset);
                if (-1 === sets.indexOf(this.defaults.dataset))
                    this.defaults.dataset = sets[0];
                this.registered_inputs.forEach(u => {
                    if (!u.dataset)
                        u.dataset = this.defaults.dataset;
                });
                if (!this.spec.dataviews[defaults.dataview].dataset)
                    this.spec.dataviews[defaults.dataview].dataset = this.defaults.dataset;
            }
            if (spec.rules && spec.rules.length) {
                spec.rules.forEach((r, i) => {
                    r.parsed = {};
                    if ('display' in r.effects) {
                        r.parsed.display = { e: document.getElementById(r.effects.display) };
                        const e = r.parsed.display.e.querySelector('.auto-input');
                        if (e) {
                            const u = this.inputs[e.id];
                            u.rule = r;
                            r.parsed.display.u = u;
                        }
                    }
                    if ('lock' in r.effects) {
                        const us = new Map();
                        document.querySelectorAll('#' + r.effects.lock + ' .auto-input').forEach(e => us.set(e.id, this.inputs[e.id]));
                        r.parsed.lock = us;
                    }
                    r.condition.forEach(c => {
                        if (c.type in DataHandler.checks) {
                            c.check = function () {
                                return DataHandler.checks[this.c.type](this.site.valueOf(this.c.id), this.site.valueOf(this.c.value));
                            }.bind({ c, site: this });
                            if (c.id in this.inputs) {
                                this.add_dependency(c.id, { type: 'rule', id: c.id, condition: c, rule: i });
                                if (!(c.id in this.rule_conditions))
                                    this.rule_conditions[c.id] = [];
                                this.rule_conditions[c.id][i] = r;
                            }
                            if (c.check()) {
                                Object.keys(r.effects).forEach(k => {
                                    if (k in this.inputs)
                                        this.inputs[k].set(this.valueOf(r.effects[k]));
                                });
                            }
                            else if (c.default) {
                                Object.keys(r.effects).forEach(k => {
                                    if (k in this.inputs)
                                        this.inputs[k].set(this.valueOf(c.default));
                                });
                            }
                        }
                    });
                });
            }
            const dataset = this.valueOf(this.spec.dataviews[this.defaults.dataview].dataset);
            this.defaults.dataset = 'number' === typeof dataset ? sets[dataset] : dataset;
            if (-1 === sets.indexOf(this.defaults.dataset))
                this.defaults.dataset = sets[0];
            this.data = new DataHandler(this.spec, this.defaults, this.data, {
                init: this.init,
                onload: function () {
                    if (this.data.inited)
                        clearTimeout(this.data.inited.load_screen);
                    setTimeout(this.drop_load_screen.bind(this), 600);
                    delete this.data.onload;
                }.bind(this),
                data_load: function () {
                    Object.keys(this.dependencies).forEach(k => this.request_queue(false, k));
                }.bind(this),
            });
        }
        init() {
            if (this.data.variables) {
                const variable = Object.keys(this.data.variables);
                this.defaults.variable = variable[variable.length - 1];
            }
            Object.keys(this.spec.dataviews).forEach(id => new SiteDataView(this, id, this.spec.dataviews[id]));
            this.view.init();
            this.page.init();
            if (this.query) {
                this.parsed_query = this.data.parse_query(this.query);
                if (this.parsed_query.variables.conditions.length) {
                    this.parsed_query.variables.conditions.forEach(f => {
                        const info = this.data.variable_info[f.name];
                        if (info)
                            this.page.add_filter_condition(f.name, f);
                    });
                }
            }
            this.run_queue();
            this.registered_inputs.forEach((o) => __awaiter(this, void 0, void 0, function* () {
                const combobox = 'combobox' === o.type;
                if (o.optionSource && 'options' in o) {
                    if (patterns.palette.test(o.optionSource)) {
                        o.options = [];
                        Object.keys(palettes).forEach(v => o.add(v, palettes[v].name));
                        if (-1 === o.default)
                            o.default = defaults.palette;
                    }
                    else if (patterns.datasets.test(o.optionSource)) {
                        if (-1 === o.default)
                            o.default = defaults.dataset;
                        o.options = [];
                        this.spec.metadata.datasets.forEach(d => o.add(d));
                    }
                    else if ('option_sets' in o) {
                        o.sensitive = false;
                        if (patterns.properties.test(o.optionSource)) {
                            this.maps.overlay_property_selectors.push(o);
                        }
                        if (o.depends)
                            this.add_dependency(o.depends, { type: 'options', id: o.id });
                        if (o.dataset in this.inputs)
                            this.add_dependency(o.dataset, { type: 'options', id: o.id });
                        if (o.view)
                            this.add_dependency(o.view, { type: 'options', id: o.id });
                        const v = this.valueOf(o.dataset) || defaults.dataset;
                        if ('string' === typeof v) {
                            if (!o.dataset)
                                o.dataset = v;
                            if (v in this.data.info)
                                this.conditionals.options(o);
                        }
                    }
                }
                if (combobox || 'select' === o.type) {
                    // resolve options
                    if (Array.isArray(o.values)) {
                        o.values = {};
                        o.display = {};
                        let new_display = true;
                        const select = 'select' === o.type;
                        o.options.forEach(e => {
                            if (select)
                                e.dataset.value = e.value;
                            if (new_display)
                                new_display = e.dataset.value === e.innerText;
                        });
                        o.options.forEach((e, i) => {
                            o.values[e.dataset.value] = i;
                            if (new_display)
                                e.innerText = this.data.format_label(e.dataset.value);
                            o.display[e.innerText] = i;
                        });
                        if (!(o.default in o.values) && !(o.default in this.inputs)) {
                            o.default = +o.default;
                            if (isNaN(o.default))
                                o.default = -1;
                            if (-1 !== o.default && o.default < o.options.length) {
                                o.default = o.options[o.default].dataset.value;
                            }
                            else {
                                o.default = -1;
                            }
                        }
                        o.source = '';
                        o.id in this.url_options ? o.set(this.url_options[o.id]) : o.reset();
                    }
                    o.subset = o.e.dataset.subset || 'all';
                    o.selection_subset = o.e.dataset.selectionSubset || o.subset;
                    if (o.type in this.spec && o.id in this.spec[o.type]) {
                        o.settings = this.spec[o.type][o.id];
                        if (o.settings.filters) {
                            Object.keys(o.settings.filters).forEach(f => {
                                this.add_dependency(o.settings.filters[f], { type: 'filter', id: o.id });
                            });
                        }
                    }
                }
                else if ('number' === o.type) {
                    // retrieve option values
                    o.min = o.e.getAttribute('min');
                    o.min_ref = parseFloat(o.min);
                    o.min_indicator = o.e.parentElement.parentElement.querySelector('.indicator-min');
                    if (o.min_indicator) {
                        o.min_indicator.addEventListener('click', function () {
                            this.set(this.parsed.min);
                        }.bind(o));
                    }
                    o.max = o.e.getAttribute('max');
                    o.max_ref = parseFloat(o.max);
                    o.max_indicator = o.e.parentElement.parentElement.querySelector('.indicator-max');
                    if (o.max_indicator) {
                        o.max_indicator.addEventListener('click', function () {
                            this.set(this.parsed.max);
                        }.bind(o));
                    }
                    o.ref = isNaN(o.min_ref) || isNaN(o.max_ref);
                    o.range = [o.min_ref, o.max_ref];
                    o.step = parseFloat(o.e.step) || 1;
                    o.parsed = { min: undefined, max: undefined };
                    o.depends = {};
                    o.default_max = 'max' === o.default || 'last' === o.default;
                    o.default_min = 'min' === o.default || 'first' === o.default;
                    if (o.view)
                        this.add_dependency(o.view, { type: 'update', id: o.id });
                    if (!(o.max in this.data.variables)) {
                        if (o.max in this.inputs) {
                            this.add_dependency(o.max, { type: 'max', id: o.id });
                        }
                        else
                            o.e.max = o.max;
                    }
                    else if (o.view) {
                        this.add_dependency(o.view + '_time', { type: 'max', id: o.id });
                    }
                    if (!(o.min in this.data.variables)) {
                        if (o.min in this.inputs) {
                            this.add_dependency(o.min, { type: 'min', id: o.id });
                        }
                        else
                            o.e.min = o.min;
                    }
                    else if (o.view) {
                        this.add_dependency(o.view + '_time', { type: 'min', id: o.id });
                    }
                    if ('undefined' !== typeof o.default) {
                        if (patterns.number.test(o.default)) {
                            o.default = +o.default;
                        }
                        else
                            o.reset = o.default_max
                                ? function () {
                                    if (this.range) {
                                        this.current_default = this.site.valueOf(this.range[1]);
                                        this.set(this.current_default);
                                    }
                                }.bind(o)
                                : o.default_max
                                    ? function () {
                                        if (this.range) {
                                            this.current_default = this.site.valueOf(this.range[0]);
                                            this.set(this.current_default);
                                        }
                                    }.bind(o)
                                    : o.default in this.inputs
                                        ? function () {
                                            this.current_default = this.site.valueOf(this.default);
                                            this.set(this.current_default);
                                        }.bind(o)
                                        : function () { };
                    }
                    if (o.variable) {
                        const d = -1 === this.spec.metadata.datasets.indexOf(o.dataset) ? defaults.dataset : o.dataset;
                        if (o.variable in this.inputs) {
                            this.add_dependency(o.variable, { type: 'update', id: o.id });
                        }
                        else if (o.variable in this.data.variables) {
                            o.min = o.parsed.min = o.range[0] = this.data.variables[o.variable].info[d].min;
                            o.e.min = o.min + '';
                            o.max = o.parsed.max = o.range[1] = this.data.variables[o.variable].info[d].max;
                            o.e.max = o.max + '';
                        }
                    }
                }
                if ('select' === o.type || 'number' === o.type || 'text' === o.type) {
                    if (o.e.parentElement.lastElementChild &&
                        o.e.parentElement.lastElementChild.classList.contains('select-reset')) {
                        o.e.parentElement.lastElementChild.addEventListener('click', o.reset.bind(o));
                    }
                }
                if (patterns.settings.test(o.id)) {
                    o.setting = o.id.replace(patterns.settings, '');
                    if (null == o.default && o.setting in this.spec.settings)
                        o.default = this.spec.settings[o.setting];
                    this.add_dependency(o.id, { type: 'setting', id: o.id });
                }
                if (!o.view)
                    o.view = defaults.dataview;
                const v = this.url_options[o.id] || storage.get(o.id.replace(patterns.settings, ''));
                if ('init' in o)
                    o.init();
                if (v) {
                    o.set(v);
                }
                else {
                    o.reset();
                }
            }));
            this.registered_outputs.forEach(o => {
                if ('init' in o)
                    o.init();
            });
        }
        global_update() {
            this.meta.retain_state = false;
            this.queue.elements.forEach(this.request_queue);
            this.registered_outputs.forEach(u => u.update());
        }
        global_reset() {
            this.meta.retain_state = false;
            this.registered_inputs.forEach((u, k) => {
                if (!u.setting && u.reset) {
                    u.reset();
                    this.request_queue(false, k);
                }
            });
        }
        clear_storage() {
            if (window.localStorage)
                storage.perm.removeItem(storage.name);
            window.location.reload();
        }
        request_queue(waiting, id) {
            if ('boolean' !== typeof waiting) {
                id = waiting;
                waiting = false;
            }
            if (!waiting && (-1 === this.queue.timeout || !this.queue.elements.get(id))) {
                this.queue.elements.set(id, true);
                if (this.queue.timeout > 0)
                    clearTimeout(this.queue.timeout);
                this.queue.timeout = setTimeout(this.run_queue, 20);
                this.meta.lock_after = id;
            }
        }
        run_queue() {
            if (this.queue.timeout > 0)
                clearTimeout(this.queue.timeout);
            this.queue.timeout = -1;
            this.queue.elements.forEach((fire, k) => {
                if (fire) {
                    const d = this.refresh_conditions(k);
                    if (d) {
                        if (!(k in this.data.data_queue[d]))
                            this.data.data_queue[d][k] = this.run_queue;
                        return false;
                    }
                    this.queue.elements.set(k, false);
                }
            });
            let k = this.get_options_url();
            if (this.data.inited.first && k !== this.state) {
                this.state = k;
                Object.keys(this.url_options).forEach(s => {
                    const v = this.url_options[s];
                    if ('string' === typeof v && patterns.embed_setting.test(s))
                        k += '&' + s + '=' + ('navcolor' === s ? v.replace(patterns.hashes, '%23') : v);
                });
                if (!this.spec.settings.hide_url_parameters) {
                    window.history.replaceState(Date.now(), '', k);
                }
                setTimeout(this.page.resize, 50);
            }
        }
        refresh_conditions(id) {
            if (id in this.dependencies) {
                const d = this.dependencies[id], r = [], c = 'view.' === id.substring(0, 5) ? this.view : id in this.dataviews ? this.dataviews[id] : this.inputs[id], is_view = c instanceof SiteDataView, is_global = c instanceof GlobalView, part = 'id' === id.substring(5) ? 'id_state' : 'filter_state', v = is_global ? c[part]() : c && c.value() + '', state = is_global ? c.states[part] : c && c.state;
                if (c && (!this.meta.retain_state || state !== v)) {
                    if (is_global) {
                        c.states[part] = v;
                    }
                    else if (!is_view) {
                        const view = this.dataviews[c.view], dd = v in this.data.loaded ? v : c.dataset ? this.valueOf(c.dataset) : view && view.get.dataset();
                        if (this.data.info && dd in this.data.loaded && !this.data.loaded[dd]) {
                            if (!c.deferred)
                                this.data.retrieve(dd, this.data.info[dd].site_file);
                            return dd;
                        }
                        c.state = v;
                    }
                    else {
                        c.state = v;
                    }
                    d.forEach(di => {
                        if ('rule' === di.type) {
                            if (-1 === r.indexOf(di.rule)) {
                                r.push(di.rule);
                            }
                        }
                        else if ('dataview' === di.type) {
                            this.dataviews[di.id].update();
                        }
                        else if (di.conditional) {
                            this.conditionals[di.conditional](di.id in this.dataviews ? this.dataviews[di.id] : this.inputs[di.id], c);
                        }
                        else if (di.id in this.inputs) {
                            const du = this.inputs[di.id];
                            di.type in du && du[di.type]();
                        }
                        else if (di.id in this.outputs) {
                            const du = this.outputs[di.id];
                            di.type in du && du[di.type]();
                        }
                    });
                    r.forEach(i => {
                        let pass = false;
                        const ri = this.spec.rules[i], n = ri.condition.length;
                        for (let i = 0; i < n; i++) {
                            const ck = ri.condition[i];
                            pass = ck.check();
                            if (ck.any ? pass : !pass)
                                break;
                        }
                        Object.keys(ri.parsed).forEach(k => {
                            if (pass) {
                                if ('display' === k) {
                                    ri.parsed[k].e.classList.remove('hidden');
                                }
                                else if ('lock' === k) {
                                    ri.parsed[k].forEach((u) => {
                                        u.e.classList.remove('locked');
                                        toggle_input(u, true);
                                    });
                                }
                                else if (k in this.inputs) {
                                    const value = this.valueOf(ri.effects[k]);
                                    this.inputs[k].set(value);
                                }
                            }
                            else if ('display' === k) {
                                const e = ri.parsed[k];
                                if (!e.e.classList.contains('hidden')) {
                                    e.e.classList.add('hidden');
                                    if (e.u && e.u.reset)
                                        e.u.reset();
                                    e.e.querySelectorAll('.auto-input').forEach(c => {
                                        const input = this.inputs[c.id];
                                        if (input && input.reset)
                                            input.reset();
                                    });
                                }
                            }
                            else if ('lock' === k) {
                                ri.parsed[k].forEach((u) => {
                                    u.e.classList.add('locked');
                                    toggle_input(u);
                                });
                            }
                            else if ('default' in ri) {
                                if (k in this.inputs) {
                                    this.inputs[k].set(this.valueOf(ri.default));
                                }
                            }
                        });
                    });
                }
                if (id === this.meta.lock_after)
                    this.meta.retain_state = true;
            }
        }
        valueOf(v) {
            return 'string' === typeof v && v in this.inputs ? this.valueOf(this.inputs[v].value()) : v;
        }
        get_options_url() {
            let s = '';
            this.registered_inputs.forEach((u, k) => {
                if ('virtual' !== u.type && !patterns.settings.test(k)) {
                    if (!('range' in u) || u.range[0] !== u.range[1]) {
                        let v = u.value();
                        if ('off_default' in u ? u.off_default : v !== u.default) {
                            if (Array.isArray(v))
                                v = v.join(',');
                            if ('' !== v && null != v && '-1' != v)
                                s += (s ? '&' : '?') + k + '=' + v;
                        }
                    }
                }
            });
            if (this.data && this.view.filters.size)
                s += (s ? '&' : '?') + this.view.filter_state([]);
            return window.location.protocol + '//' + window.location.host + window.location.pathname + s;
        }
        gtag(...args) {
            if (this.spec.settings.tracking)
                window.dataLayer.push(arguments);
        }
        drop_load_screen() {
            if (this.data && this.data.inited)
                clearTimeout(+this.data.inited.load_screen);
            this.page.wrap.style.visibility = 'visible';
            this.page.load_screen.style.display = 'none';
            if (this.spec.tutorials && 'tutorial' in this.url_options) {
                setTimeout(this.page.tutorials.start_tutorial.bind(this.page.tutorials, {
                    target: { dataset: { name: this.url_options.tutorial } },
                }), 0);
            }
        }
        add_dependency(id, o) {
            if (!(id in this.dependencies))
                this.dependencies[id] = [];
            if (!o.uid)
                o.uid = JSON.stringify(o);
            if (o.type in this.conditionals) {
                o.conditional = o.type;
            }
            const c = this.dependencies[id];
            for (let i = c.length; i--;)
                if (o.uid === c[i].uid)
                    return void 0;
            c.push(o);
            if (!(id in this.tree))
                this.tree[id] = { _n: { children: 0, parents: 0 }, children: {}, parents: {} };
            if (!(o.id in this.tree))
                this.tree[o.id] = { _n: { children: 0, parents: 0 }, children: {}, parents: {} };
            this.tree[id].children[o.id] = this.tree[o.id];
            this.tree[id]._n.children++;
            this.tree[o.id].parents[id] = this.tree[id];
            this.tree[o.id]._n.parents++;
            c.sort((a, b) => {
                return !(a.id in this.tree) || !(b.id in this.tree)
                    ? -Infinity
                    : this.tree[a.id]._n.children - this.tree[b.id]._n.children;
            });
            this.request_queue(true, id);
        }
        get_color(value, which, summary, index, rank, total) {
            const pal = palettes[which];
            if (isNaN(value) || 'continuous-polynomial' === pal.type)
                return this.defaults.missing;
            const settings = this.spec.settings, centered = 'none' !== settings.color_scale_center && !settings.color_by_order, fixed = 'discrete' === pal.type, string = 'string' === summary.type, min = !string ? summary.min[index] : 0, range = string ? summary.levels.length - min : summary.range[index], stat = 'none' === settings.color_scale_center || patterns.median.test(settings.color_scale_center)
                ? 'median'
                : 'mean', center_source = ((settings.color_by_order ? 'break_' : 'norm_') + stat), center = settings.color_by_order
                ? centered
                    ? summary[center_source][index] / total
                    : 0.5
                : isNaN(summary[center_source][index])
                    ? 0.5
                    : summary[center_source][index], r = fixed
                ? centered && !settings.color_by_order
                    ? Math.ceil(pal.colors.length / 2) - pal.odd / 2
                    : pal.colors.length
                : 1, p = settings.color_by_order
                ? (rank + 0.5) / total
                : range
                    ? ((string ? summary.level_ids[value] : value) - min) / range
                    : 0.5, upper = p > (centered ? center : 0.5), bound_ref = upper ? 'upper_' : 'lower_', value_min = (bound_ref + stat + '_min'), value_range = (bound_ref + stat + '_range');
            let v = centered
                ? range
                    ? ((upper ? p - center : p + center) - summary[value_min][index]) / summary[value_range][index]
                    : 1
                : p;
            if (!fixed) {
                v = Math.max(0, Math.min(1, v));
                if (upper)
                    v = 1 - v;
                if (!centered)
                    v *= 2;
            }
            return (string ? value in summary.level_ids : 'number' === typeof value)
                ? fixed
                    ? pal.colors[Math.max(0, Math.min(pal.colors.length - 1, Math.floor(centered ? (upper ? r + r * v : r * v) : r * v)))]
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
                : defaults.missing;
        }
    }

    return Community;

}));
//# sourceMappingURL=community.js.map
