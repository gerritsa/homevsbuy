import { NextResponse } from "next/server"

const CONFIG_APP_ID = "home-cash-flow-calculator"
const CONFIG_VERSION = 1
const STORE_KEY = `${CONFIG_APP_ID}:saved-configs:v${CONFIG_VERSION}`

export type SavedCalculatorConfig = {
  id: string
  name: string
  updatedAt: string
  config: unknown
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getKvCredentials() {
  const url =
    process.env.KV_REST_API_URL ??
    process.env.DB_KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.DB_KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN

  return url && token ? { url, token } : null
}

export function hasSharedConfigStore() {
  return getKvCredentials() !== null
}

function parseConfigExport(value: unknown) {
  if (!isPlainObject(value)) {
    throw new Error("Config must be an object.")
  }

  if (value.app !== CONFIG_APP_ID || value.version !== CONFIG_VERSION) {
    throw new Error("Config is not compatible with this calculator.")
  }

  return value
}

export function parseSavedConfigs(value: unknown): SavedCalculatorConfig[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return []
    }

    const id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID()
    const name = typeof item.name === "string" ? item.name.trim() : ""
    const updatedAt =
      typeof item.updatedAt === "string" && item.updatedAt
        ? item.updatedAt
        : new Date().toISOString()

    if (!name) {
      return []
    }

    try {
      return [
        {
          id,
          name,
          updatedAt,
          config: parseConfigExport(item.config),
        },
      ]
    } catch {
      return []
    }
  })
}

async function kvCommand(command: unknown[]) {
  const credentials = getKvCredentials()

  if (!credentials) {
    throw new Error("Shared config storage is not configured.")
  }

  const response = await fetch(credentials.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Shared config storage failed with status ${response.status}.`)
  }

  return (await response.json()) as { result?: unknown; error?: string }
}

export async function readSavedConfigs() {
  const response = await kvCommand(["GET", STORE_KEY])
  const rawConfigs = typeof response.result === "string" ? JSON.parse(response.result) : []

  return parseSavedConfigs(rawConfigs)
}

export async function writeSavedConfigs(configs: SavedCalculatorConfig[]) {
  const sortedConfigs = [...configs].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  )

  await kvCommand(["SET", STORE_KEY, JSON.stringify(sortedConfigs)])

  return sortedConfigs
}

export function unavailableResponse(status = 200) {
  return NextResponse.json(
    {
      configs: [],
      storage: "local",
      message: "Shared config storage is not configured.",
    },
    { status },
  )
}
