export const NAVIGATION_ONLY_MESSAGE = 'I can help you find departments, services, locations, and appointment information. I cannot diagnose conditions or recommend medication or treatment. Please ask a qualified healthcare professional for medical advice.';

// Conservative local checks complement the provider instructions; they do not classify diseases.
export function isClinicalRequest(question: string) {
  return /\b(diagnos(?:e[ds]?|ing|is|es)|prescri\w*|dosage|dose|cure|self[- ]?treat)\b/i.test(question)
    || /\b(what|which|should|recommend|suggest|best|give|need|take)\b.{0,65}\b(medications?|medicines?|drugs?|pills?|antibiotics?|treatments?|therapy exercises)\b/i.test(question)
    || /\b(treat|cure)\s+(my|this|a|an|the)\b/i.test(question)
    || /\b(do i have|what.{0,20}(disease|condition).{0,20}(have|is this)|interpret.{0,30}(results|symptoms)|what.{0,20}symptoms.{0,20}mean)\b/i.test(question)
    || /\b(ignore|override|forget)\b.{0,50}\b(instructions|rules|prompt|restrictions)\b/i.test(question);
}
export function unsafeGeneratedAdvice(text: string) {
  return /\b(fast(?:ing)?|stop taking|do not eat|avoid food|empty stomach|withhold medication)\b/i.test(text)
    || /\b(diagnos(?:e[ds]?|ing|is|es)|dosage|prescrib\w*|cure|antibiotics?|aspirin|ibuprofen|acetaminophen|paracetamol|amoxicillin|insulin|metformin)\b/i.test(text)
    || /\b\d+(?:\.\d+)?\s*(mg|mcg|milligrams?|tablets?|pills?)\b/i.test(text)
    || /\b(you (?:likely |probably |may |might )?have|you (?:are|may be) suffering|your symptoms (?:mean|suggest|indicate)|this (?:is|sounds like) (?:a |an )?(?:disease|infection|fracture))\b/i.test(text)
    || /\b(take|start|stop|increase|decrease|use|recommend|try)\b.{0,45}\b(medication|medicine|drug|dose|treatment|exercise|supplement)\b/i.test(text)
    || /\b(treat (?:your|the|this)|treatment (?:plan|recommendation)|apply (?:ice|heat)|rest (?:your|the)|stretch (?:your|the))\b/i.test(text)
    || /\b(ignore|override)\b.{0,40}\b(instructions|rules|prompt)\b/i.test(text);
}
