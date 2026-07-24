import { NextResponse, type NextRequest } from "next/server"
import {
  hasSharedConfigStore,
  readSavedConfigs,
  unavailableResponse,
  writeSavedConfigs,
} from "../store"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSharedConfigStore()) {
    return unavailableResponse(503)
  }

  try {
    const { id } = await params
    const savedConfigs = await readSavedConfigs()
    const nextSavedConfigs = savedConfigs.filter((savedConfig) => savedConfig.id !== id)

    return NextResponse.json({
      configs: await writeSavedConfigs(nextSavedConfigs),
      storage: "shared",
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not delete config.",
      },
      { status: 500 },
    )
  }
}
