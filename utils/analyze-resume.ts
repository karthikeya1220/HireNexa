import apiClient from "../lib/api-client"

// Encode an ArrayBuffer as base64 in chunks — avoids blowing the call stack
// on multi-megabyte resume files. (Array.from keeps this es5-target safe.)
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    )
  }
  return btoa(binary)
}

// Thin client wrapper: hashing, Gemini analysis, S3 upload and persistence
// all happen server-side now (see api/controllers/resumeController.ts), so
// no AWS/Gemini credentials are bundled into the browser.
export async function analyzeResume(
  file: File,
  _userId: string,
  _userEmail: string,
  vendorId: string | null = null,
  vendorName: string | null = null,
) {
  try {
    const data = arrayBufferToBase64(await file.arrayBuffer())
    const response = (await apiClient.resumes.analyze({
      file: {
        name: file.name,
        type: file.type || "application/pdf",
        data,
      },
      vendor_id: vendorId || undefined,
      vendor_name: vendorName || undefined,
    })) as { analysis: any; savedData: any }

    return response
  } catch (error) {
    // Surface the server's user-facing message (duplicates, invalid resume…)
    const serverMessage = (error as { data?: { error?: string } }).data?.error
    if (serverMessage) {
      throw new Error(serverMessage)
    }
    throw error
  }
}
