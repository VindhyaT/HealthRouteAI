import { AppointmentGuidance, demoAppointmentGuidance } from '../models/appointmentGuidance';
export type Location = { id: string; name: string; address: string; hours: string; phone: string; services: string[] };
export type Service = { id: string; name: string; description: string; department: string; appointmentInfo: string; appointmentGuidance?: AppointmentGuidance[]; tags: string[] };
export type Department = { id: string; name: string; description: string; icon: string; services: Service[]; locations: Location[] };

export const locations: Location[] = [
  { id: 'loc-main', name: 'Main Campus', address: '100 Wellness Way, North Building', hours: 'Mon-Fri, 7:00 AM - 6:00 PM', phone: '(555) 010-4200', services: ['Primary Care', 'Cardiology', 'Imaging'] },
  { id: 'loc-east', name: 'Eastside Outpatient Center', address: '48 Orchard Avenue, Suite 200', hours: 'Mon-Sat, 8:00 AM - 5:00 PM', phone: '(555) 010-4215', services: ["Women's Health", 'Pediatrics', 'Physical Therapy'] },
  { id: 'loc-virtual', name: 'HealthRoute Virtual Care', address: 'Video appointments from home', hours: 'Mon-Fri, 8:00 AM - 8:00 PM', phone: '(555) 010-4000', services: ['Primary Care', 'Behavioral Health'] }
];

export const departments: Department[] = [
  { id: 'dep-primary', name: 'Primary Care', description: 'Your first stop for routine care, prevention, and referrals to specialists.', icon: 'heart-pulse', services: [
    { id: 'svc-checkup', name: 'Annual wellness visit', description: 'Preventive health visits, screenings, and care planning for adults.', department: 'Primary Care', appointmentInfo: 'Book online or call the care team. Most visits are 30 minutes.', tags: ['checkup', 'preventive', 'physical'] },
    { id: 'svc-family', name: 'Family medicine', description: 'Care for common concerns and health needs across every stage of life.', department: 'Primary Care', appointmentInfo: 'New patients can request an appointment online.', tags: ['family', 'general', 'doctor'] }
  ], locations: [locations[0], locations[2]] },
  { id: 'dep-heart', name: 'Cardiology', description: 'Evaluation, testing, and ongoing care for heart and circulation concerns.', icon: 'activity', services: [
    { id: 'svc-cardiology', name: 'Cardiology consultation', description: 'Meet with a heart specialist for symptoms, risk factors, or test follow-up.', department: 'Cardiology', appointmentInfo: 'A referral may be required. Bring prior test results to your visit.', tags: ['heart', 'cardiology', 'chest'] },
    { id: 'svc-echo', name: 'Echocardiogram', description: 'Non-invasive ultrasound imaging that looks at heart structure and function.', department: 'Cardiology', appointmentInfo: 'Schedule through the Cardiology testing team after an order is placed.', tags: ['heart', 'ultrasound', 'test'] }
  ], locations: [locations[0]] },
  { id: 'dep-womens', name: "Women's Health", description: 'Compassionate care for reproductive health, pregnancy, and preventive screenings.', icon: 'flower-2', services: [
    { id: 'svc-obgyn', name: 'OB/GYN care', description: 'Routine gynecology, reproductive health, and pregnancy support.', department: "Women's Health", appointmentInfo: 'Request an appointment online or call the Eastside center.', tags: ['women', 'pregnancy', 'gynecology'] }
  ], locations: [locations[1]] },
  { id: 'dep-rehab', name: 'Physical Therapy', description: 'Physical and occupational therapy to support strength, mobility, and recovery.', icon: 'accessibility', services: [
    { id: 'svc-pt', name: 'Physical therapy', description: 'Personalized movement and strength support after injury or surgery.', department: 'Physical Therapy', appointmentInfo: 'A provider referral may be needed depending on your plan.', tags: ['therapy', 'mobility', 'injury'] }
  ], locations: [locations[1]] },
  { id: 'dep-ortho', name: 'Orthopedics', description: 'Evaluation and coordinated care for bones, joints, muscles, and movement.', icon: 'accessibility', services: [
    { id: 'svc-ortho', name: 'Orthopedic consultation', description: 'Start with a specialist for joint, bone, or muscle concerns.', department: 'Orthopedics', appointmentInfo: 'Ask your primary care team whether a referral is needed.', tags: ['bone', 'joint', 'muscle', 'orthopedic'] }
  ], locations: [locations[0]] },
  { id: 'dep-radiology', name: 'Radiology', description: 'Imaging services that help your care team understand what is happening in your body.', icon: 'scan-line', services: [
    { id: 'svc-imaging', name: 'Diagnostic imaging', description: 'Schedule X-ray, ultrasound, CT, or MRI services when ordered by a provider.', department: 'Radiology', appointmentInfo: 'Bring your imaging order and arrive 15 minutes early.', tags: ['imaging', 'x-ray', 'mri', 'scan'] }
  ], locations: [locations[0]] },
  { id: 'dep-derm', name: 'Dermatology', description: 'Care for skin, hair, and nail concerns and routine skin checks.', icon: 'sun-medium', services: [
    { id: 'svc-derm', name: 'Dermatology consultation', description: 'Meet with a dermatology specialist for an evaluation or skin check.', department: 'Dermatology', appointmentInfo: 'Request an appointment online; a referral may be required by your plan.', tags: ['skin', 'rash', 'dermatology'] }
  ], locations: [locations[0]] },
  { id: 'dep-lab', name: 'Laboratory Services', description: 'Convenient blood and specimen collection for ordered tests.', icon: 'test-tube', services: [
    { id: 'svc-lab', name: 'Laboratory testing', description: 'Visit a collection site for blood work and other ordered tests.', department: 'Laboratory Services', appointmentInfo: 'Call the listed location to schedule laboratory testing and confirm any requested documents.', tags: ['lab', 'blood', 'testing'] }
  ], locations: [locations[0], locations[1]] },
  { id: 'dep-urgent', name: 'Urgent Care', description: 'Same-day administrative navigation for non-life-threatening concerns.', icon: 'siren', services: [
    { id: 'svc-urgent', name: 'Urgent care visit', description: 'Find a same-day care location for a concern that cannot wait for a routine visit.', department: 'Urgent Care', appointmentInfo: 'Walk-ins are accepted at Main Campus. Call ahead for current wait information.', tags: ['urgent', 'same-day', 'walk-in'] }
  ], locations: [locations[0]] }
];

for (const department of departments) {
  for (const service of department.services) service.appointmentGuidance = [demoAppointmentGuidance(service)];
}

export const faqs = [
  { id: 'faq-1', question: 'How do I find the right department?', answer: 'Describe what you need in everyday language. HealthRoute will suggest a department and explain how to request an appointment.' },
  { id: 'faq-2', question: 'Can HealthRoute diagnose me?', answer: 'No. HealthRoute provides navigation and administrative information only. For urgent symptoms, call emergency services.' },
  { id: 'faq-3', question: 'What should I bring to an appointment?', answer: 'Bring your photo ID, insurance card, medication list, and any relevant records or questions.' }
];