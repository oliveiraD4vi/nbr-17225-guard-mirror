import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import commitlintConfig from '../commitlint.config.mjs'

const ZERO_SHA = /^0{40}$/
const HEADER_MAX_LENGTH = commitlintConfig.rules?.['header-max-length']?.[2] ?? 100
const gitSafeDirectory = process.cwd().replace(/\\/g, '/')
const allowedTypes = new Set(commitlintConfig.rules?.['type-enum']?.[2] ?? [])
const ignoredHeaders = [/^Merge /, /^Revert "/, /^fixup! /, /^squash! /]

function git(args, options = {}) {
  return execFileSync('git', ['-c', `safe.directory=${gitSafeDirectory}`, ...args], {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
}

function listCommits(args) {
  const output = git(['rev-list', '--reverse', ...args]).trim()
  return output ? output.split(/\r?\n/) : []
}

function listNewRefCommits(remoteName, localSha) {
  try {
    return listCommits([localSha, '--not', `--remotes=${remoteName}`])
  } catch {
    return listCommits([localSha])
  }
}

function listRangeCommits(fromSha, toSha) {
  if (!fromSha || ZERO_SHA.test(fromSha)) {
    return listNewRefCommits('origin', toSha)
  }

  return listCommits([`${fromSha}..${toSha}`])
}

async function readStdin() {
  let input = ''
  process.stdin.setEncoding('utf8')

  for await (const chunk of process.stdin) {
    input += chunk
  }

  return input
}

async function getPrePushCommits(remoteName) {
  const input = await readStdin()
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const commits = []

  for (const line of lines) {
    const [, localSha, , remoteSha] = line.split(/\s+/)

    if (!localSha || ZERO_SHA.test(localSha)) {
      continue
    }

    const refCommits =
      !remoteSha || ZERO_SHA.test(remoteSha)
        ? listNewRefCommits(remoteName, localSha)
        : listRangeCommits(remoteSha, localSha)

    commits.push(...refCommits)
  }

  return commits
}

function getOptionValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function getRangeCommits() {
  const fromSha = getOptionValue('--from')
  const toSha = getOptionValue('--to') ?? 'HEAD'

  return listRangeCommits(fromSha, toSha)
}

function getCommitMessage(sha) {
  return git(['log', '-1', '--format=%B', sha])
}

function getCommitHeader(message) {
  return message.trim().split(/\r?\n/, 1)[0] ?? ''
}

function getCommitMessageErrors(message) {
  const header = getCommitHeader(message)

  if (ignoredHeaders.some((pattern) => pattern.test(header))) {
    return []
  }

  const errors = []
  const match = /^(?<type>[a-z]+)(?:\([a-z0-9_.-]+\))?(?<breaking>!)?: (?<subject>.+)$/.exec(header)

  if (header.length > HEADER_MAX_LENGTH) {
    errors.push(`o cabeçalho deve ter no máximo ${HEADER_MAX_LENGTH} caracteres`)
  }

  if (!match?.groups) {
    errors.push('use o formato "tipo(escopo opcional): descrição curta"')
    return errors
  }

  if (!allowedTypes.has(match.groups.type)) {
    errors.push(`tipo inválido: ${match.groups.type}`)
  }

  if (match.groups.subject.trim().endsWith('.')) {
    errors.push('a descrição não deve terminar com ponto final')
  }

  return errors
}

function lintCommitMessage(message, label) {
  const errors = getCommitMessageErrors(message)

  if (errors.length === 0) {
    return true
  }

  console.error(`Mensagem inválida em ${label}: ${getCommitHeader(message)}`)

  for (const error of errors) {
    console.error(`- ${error}`)
  }

  return false
}

function lintCommit(sha) {
  return lintCommitMessage(getCommitMessage(sha), `commit ${sha.slice(0, 12)}`)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

if (process.argv.includes('--edit')) {
  const editIndex = process.argv.indexOf('--edit')
  const messageFile = process.argv[editIndex + 1]

  if (!messageFile) {
    console.error('Arquivo de mensagem de commit não informado.')
    process.exit(1)
  }

  const message = readFileSync(messageFile, 'utf8')
  process.exit(lintCommitMessage(message, 'COMMIT_EDITMSG') ? 0 : 1)
}

const isPrePush = process.argv.includes('--pre-push')
const prePushIndex = process.argv.indexOf('--pre-push')
const remoteName = isPrePush ? (process.argv[prePushIndex + 1] ?? 'origin') : 'origin'
const commits = unique(isPrePush ? await getPrePushCommits(remoteName) : getRangeCommits())

if (commits.length === 0) {
  console.log('Nenhum commit novo para validar.')
  process.exit(0)
}

console.log(`Validando ${commits.length} commit(s) com Conventional Commits...`)

const invalidCommits = []

for (const sha of commits) {
  console.log(`Commit ${sha.slice(0, 12)}`)

  if (!lintCommit(sha)) {
    invalidCommits.push(sha)
  }
}

if (invalidCommits.length > 0) {
  console.error(
    `\n${invalidCommits.length} commit(s) fora do padrão. Ajuste as mensagens antes de enviar.`,
  )
  process.exit(1)
}

console.log('Mensagens de commit válidas.')
