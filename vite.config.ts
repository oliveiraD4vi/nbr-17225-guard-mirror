import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

type OutputChunkLike = {
  type: string
  fileName: string
  imports?: string[]
  dynamicImports?: string[]
  viteMetadata?: {
    importedCss?: Set<string>
    importedAssets?: Set<string>
  }
}

export default defineConfig({
  plugins: [
    react(),
    (() => {
      const contentWebAccessibleResources = new Set<string>(['content-bootstrap.js'])

      const collectChunkDependencies = (
        fileName: string,
        bundle: Record<string, OutputChunkLike>,
      ) => {
        const stack = [fileName]

        while (stack.length > 0) {
          const currentFile = stack.pop()
          if (!currentFile || contentWebAccessibleResources.has(currentFile)) continue

          contentWebAccessibleResources.add(currentFile)
          const chunk = bundle[currentFile]
          if (!chunk || chunk.type !== 'chunk') continue

          chunk.imports?.forEach((importedFile) => {
            if (!contentWebAccessibleResources.has(importedFile)) stack.push(importedFile)
          })
          chunk.dynamicImports?.forEach((importedFile) => {
            if (!contentWebAccessibleResources.has(importedFile)) stack.push(importedFile)
          })
          chunk.viteMetadata?.importedCss?.forEach((cssFile) =>
            contentWebAccessibleResources.add(cssFile),
          )
          chunk.viteMetadata?.importedAssets?.forEach((assetFile) =>
            contentWebAccessibleResources.add(assetFile),
          )
        }
      }

      return {
        name: 'copy-extension-manifest',
        generateBundle(_, bundle) {
          collectChunkDependencies('content.js', bundle as Record<string, OutputChunkLike>)
        },
        closeBundle() {
          const source = path.resolve(__dirname, 'public/manifest.json')
          const target = path.resolve(__dirname, 'dist/manifest.json')

          const manifest = JSON.parse(fs.readFileSync(source, 'utf8')) as {
            web_accessible_resources?: Array<{ resources: string[]; matches: string[] }>
          }

          manifest.web_accessible_resources = [
            {
              resources: Array.from(contentWebAccessibleResources).sort((left, right) =>
                left.localeCompare(right),
              ),
              matches: ['<all_urls>'],
            },
          ]

          fs.writeFileSync(target, JSON.stringify(manifest, null, 2))
        },
      }
    })(),
  ],
  build: {
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup.html'),
        report: path.resolve(__dirname, 'src/report.html'),
        devtools: path.resolve(__dirname, 'src/devtools.html'),
        devtoolsPanel: path.resolve(__dirname, 'src/devtools-panel.html'),
        background: path.resolve(__dirname, 'src/background.ts'),
        content: path.resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@ant-design/icons')) return 'vendor-icons'
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
          return undefined
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
