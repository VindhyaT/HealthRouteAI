export type AppointmentGuidance = {
  id: string; title: string; instructions: string;
  appointment_recommended?: boolean | null; how_to_schedule?: string | null;
  documents_to_bring?: string[]; arrival_guidance?: string | null; is_demo?: boolean;
};
export type Service = { id: string; name: string; description: string; department: string; appointmentInfo: string; appointmentGuidance?: AppointmentGuidance[]; tags: string[] };
export type Location = { id: string; name: string; address: string; hours: string; phone: string; services: string[] };
export type User = { id: string; name: string; email: string; role: 'patient' | 'admin' };
export type Department = { id: string; name: string; description: string; icon: string; services: Service[]; locations: Location[]; matchingServiceIds: string[] };
export type Recommendation = {
  department: { id: string; name: string; description: string };
  service: Service;
  locations: Pick<Location, 'id' | 'name' | 'address' | 'phone' | 'hours'>[];
  appointmentGuidance: AppointmentGuidance[];
};
export type AssistantResponse = { answer: string; sources: { id: string; kind: string; title: string }[]; recommendations: Recommendation[]; disclaimer: string; source: string };
