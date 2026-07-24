import { NextResponse, type NextRequest } from "next/server"
import {
  hasSharedConfigStore,
  parseSavedConfigs,
  readSavedConfigs,
  unavailableResponse,
  writeSavedConfigs,
} from "./store"

export async function GET() {
  if (!hasSharedConfigStore()) {
    return unavailableResponse()
  }

  try {
    return NextResponse.json({
      configs: await readSavedConfigs(),
      storage: "shared",
    })
  } catch (error) {
    return NextResponse.json(
      {
        configs: [],
        storage: "error",
        message: error instanceof Error ? error.message : "Could not load saved configs.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!hasSharedConfigStore()) {
    return unavailableResponse(503)
  }

  try {
    const body = await request.json()
    const [submittedConfig] = parseSavedConfigs([
      {
        id: typeof body.id === "string" ? body.id : crypto.randomUUID(),
        name: body.name,
        updatedAt: new Date().toISOString(),
        config: body.config,
      },
    ])

    if (!submittedConfig) {
      return NextResponse.json({ message: "Enter a name and valid config." }, { status: 400 })
    }

    const savedConfigs = await readSavedConfigs()
    const existingConfig = savedConfigs.find(
      (savedConfig) =>
        savedConfig.id === submittedConfig.id ||
        savedConfig.name.toLocaleLowerCase() === submittedConfig.name.toLocaleLowerCase(),
    )
    const nextConfig = {
      ...submittedConfig,
      id: existingConfig?.id ?? submittedConfig.id,
    }
    const nextSavedConfigs = [
      nextConfig,
      ...savedConfigs.filter((savedConfig) => savedConfig.id !== nextConfig.id),
    ]

    return NextResponse.json({
      configs: await writeSavedConfigs(nextSavedConfigs),
      savedConfig: nextConfig,
      storage: "shared",
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not save config.",
      },
      { status: 500 },
    )
  }
}
