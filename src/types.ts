export interface TherapyPlan {
  id: string;
  ownerId: string;
  patientName: string;
  patientPhone?: string;
  age: string;
  gender: string;
  date: string; // formulation date (YYYY-MM-DD)
  provisionalDiagnosis: string;
  presentConcerns: string;
  assessmentFindings: string;
  therapyPlan: string[]; // numbered or bulleted therapy targets/goals
  adviceHomeProgram: string;
  recommendations: string;
  frequencyOfTherapy: string;
  reviewDate: string; // date of review (YYYY-MM-DD or text)
  therapistName: string;
  therapistSignature: string; // Base64 signature image or digital sketch
  createdAt: any; // Firestore serverTimestamp or Date representation
  updatedAt: any;
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export interface WhatsAppSettings {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  templateName?: string;
  langCode?: string;
  sendMethod?: 'pdf' | 'link';
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
