export const patterns = {
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
  mustache: /\{(.*?)\}/g,
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
  has_equation: /<math/,
  bracket_content: /(?:^|>)[^<]*(?:<|$)/,
  math_tags: /^(?:semantics|annotation|m|semantics)/,
  math_attributes: /^(?:xmlns|display|style|encoding|stretchy|alttext|scriptlevel|fence|math|separator)/,
  id_escapes: /(?<=#[^\s]+)([.[\](){}?*-])/g,
  repo: /\.com\/([^\/]+\/[^\/]+)/,
  basename: /^.*\//,
}
