import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { askNavigationAssistant } from '../services/aiService';
import { retrieveNavigationContext, localNavigationAnswer } from '../services/navigationContext';
import { isClinicalRequest, NAVIGATION_ONLY_MESSAGE } from '../services/navigationSafety';

export async function answerNavigationQuestion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const question = z.object({ question: z.string().trim().min(3, 'Enter a question with at least 3 characters.').max(500, 'Keep your question under 500 characters.') }).strict().parse(req.body).question;
    const disclaimer = 'HealthRoute AI provides healthcare navigation information, not medical advice.';
    if (isClinicalRequest(question)) return res.json({ answer: NAVIGATION_ONLY_MESSAGE, recommendations: [], services: [], sources: [], source: 'local', disclaimer });
    const context = await retrieveNavigationContext(question);
    const generated = await askNavigationAssistant(question, context.documents);
    const sourceIds = generated?.sourceIds || context.documents.map(d => d.id);
    res.json({
      answer: generated?.answer || localNavigationAnswer(context),
      recommendations: context.recommendations, services: context.recommendations.map(r => r.service),
      sources: context.documents.filter(d => sourceIds.includes(d.id)).map(({ id, kind, title }) => ({ id, kind, title })),
      source: generated ? 'gemini' : 'local', disclaimer
    });
  } catch (error) { next(error); }
}
