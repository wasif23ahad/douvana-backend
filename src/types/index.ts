// Shared types for the Drouvana backend

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum ApplicationStatus {
  SAVED = 'SAVED',
  APPLYING = 'APPLYING',
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TemplateCategory {
  TECH = 'TECH',
  CREATIVE = 'CREATIVE',
  FINANCE = 'FINANCE',
  MARKETING = 'MARKETING',
  OPERATIONS = 'OPERATIONS',
  EXECUTIVE = 'EXECUTIVE',
  GENERAL = 'GENERAL',
}

export enum TemplateStyle {
  MODERN = 'MODERN',
  CLASSIC = 'CLASSIC',
  MINIMAL = 'MINIMAL',
  BOLD = 'BOLD',
}

export enum ActivityType {
  STATUS_CHANGE = 'STATUS_CHANGE',
  NOTE_ADDED = 'NOTE_ADDED',
  RESUME_GENERATED = 'RESUME_GENERATED',
  COVER_LETTER_GENERATED = 'COVER_LETTER_GENERATED',
  EMAIL_GENERATED = 'EMAIL_GENERATED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  OFFER_RECEIVED = 'OFFER_RECEIVED',
  APPLICATION_CREATED = 'APPLICATION_CREATED',
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AIAnalysisResult {
  required_skills: string[];
  nice_to_have: string[];
  experience_level: string;
  ats_keywords: string[];
  culture_signals: string[];
  red_flags: string[];
  company_summary: string;
  role_insights: string;
}

export interface AIHealthScoreResult {
  overall_score: number;
  ats_pass_probability: number;
  keyword_match_score: number;
  missing_skills: string[];
  strengths: string[];
  recommendations: string[];
}