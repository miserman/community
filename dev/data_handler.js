(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
})((function () { 'use strict';

    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require("tslib");
    const checks_1 = require("./checks");
    const exporter_1 = require("./exporter");
    const retrievers = tslib_1.__importStar(require("./retrievers"));
    const formatter = tslib_1.__importStar(require("./formatters"));
    const ingester = tslib_1.__importStar(require("./ingesters"));
    const summary = tslib_1.__importStar(require("./summary"));
    const mapper = tslib_1.__importStar(require("./mappers"));
    const parser = tslib_1.__importStar(require("./parsers"));
    class DataHandler {
        constructor(settings, defaults, data, hooks) {
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
                return tslib_1.__awaiter(this, void 0, void 0, function* () {
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
            this.format_value = formatter.value;
            this.format_label = formatter.label;
            this.ingest_data = ingester.data;
            this.ingest_map = ingester.map;
            this.load_id_maps = ingester.id_maps;
            this.init_summary = summary.init;
            this.calculate_summary = summary.calculate;
            this.map_variables = mapper.variables;
            this.map_entities = mapper.entities;
            this.parse_query = parser.query;
            this.export = exporter_1.exporter;
            this.get_variable = function (variable, view) {
                return tslib_1.__awaiter(this, void 0, void 0, function* () {
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
            this.sets = data || {};
            this.hooks = hooks || {};
            this.get_value = this.get_value.bind(this);
            this.dynamic_load = 'dataviews' in this.settings && this.settings.settings && !!this.settings.settings.partial_init;
            this.settings.view_names = this.dynamic_load ? Object.keys(this.settings.dataviews) : ['default_view'];
            if ('string' === typeof this.metadata.datasets)
                this.metadata.datasets = [this.metadata.datasets];
            const init = () => {
                if (!this.metadata.datasets || !this.metadata.datasets.length) {
                    this.metadata.datasets = Object.keys(this.info);
                    if (!this.metadata.datasets.length)
                        this.metadata.datasets = Object.keys(this.sets);
                }
                if (this.metadata.measure_info) {
                    const info = parser.measure_info(this.metadata.measure_info);
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
                            init();
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
                                init();
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
                init();
            }
        }
    }
    DataHandler.retrievers = retrievers;
    DataHandler.checks = checks_1.value_checks;
    exports.default = DataHandler;

}));
//# sourceMappingURL=data_handler.js.map
