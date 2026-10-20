export enum StrategicLane {
  CORE_AI_UX = 'CORE_AI_UX',
  PRODUCT_STRATEGY = 'PRODUCT_STRATEGY',
  INTERFACE_BUILD = 'INTERFACE_BUILD',
  SOFTWARE_BACKEND_API = 'SOFTWARE_BACKEND_API',
  UX_RESEARCH = 'UX_RESEARCH',
  DISQUALIFIED_NOISE = 'DISQUALIFIED_NOISE'
}

export interface RoleClassification {
  lane: StrategicLane;
  normalizedRole: string;
  suggestedProofStory: string;
  isDisqualified: boolean;
}
