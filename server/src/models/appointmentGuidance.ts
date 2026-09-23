export type AppointmentGuidance = {
  id: string;
  title: string;
  instructions: string;
  appointment_recommended?: boolean | null;
  how_to_schedule?: string | null;
  documents_to_bring?: string[];
  arrival_guidance?: string | null;
  is_demo?: boolean;
};
export function demoAppointmentGuidance(service: { id: string; name: string; appointmentInfo: string }): AppointmentGuidance {
  const walkIn = service.name === 'Urgent care visit';
  return {
    id: `guidance-${service.id}`, title: `How to arrange ${service.name}`, instructions: service.appointmentInfo,
    appointment_recommended: !walkIn,
    how_to_schedule: walkIn
      ? 'Demo: Walk-ins are accepted. Call the listed location to confirm hours and current availability.'
      : 'Demo: Call the listed location and ask to schedule this service. Confirm the date, time, and location with the scheduling team.',
    documents_to_bring: ['Photo ID', 'Insurance card, if applicable', 'Appointment confirmation, if available', 'Referral or service order, if your scheduling team requested one'],
    arrival_guidance: 'Demo: Arrive 15 minutes before the scheduled time for check-in. For a walk-in visit, check in at reception. For a virtual visit, use the check-in details in your appointment confirmation.',
    is_demo: true
  };
}
