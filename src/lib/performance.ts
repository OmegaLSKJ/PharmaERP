export type QualityLevel = 'high' | 'medium' | 'low'

export interface QualityProfile {
  dpr: [number, number]
  particles: number
  postProcessing: boolean
  shadows: boolean
  bloom: boolean
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: { dpr: [1, 2], particles: 900, postProcessing: true, shadows: true, bloom: true },
  medium: { dpr: [1, 1.5], particles: 400, postProcessing: true, shadows: true, bloom: true },
  low: { dpr: [1, 1], particles: 120, postProcessing: false, shadows: false, bloom: false },
}
