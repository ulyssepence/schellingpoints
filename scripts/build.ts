import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

const watch = process.argv.includes('--watch')
const apiHost = process.env.API_HOST || ''
const appVersion = process.env.APP_VERSION || 'dev'

const cssFiles = fs.readdirSync('static/styles').filter(f => f.endsWith('.css'))
const cssLinks = [
  '<link rel="stylesheet" href="/static/styles.css" />',
  ...cssFiles.map(f => `<link rel="stylesheet" href="/static/styles/${f}" />`),
].join('\n    ')

function html(jsFilename: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    ${cssLinks}
    <title>Schelling Points</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${jsFilename}"></script>
  </body>
</html>`
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const shared: esbuild.BuildOptions = {
  entryPoints: ['src/client.tsx'],
  bundle: true,
  jsx: 'automatic',
  define: {
    'import.meta.env.API_HOST': JSON.stringify(apiHost),
    'import.meta.env.APP_VERSION': JSON.stringify(appVersion),
  },
  outdir: 'dist',
}

if (watch) {
  const ctx = await esbuild.context({
    ...shared,
    entryNames: '[name]',
    sourcemap: true,
  })
  copyDir('static', 'dist/static')
  fs.writeFileSync('dist/index.html', html('client.js'))
  await ctx.watch()
  console.log('watching...')
} else {
  const result = await esbuild.build({
    ...shared,
    entryNames: '[name].[hash]',
    minify: true,
    metafile: true,
  })
  copyDir('static', 'dist/static')
  const outputs = Object.keys(result.metafile!.outputs)
  const jsFile = outputs.find(f => f.endsWith('.js'))!
  fs.writeFileSync('dist/index.html', html(jsFile.replace('dist/', '')))
  console.log(`built ${jsFile}`)
}
