export type Language = 'en' | 'hi';
export type Localized = { en: string; hi: string };
export type RecordType = 'lab' | 'prescription' | 'discharge' | 'diagnostic';
export type ObservationStatus = 'normal' | 'high' | 'low' | 'unknown';
export interface Observation { id: string; name: string; value: number | null; unit: string; referenceLow: number | null; referenceHigh: number | null; status: ObservationStatus; sourceText: string; explanation: Localized; code?: string; }
export interface Medication { id: string; name: string; dosage: string; frequency: string; duration: string; instructions: string; sourceText: string; }
export interface Diagnosis { name: string; sourceText: string; }
export interface Provenance { mode: 'live' | 'demo' | 'local'; extractionModel: string; visionModel?: string; processedAt: string; warnings: string[]; }
export interface HealthRecord { id: string; title: string; type: RecordType; date: string | null; provider: string; fileName: string; summary: Localized; keyPoints: Localized[]; observations: Observation[]; medications: Medication[]; diagnoses: Diagnosis[]; sourceText: string; reviewStatus: 'pending' | 'reviewed'; isDemo: boolean; createdAt: string; provenance: Provenance; }
export interface VitalsEntry { id: string; recordedAt: string; systolic: number; diastolic: number; heartRate: number; bloodGlucose?: number | null; spO2?: number | null; weightKg?: number | null; notes?: string; }
export interface Patient { id: string; name: string; dateOfBirth: string; gender: string; bloodGroup: string; allergies: string[]; conditions?: string[]; emergencyContact?: { name: string; phone: string; relation: string }; abhaId: string | null; abhaAddress: string | null; abhaLinked: boolean; }
export interface Bootstrap { patient: Patient; records: HealthRecord[]; vitals: VitalsEntry[]; ai: { configured: boolean; provider?: string; geminiConfigured?: boolean; nvidiaConfigured?: boolean; models: { vision: string; extraction: string; chat: string } }; }
export interface UploadJob { id: string; status: 'queued' | 'processing' | 'completed' | 'failed'; stage: string; error?: string; recordId?: string; }
export interface ChatResponse { answer: string; citations: { recordId: string; title: string }[]; mode: 'live' | 'local'; model: string; }

