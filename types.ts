
export interface SubtitleSegment {
  text: string;
  startTime: number;
  endTime: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  POLLING = 'POLLING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
