export const OWNER_ENROLLMENT_SAMPLES = 3
export const OWNER_MATCH_THRESHOLD = 0.5

export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index]
    sum += delta * delta
  }
  return Math.sqrt(sum)
}

export function averageDescriptors(samples: Float32Array[]): Float32Array | null {
  if (samples.length === 0) return null
  const length = samples[0].length
  if (length === 0 || samples.some(sample => sample.length !== length)) return null
  const average = new Float32Array(length)
  for (const sample of samples) {
    for (let index = 0; index < length; index += 1) average[index] += sample[index]
  }
  for (let index = 0; index < length; index += 1) {
    average[index] /= samples.length
  }
  return average
}

export function verifyOwnerDescriptor(
  candidate: Float32Array,
  enrolled: Float32Array,
  threshold = OWNER_MATCH_THRESHOLD,
): { matched: boolean; distance: number; threshold: number } {
  const distance = euclideanDistance(candidate, enrolled)
  return { matched: Number.isFinite(distance) && distance <= threshold, distance, threshold }
}
