import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export enum IncidentType {
  ACCIDENT = 'accident',
  EMERGENCY = 'emergency',
  DELAY = 'delay',
  INCONSISTENCY = 'inconsistency',
  OTHER = 'other'
}

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class ReportIncidentDto {
  @IsEnum(IncidentType)
  incident_type: IncidentType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;
}