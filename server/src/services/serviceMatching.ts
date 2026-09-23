import { AppointmentGuidance } from '../models/appointmentGuidance';
import { searchDepartments } from '../database';
import { rankServices } from './directorySearch';

export async function matchHealthcareServices(question: string) {
  const departments = await searchDepartments(question);
  // Only recommend services that actually matched; never substitute an unrelated service.
  const services = rankServices(departments.flatMap(d => d.services), question).slice(0, 3);
  return services.map(service => {
    const department = departments.find(d => d.services.some(s => s.id === service.id))!;
    return {
      department: { id: department.id, name: department.name, description: department.description },
      service,
      locations: department.locations.map(({ id, name, address, phone, hours }) => ({ id, name, address, phone, hours })),
      appointmentGuidance: service.appointmentGuidance?.length
        ? service.appointmentGuidance
        : [{ id: `service-${service.id}`, title: 'How to arrange your visit', instructions: service.appointmentInfo } as AppointmentGuidance]
    };
  });
}
