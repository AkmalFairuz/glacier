import { client, fileBody, unwrap } from './api'

export async function uploadImage(file: File): Promise<string> {
  const { url } = await unwrap(client.POST('/api/uploads/image', { body: fileBody(file) }))
  return url
}
