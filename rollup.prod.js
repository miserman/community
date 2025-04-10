import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import {default as config} from './rollup.config.js'
import fs from 'fs'
import {minify} from 'csso'

const version = process.env.community_dist_version ? '.' + process.env.community_dist_version : ''

config[0].plugins = config[1].plugins = [typescript({compilerOptions: {outDir: 'docs/dist/js'}}), terser()]
config[0].output.file = 'docs/dist/js/community' + version + '.min.js'
config[1].output.file = 'docs/dist/js/data_handler' + version + '.min.js'

fs.readFile('dev/community.css', 'utf8', (err, data) => {
  if (err) {
    console.error(err)
  } else {
    fs.writeFile('docs/dist/css/community' + version + '.min.css', minify(data).css, err => {
      if (err) {
        console.error(err)
      } else {
        console.log('wrote minified css to docs/dist/css/community' + version + '.min.css')
      }
    })
  }
})

export default config
